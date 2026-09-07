# Horizon Care Hospital Dashboard

## Run locally

1. Install Python 3.8+.
2. Open PowerShell in this folder.
3. Run `python server.py`.
4. Open <http://localhost:5000>.

### Start without VS Code

Double-click [`start_dashboard.bat`](start_dashboard.bat). It starts the local server in a
minimized window and opens the dashboard in Chrome. VS Code can remain closed.

The server process must keep running while the dashboard is open because the login and
dashboard APIs are provided by `server.py`. To start it automatically when Windows starts,
create a shortcut to `start_dashboard.bat` and place that shortcut in
`Win + R` → `shell:startup`.

## Deploy publicly on Render

1. Create a GitHub repository and upload this project (do not upload `hospital.db`,
   `uploads/`, or server log files).
2. In Render, choose **New -> Blueprint** and select that repository.
3. Render will use [`render.yaml`](render.yaml), create an HTTPS URL, and start the server.
4. In Render's Environment page, set a strong `ADMIN_PASSWORD`, then redeploy.

The free Render filesystem is temporary, so uploaded reports and the SQLite database can
be lost when the service restarts or redeploys. For real hospital data, use persistent
storage or a managed database/object storage before production use.

On the first run, the server prints a generated admin password in the terminal. Use username `admin`, then keep that password private. To choose a password before first startup, set `ADMIN_PASSWORD` in the environment.

Uploaded Excel/CSV files are stored in `uploads/`; dashboard data and admin password hashes are stored in `hospital.db`. Passwords are never stored as plain text. This local server is a foundation for deployment; use HTTPS, environment secrets, backups, and a production database before exposing it to the internet.

## Dashboard workbook format

For each period, upload up to seven separate files. Select the `Daily`, `Weekly`, or `Monthly` button first; files uploaded afterward belong only to that period. Repeat the process for the other periods.

Use descriptive file names so the app can identify each source:

- `ADMISSION REPORT`: `S No., Doa, DOD, UHID, Patient Name, Doctor Name, Dept. Name, Panel Name, Service Final Amt, COMBINED, DATE`
- `DISCHARGE REPORT`: same columns as Admission Report
- `BILL REPORT`: `S No., Doa, DOD, UHID, Patient Name, Bill Date, Doctor Name, Dept. Name, Panel Name, Service Final Amt, DATE`
- `SERVICE REPORT`: `S No., Service Date, DOA, UHID, Patient Name, File Id, Doctor Name, Dept. Name, Panel Name, Service Name, Service Final Amt, Visit Type Name, DATE, COMBINED, SERVICE CATEGORY`
- `IPD LIST`: `S No., Name, Doctor Name, UHID, Doa, Dod, Panel Name, Room Category, packages`
- `HELPER SHEET`: `DATE, ICU Occupancy, NICU Occupancy, Ventilator Usage, Avg Rev/Patient, Bed Occupancy`

The Daily/Weekly/Monthly buttons switch between these independent file sets. Admission contributes count only; Discharge and Bill contribute revenue; Service contributes OPD count; IPD contributes active patients; Helper Sheet contributes occupancy and average revenue.

The daily dashboard keeps its existing chart layout. Weekly charts use the latest month in the Discharge Report and compare 1-10, 11-20, and 21-month-end slots; monthly charts aggregate that latest month. Weekly/monthly target-vs-actual uses the constant monthly target of INR 5 crore.

Weekly period data can be switched by month. Period dashboard counts use report rows (rather than deduplicated UHIDs) so report totals reconcile directly with the source files.
