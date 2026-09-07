import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import mimetypes
from email import policy
from email.parser import BytesParser
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "hospital.db"
UPLOAD_DIR = ROOT / "uploads"
PORT = int(os.environ.get("PORT", "5000"))
HOST = os.environ.get("HOST", "0.0.0.0")
SESSIONS = {}
DEFAULT_DATA = {
    "revenue": 692114.52, "expenses": 0, "claims": 0,
    "admissions": 14, "discharges": 9, "opdCount": 64,
    "activePatients": 62, "averageRevenue": 76901.61, "bedOccupancy": 40,
    "patients": [
        {"name": "Alina Brown", "dept": "Cardiology", "doctor": "Dr. R. Shah", "status": "Recovered", "bill": 1240, "initials": "AB", "color": "a"},
        {"name": "John Parker", "dept": "Orthopedic", "doctor": "Dr. I. Roy", "status": "Monitoring", "bill": 2180, "initials": "JP", "color": "b"},
        {"name": "Sonia Moore", "dept": "Neurology", "doctor": "Dr. A. Nair", "status": "Consult", "bill": 980, "initials": "SM", "color": "c"},
        {"name": "Daniel Malik", "dept": "Emergency", "doctor": "Dr. T. Lee", "status": "Critical", "bill": 3520, "initials": "DM", "color": "d"}],
    "appointments": [
        {"title": "Cardiology Review", "time": "09:00 AM - 09:45 AM", "doctor": "Dr. R. Shah", "status": "Active"},
        {"title": "Orthopedic Checkup", "time": "11:15 AM - 11:50 AM", "doctor": "Dr. I. Roy", "status": "Confirmed"},
        {"title": "Lab Diagnostics", "time": "01:30 PM - 02:20 PM", "doctor": "Radiology Team", "status": "Pending"}]}

def connect():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection

def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240000)
    return salt.hex() + ":" + digest.hex()

def verify_password(password, stored):
    salt, expected = stored.split(":", 1)
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 240000).hex()
    return hmac.compare_digest(actual, expected)

def init_db():
    UPLOAD_DIR.mkdir(exist_ok=True)
    with connect() as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL)")
        connection.execute("CREATE TABLE IF NOT EXISTS uploads (id INTEGER PRIMARY KEY, filename TEXT NOT NULL, stored_path TEXT NOT NULL, period TEXT NOT NULL DEFAULT 'daily', uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP)")
        columns = [row[1] for row in connection.execute("PRAGMA table_info(uploads)")]
        if "period" not in columns:
            connection.execute("ALTER TABLE uploads ADD COLUMN period TEXT NOT NULL DEFAULT 'daily'")
        if not connection.execute("SELECT 1 FROM admins WHERE username = 'admin'").fetchone():
            password = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(12)
            print("First-run admin credentials: username=admin password=" + password)
            connection.execute("INSERT INTO admins VALUES (?, ?)", ("admin", hash_password(password)))

def ensure_admin():
    configured_password = os.environ.get("ADMIN_PASSWORD")
    with connect() as connection:
        admin = connection.execute("SELECT 1 FROM admins WHERE username = 'admin'").fetchone()
        if admin and configured_password:
            connection.execute(
                "UPDATE admins SET password_hash = ? WHERE username = 'admin'",
                (hash_password(configured_password),),
            )
            return
        password = configured_password or secrets.token_urlsafe(12)
        connection.execute(
            "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
            ("admin", hash_password(password)),
        )
        print("First-run admin credentials: username=admin password=%s" % password)


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload, headers=None):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, file_path):
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(file_path.name)[0] or "application/octet-stream")
        self.send_header("Cache-Control", "no-store" if file_path.name == "index.html" else "public, max-age=3600")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def read_upload(self):
        content_type = self.headers.get("Content-Type", "")
        if not content_type.lower().startswith("multipart/form-data"):
            return None
        length = int(self.headers.get("Content-Length", "0"))
        if length > 25 * 1024 * 1024:
            return None
        raw = b"Content-Type: " + content_type.encode("latin-1") + b"\r\nMIME-Version: 1.0\r\n\r\n"
        message = BytesParser(policy=policy.default).parsebytes(raw + self.rfile.read(length))
        for part in message.iter_attachments():
            filename = part.get_filename()
            if filename:
                return filename, part.get_payload(decode=True) or b""
        return None

    def user(self):
        parsed = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        token = parsed.get("session")
        session = SESSIONS.get(token.value) if token else None
        return session["username"] if session and session["expires"] > time.time() else None

    def require_auth(self):
        if not self.user():
            self.send_json(401, {"error": "Authentication required"})
            return False
        return True

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            self.send_json(200, {"status": "ok"})
        elif path == "/" or path in ("/index.html", "/app.js", "/styles.css"):
            file_name = "index.html" if path == "/" else path.lstrip("/")
            self.send_file(ROOT / file_name)
        elif path == "/api/me":
            self.send_json(200 if self.user() else 401, {"username": self.user()})
        elif path == "/api/dashboard" and self.require_auth():
            self.send_json(200, DEFAULT_DATA)
        else:
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/login":
            data = self.read_json()
            with connect() as connection:
                admin = connection.execute("SELECT * FROM admins WHERE username = ?", (data.get("username", ""),)).fetchone()
            if not admin or not verify_password(data.get("password", ""), admin["password_hash"]):
                self.send_json(401, {"error": "Invalid username or password"})
                return
            token = secrets.token_urlsafe(32)
            SESSIONS[token] = {"username": admin["username"], "expires": time.time() + 28800}
            self.send_json(200, {"username": admin["username"]}, {"Set-Cookie": "session=%s; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800" % token})
        elif path == "/api/logout":
            parsed = cookies.SimpleCookie(self.headers.get("Cookie", ""))
            token = parsed.get("session")
            if token:
                SESSIONS.pop(token.value, None)
            self.send_json(200, {"ok": True}, {"Set-Cookie": "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"})
        elif path == "/api/upload" and self.require_auth():
            upload = self.read_upload()
            if not upload:
                self.send_json(400, {"error": "A file is required"})
                return
            name, contents = upload
            name = Path(name).name
            stored = UPLOAD_DIR / (secrets.token_hex(8) + "_" + name)
            stored.write_bytes(contents)
            period = self.headers.get("X-Dashboard-Period", "daily").lower()
            if period not in ("daily", "weekly", "monthly"):
                self.send_json(400, {"error": "Invalid dashboard period"})
                return
            with connect() as connection:
                connection.execute("INSERT INTO uploads (filename, stored_path, period) VALUES (?, ?, ?)", (name, str(stored), period))
            self.send_json(201, {"filename": name, "period": period, "message": "File uploaded securely"})
        else:
            self.send_error(404)

if __name__ == "__main__":
    init_db()
    with connect() as connection:
        if not connection.execute("SELECT 1 FROM admins WHERE username = 'admin'").fetchone():
            password = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(12)
            connection.execute("INSERT INTO admins (username, password_hash) VALUES (?, ?)", ("admin", hash_password(password)))
            print("Admin user initialized; set ADMIN_PASSWORD in the environment for a fixed password.")
    ensure_admin()
    print("Horizon Care running at http://%s:%d" % (HOST, PORT))
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
