from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text

from app.database import Base, engine, SessionLocal
from app.login import router as login_router
from app.models import User
from app.employees import router as employees_router
from app.dashboard import router as dashboard_router
from app.company_routes import router as company_router

from app.reports.router import router as reports_router
from app.raw_documents import router as raw_documents_router


app = FastAPI(
    title="NTPC BD Portal"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


def ensure_schema():
    db = SessionLocal()
    try:
        dialect = db.bind.dialect.name
        company_columns = {
            row[1] if dialect == "sqlite" else row[0]
            for row in (
                db.execute(text("PRAGMA table_info(companies)")).fetchall()
                if dialect == "sqlite"
                else db.execute(text("SHOW COLUMNS FROM companies")).fetchall()
            )
        }
        additions = {
            "short_name": "VARCHAR(50)",
            "company_type": "VARCHAR(100)",
            "description": "TEXT",
            "is_custom": "INTEGER DEFAULT 0",
        }
        for column, definition in additions.items():
            if column not in company_columns:
                db.execute(text(f"ALTER TABLE companies ADD COLUMN {column} {definition}"))
        db.commit()
    finally:
        db.close()


ensure_schema()


def seed_admin():

    db = SessionLocal()

    try:

        existing = (
            db.query(User)
            .filter(User.username == "ankush")
            .first()
        )

        if not existing:

            admin = User(
                full_name="Ankush",
                username="ankush",
                password="NTPC@123",
                role="ADMIN",
                status="APPROVED",
            )

            db.add(admin)
            db.commit()

    finally:
        db.close()


seed_admin()


app.include_router(login_router)
app.include_router(employees_router)
app.include_router(company_router)
app.include_router(reports_router)
app.include_router(raw_documents_router)
app.include_router(dashboard_router)


@app.get("/")
def root():
    return RedirectResponse(url="/pages/login.html")


@app.get("/api/health")
def health():
    return {
        "message": "NTPC BD Portal Backend Running",
        "version": "3.0",
        "features": [
            "Raw Documents",
            "Document Editor",
            "Word Editor",
            "Weekly Reports",
            "Monthly Reports",
            "AI Ready",
            "Document Storage"
        ],
    }


FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
