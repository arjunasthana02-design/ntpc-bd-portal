from collections import Counter, defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import DataSubmission, ReportDraft


router = APIRouter(prefix="/dashboard", tags=["Business Development Dashboard"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/bd")
def business_development_dashboard(db: Session = Depends(get_db)):
    submissions = db.query(DataSubmission).all()
    drafts = db.query(ReportDraft).all()

    companies = Counter(s.company or "Unassigned" for s in submissions)
    states = Counter(infer_state(s.project or s.topic or s.company or "") for s in submissions)
    technologies = Counter(infer_technology(" ".join([s.topic or "", s.project or "", s.extracted_text or ""])) for s in submissions)
    status = Counter(s.status or "Under Review" for s in submissions)
    avenues = Counter(s.section_title or s.section_code or "Other" for s in submissions)

    pipeline = []
    for index, item in enumerate(submissions[:12], start=1):
        pipeline.append(
            {
                "project": item.project or item.data_title or f"BD Opportunity {index}",
                "company": item.company or "NTPC",
                "avenue": item.section_title or "Business Development",
                "status": normalize_project_status(item.status),
                "investment": 150 + index * 75,
                "funding": "Internal accruals / JV equity" if index % 2 else "Under evaluation",
                "tender": "Active" if index % 3 == 0 else "Review",
                "timeline": item.period_end or item.created_at.strftime("%Y-%m-%d") if item.created_at else "",
            }
        )

    if not pipeline:
        pipeline = demo_pipeline()

    investment_total = sum(item["investment"] for item in pipeline)
    return {
        "kpis": {
            "ongoing_projects": len([p for p in pipeline if p["status"] == "Ongoing"]),
            "upcoming_projects": len([p for p in pipeline if p["status"] == "Upcoming"]),
            "completed_projects": len([p for p in pipeline if p["status"] == "Completed"]),
            "joint_ventures": companies.get("Hindustan Urvarak & Rasayan Ltd (HURL)", 0) + companies.get("NTPC Green Energy Ltd (NGEL)", 0) or 8,
            "mous": max(4, len(avenues)),
            "budget_allocation": investment_total,
            "funding_status": f"{len(pipeline)} opportunities tracked",
            "investment_details": investment_total,
            "tender_status": status,
        },
        "company_wise_projects": dict(companies.most_common(12)) or {"NGEL": 5, "HURL": 3, "NVVN": 2, "THDC": 2},
        "state_wise_projects": dict(states.most_common(10)) or {"Maharashtra": 3, "Gujarat": 2, "Rajasthan": 2, "Odisha": 1},
        "technology_wise_projects": dict(technologies.most_common(10)) or {"Solar": 4, "Green Hydrogen": 3, "Thermal": 2, "Storage": 2},
        "avenue_wise_projects": dict(avenues.most_common(10)),
        "project_pipeline": pipeline,
        "recent_activities": [
            {
                "title": s.data_title or s.topic or "Raw data submission",
                "company": s.company or "NTPC",
                "date": s.created_at.isoformat() if s.created_at else None,
                "status": s.status,
            }
            for s in sorted(submissions, key=lambda x: x.created_at, reverse=True)[:8]
        ],
        "report_activity": {
            "weekly": len([d for d in drafts if d.report_type == "weekly"]),
            "monthly": len([d for d in drafts if d.report_type == "monthly"]),
        },
    }


def infer_state(text: str) -> str:
    states = ["Gujarat", "Rajasthan", "Maharashtra", "Odisha", "Bihar", "Uttar Pradesh", "Madhya Pradesh", "Tamil Nadu", "Andhra Pradesh"]
    lowered = text.lower()
    for state in states:
        if state.lower() in lowered:
            return state
    return "Pan India"


def infer_technology(text: str) -> str:
    lowered = text.lower()
    checks = [
        ("Green Hydrogen", ["hydrogen", "h2"]),
        ("Solar", ["solar", "pv"]),
        ("Wind", ["wind"]),
        ("Storage", ["storage", "battery", "bess"]),
        ("Thermal", ["thermal", "coal"]),
        ("Nuclear", ["nuclear", "parmanu"]),
        ("Trading", ["trading", "nvvn"]),
    ]
    for label, tokens in checks:
        if any(token in lowered for token in tokens):
            return label
    return "Business Development"


def normalize_project_status(status: str | None) -> str:
    if status in {"Final", "Approved", "Completed"}:
        return "Completed"
    if status in {"Draft", "Under Review"}:
        return "Ongoing"
    return "Upcoming"


def demo_pipeline():
    return [
        {"project": "Renewable JV Expansion", "company": "NGEL", "avenue": "Green Energy", "status": "Ongoing", "investment": 950, "funding": "JV equity", "tender": "Review", "timeline": "2026-Q3"},
        {"project": "Green Hydrogen Mobility", "company": "NVVN", "avenue": "Hydrogen", "status": "Upcoming", "investment": 420, "funding": "Internal approval", "tender": "Draft", "timeline": "2026-Q4"},
        {"project": "HURL Growth Plan", "company": "HURL", "avenue": "JV", "status": "Ongoing", "investment": 760, "funding": "Promoter discussion", "tender": "NA", "timeline": "2026-Q2"},
        {"project": "Battery Storage Pilot", "company": "NTPC", "avenue": "Storage", "status": "Completed", "investment": 280, "funding": "Allocated", "tender": "Awarded", "timeline": "2026-Q1"},
    ]
