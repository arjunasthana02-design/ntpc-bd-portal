# NTPC BD Portal

Enterprise Business Development portal with admin login, employee dashboards, raw data submission and review, document editing, weekly/monthly reports, AI-assisted report generation, training documents, and PDF/DOCX export.

## Quick Start

### 1. Clone

```powershell
git clone https://github.com/arjunasthana02-design/ntpc-bd-portal.git
cd ntpc-bd-portal
```

### 2. Backend

```powershell
python -m venv backend\venv
backend\venv\Scripts\python.exe -m pip install -r requirements.txt
cd backend
venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend defaults to a local SQLite database at `backend/ntpc_bd_portal.db` and creates tables automatically.

To use MySQL instead, set `DATABASE_URL` before starting the backend:

```powershell
$env:DATABASE_URL="mysql+pymysql://USER:PASSWORD@localhost:3306/ntpc_bd_portal"
```

### 3. Frontend

Open `frontend/pages/login.html` in your browser.

Default admin login:

```text
Username: ankush
Password: NTPC@123
```

## Main Features

- Admin and employee login/registration
- Admin dashboard and employee dashboard
- Employee management and company assignment
- Raw data submission with text/file uploads
- Raw data repository with search, filters, editing, and download
- Review workflow with approve/reject/final status
- Word-style document editor with autosave and version snapshots
- Weekly and monthly report generation
- AI training document uploads
- AI-assisted grounded report drafts with deterministic fallback when Ollama is unavailable
- Export reports/documents to PDF and DOCX

## Optional Local AI

The app can call Ollama at `http://localhost:11434/api/generate` using model `qwen2.5:3b`. If Ollama is not running, report generation still works using the built-in rule-based grounded generator.

## API Docs

With the backend running, open:

```text
http://127.0.0.1:8000/docs
```

## Notes

- Uploaded files are stored under `uploads/`.
- CORS is enabled for local frontend usage.
- The frontend JavaScript expects the backend at `http://127.0.0.1:8000`.
