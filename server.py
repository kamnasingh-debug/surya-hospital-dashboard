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
LOGIN_ATTEMPTS = {}
SESSION_TTL = 8 * 60 * 60
MAX_UPLOAD_SIZE = 25 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {".xlsx", ".xls", ".csv"}
STATIC_FILES = {"index.html", "app.js", "styles.css", "xlsx.full.min.js"}
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
    try:
        salt, expected = stored.split(":", 1)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 240000).hex()
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)

def init_db():
    UPLOAD_DIR.mkdir(exist_ok=True)
    with connect() as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL)")
        connection.execute("CREATE TABLE IF NOT EXISTS uploads (id INTEGER PRIMARY KEY, filename TEXT NOT NULL, stored_path TEXT NOT NULL, period TEXT NOT NULL DEFAULT 'daily', uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP)")
        connection.execute("CREATE TABLE IF NOT EXISTS saved_dashboards (id INTEGER PRIMARY KEY, name TEXT NOT NULL, dashboard_type TEXT NOT NULL CHECK (dashboard_type IN ('daily', 'monthly')), period_label TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
        columns = [row[1] for row in connection.execute("PRAGMA table_info(uploads)")]
        if "period" not in columns:
            connection.execute("ALTER TABLE uploads ADD COLUMN period TEXT NOT NULL DEFAULT 'daily'")
        if not connection.execute("SELECT 1 FROM admins WHERE username = 'admin'").fetchone():
            password = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(12)
            if os.environ.get("ENVIRONMENT", "development").lower() != "production":
                print("First-run admin credentials: username=admin password=" + password)
            connection.execute("INSERT INTO admins VALUES (?, ?)", ("admin", hash_password(password)))

def ensure_admin():
    configured_password = os.environ.get("ADMIN_PASSWORD")
    with connect() as connection:
        admin = connection.execute("SELECT 1 FROM admins WHERE username = 'admin'").fetchone()
        if admin:
            if configured_password:
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
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_security_headers()
        self.send_header("Content-Length", str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, file_path):
        if not file_path.is_file():
            self.send_error(404)
            return
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(file_path.name)[0] or "application/octet-stream")
        self.send_header("Cache-Control", "no-store" if file_path.name in {"index.html", "app.js", "styles.css"} else "public, max-age=3600")
        self.send_security_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_download(self, contents, filename):
        body = contents.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="%s"' % filename)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; object-src 'none'")

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid content length")
        if length > 2 * 1024 * 1024:
            raise ValueError("Request body is too large")
        return json.loads(self.rfile.read(length) or b"{}")

    def read_upload(self):
        content_type = self.headers.get("Content-Type", "")
        if not content_type.lower().startswith("multipart/form-data"):
            return None
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_UPLOAD_SIZE:
            return None
        raw = b"Content-Type: " + content_type.encode("latin-1") + b"\r\nMIME-Version: 1.0\r\n\r\n"
        message = BytesParser(policy=policy.default).parsebytes(raw + self.rfile.read(length))
        for part in message.walk():
            if part.is_multipart():
                continue
            filename = part.get_filename()
            if filename:
                return filename, part.get_payload(decode=True) or b""
        return None

    def client_key(self):
        return self.client_address[0]

    def login_is_rate_limited(self):
        now = time.time()
        attempts = [timestamp for timestamp in LOGIN_ATTEMPTS.get(self.client_key(), []) if now - timestamp < 300]
        LOGIN_ATTEMPTS[self.client_key()] = attempts
        return len(attempts) >= 5

    def record_login_failure(self):
        LOGIN_ATTEMPTS.setdefault(self.client_key(), []).append(time.time())

    def user(self):
        parsed = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        token = parsed.get("session")
        session = SESSIONS.get(token.value) if token else None
        if not session:
            return None
        if session["expires"] <= time.time():
            SESSIONS.pop(token.value, None)
            return None
        return session["username"]

    def require_auth(self):
        if not self.user():
            self.send_json(401, {"error": "Authentication required"})
            return False
        return True

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            self.send_json(200, {"status": "ok"})
        elif path == "/" or path.lstrip("/") in STATIC_FILES:
            file_name = "index.html" if path == "/" else path.lstrip("/")
            self.send_file(ROOT / file_name)
        elif path == "/api/me":
            self.send_json(200 if self.user() else 401, {"username": self.user()})
        elif path == "/api/dashboard" and self.require_auth():
            self.send_json(200, DEFAULT_DATA)
        elif path == "/api/saved-dashboards" and self.require_auth():
            with connect() as connection:
                rows = connection.execute(
                    "SELECT id, name, dashboard_type, period_label, created_at FROM saved_dashboards ORDER BY created_at DESC, id DESC"
                ).fetchall()
            self.send_json(200, [dict(row) for row in rows])
        elif path.startswith("/api/saved-dashboards/") and self.require_auth():
            try:
                dashboard_id = int(path.rsplit("/", 1)[1])
            except ValueError:
                self.send_json(400, {"error": "Invalid saved dashboard id"})
                return
            with connect() as connection:
                row = connection.execute("SELECT * FROM saved_dashboards WHERE id = ?", (dashboard_id,)).fetchone()
            if not row:
                self.send_json(404, {"error": "Saved dashboard not found"})
                return
            payload = dict(row)
            payload["snapshot"] = json.loads(payload.pop("snapshot_json"))
            self.send_json(200, payload)
        elif path == "/api/download-dashboard" and self.require_auth():
            self.send_download((ROOT / "index.html").read_text(encoding="utf-8"), "SURYA-Hospital-Dashboard.html")
        else:
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/login":
            if self.login_is_rate_limited():
                self.send_json(429, {"error": "Too many login attempts. Try again later."},
                               {"Retry-After": "300"})
                return
            try:
                data = self.read_json()
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"error": "Invalid JSON request"})
                return
            username = str(data.get("username", "")).strip()
            password = data.get("password", "")
            if not isinstance(password, str) or not username or not password:
                self.record_login_failure()
                self.send_json(401, {"error": "Invalid username or password"})
                return
            with connect() as connection:
                admin = connection.execute("SELECT * FROM admins WHERE username = ?", (username,)).fetchone()
            if not admin or not verify_password(password, admin["password_hash"]):
                self.record_login_failure()
                self.send_json(401, {"error": "Invalid username or password"})
                return
            token = secrets.token_urlsafe(32)
            SESSIONS[token] = {"username": admin["username"], "expires": time.time() + SESSION_TTL}
            secure = "; Secure" if os.environ.get("HTTPS", "").lower() == "true" else ""
            cookie = "session=%s; HttpOnly; SameSite=Strict; Path=/; Max-Age=%d%s" % (token, SESSION_TTL, secure)
            self.send_json(200, {"username": admin["username"]}, {"Set-Cookie": cookie})
        elif path == "/api/logout":
            parsed = cookies.SimpleCookie(self.headers.get("Cookie", ""))
            token = parsed.get("session")
            if token:
                SESSIONS.pop(token.value, None)
            self.send_json(200, {"ok": True}, {"Set-Cookie": "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"})
        elif path == "/api/download-dashboard" and self.require_auth():
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self.send_json(400, {"error": "Invalid content length"})
                return
            if length <= 0 or length > 10 * 1024 * 1024:
                self.send_json(413, {"error": "Dashboard export is too large"})
                return
            raw_body = self.rfile.read(length)
            content_type = self.headers.get("Content-Type", "").lower()
            if "application/x-www-form-urlencoded" in content_type:
                from urllib.parse import parse_qs
                try:
                    contents = parse_qs(raw_body.decode("utf-8"), keep_blank_values=True).get("html", [""])[0]
                except (UnicodeDecodeError, ValueError):
                    self.send_json(400, {"error": "Dashboard export must be valid UTF-8"})
                    return
            else:
                try:
                    contents = raw_body.decode("utf-8")
                except UnicodeDecodeError:
                    self.send_json(400, {"error": "Dashboard export must be valid UTF-8"})
                    return
            if not contents:
                self.send_json(400, {"error": "Dashboard export is empty"})
                return
            self.send_download(contents, "SURYA-Hospital-Dashboard.html")
        elif path == "/api/upload" and self.require_auth():
            period = self.headers.get("X-Dashboard-Period", "daily").lower()
            if period not in ("daily", "weekly", "monthly"):
                self.send_json(400, {"error": "Invalid dashboard period"})
                return
            upload = self.read_upload()
            if not upload:
                self.send_json(400, {"error": "A valid multipart file is required"})
                return
            name, contents = upload
            name = Path(name).name
            if Path(name).suffix.lower() not in ALLOWED_UPLOAD_EXTENSIONS or not contents:
                self.send_json(400, {"error": "Only non-empty .xlsx, .xls, or .csv files are supported"})
                return
            stored = UPLOAD_DIR / (secrets.token_hex(8) + "_" + name)
            stored.write_bytes(contents)
            with connect() as connection:
                connection.execute("INSERT INTO uploads (filename, stored_path, period) VALUES (?, ?, ?)", (name, str(stored), period))
            self.send_json(201, {"filename": name, "period": period, "message": "File uploaded securely"})
        elif path == "/api/saved-dashboards" and self.require_auth():
            try:
                data = self.read_json()
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"error": "Invalid JSON request"})
                return
            name = str(data.get("name", "")).strip()
            dashboard_type = str(data.get("dashboard_type", "")).lower()
            period_label = str(data.get("period_label", "")).strip()
            snapshot = data.get("snapshot")
            if not name or len(name) > 120 or dashboard_type not in ("daily", "monthly") or not period_label or not isinstance(snapshot, dict):
                self.send_json(400, {"error": "Name, dashboard type, period label, and snapshot are required"})
                return
            snapshot_json = json.dumps(snapshot, separators=(",", ":"))
            if len(snapshot_json.encode("utf-8")) > 2 * 1024 * 1024:
                self.send_json(413, {"error": "Saved dashboard snapshot is too large"})
                return
            with connect() as connection:
                cursor = connection.execute(
                    "INSERT INTO saved_dashboards (name, dashboard_type, period_label, snapshot_json) VALUES (?, ?, ?, ?)",
                    (name, dashboard_type, period_label, snapshot_json),
                )
                dashboard_id = cursor.lastrowid
            self.send_json(201, {"id": dashboard_id, "name": name, "dashboard_type": dashboard_type, "period_label": period_label})
        else:
            self.send_error(404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/saved-dashboards/"):
            self.send_error(404)
            return
        if not self.require_auth():
            return
        try:
            dashboard_id = int(path.rsplit("/", 1)[1])
        except ValueError:
            self.send_json(400, {"error": "Invalid saved dashboard id"})
            return
        with connect() as connection:
            deleted = connection.execute("DELETE FROM saved_dashboards WHERE id = ?", (dashboard_id,)).rowcount
        if not deleted:
            self.send_json(404, {"error": "Saved dashboard not found"})
            return
        self.send_json(200, {"ok": True})

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
