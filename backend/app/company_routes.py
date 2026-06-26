from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Company

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("/")
def get_companies():
    db: Session = SessionLocal()
    try:
        companies = (
            db.query(Company)
            .order_by(Company.company_name.asc())
            .all()
        )

        result = [
            {
                "company_id": c.company_id,
                "company_name": c.company_name,
                "short_name": c.short_name or "",
                "company_type": c.company_type or "",
                "description": c.description or "",
                "is_custom": bool(c.is_custom),
            }
            for c in companies
        ]

        result.append(
            {
                "company_id": -1,
                "company_name": "Other...",
                "short_name": "",
                "company_type": "",
                "description": "",
                "is_custom": True,
            }
        )

        return result
    finally:
        db.close()


@router.post("/add")
def add_company(data: dict):
    db = SessionLocal()
    try:
        name = data.get("company_name", "").strip()

        if name == "":
            return {"success": False, "message": "Company name is required"}

        exists = (
            db.query(Company)
            .filter(Company.company_name == name)
            .first()
        )

        if exists:
            return {
                "success": True,
                "company_id": exists.company_id,
            }

        short = "".join([x[0] for x in name.split()]).upper()

        company = Company(
            company_name=name,
            short_name=short,
            company_type=data.get("company_type", ""),
            description=data.get("description", ""),
            is_custom=1,
        )

        db.add(company)
        db.commit()
        db.refresh(company)

        return {
            "success": True,
            "company_id": company.company_id,
        }
    finally:
        db.close()
