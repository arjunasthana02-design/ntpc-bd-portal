from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import DataSubmission
from app.reports.submissions import list_submissions, serialize_submission


router = APIRouter(prefix="/raw-documents", tags=["Raw Documents"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def raw_documents(
    q: str | None = None,
    company: str | None = None,
    project: str | None = None,
    topic: str | None = None,
    employee: str | None = None,
    business_avenue: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    return list_submissions(q, company, project, topic, employee, business_avenue, date_from, date_to, db)


@router.get("/search")
def search_raw_documents(
    q: str | None = None,
    company: str | None = None,
    project: str | None = None,
    topic: str | None = None,
    employee: str | None = None,
    business_avenue: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    return list_submissions(q, company, project, topic, employee, business_avenue, date_from, date_to, db)


@router.get("/{submission_id}")
def raw_document(submission_id: int, db: Session = Depends(get_db)):
    item = db.get(DataSubmission, submission_id)
    if not item:
        return {"detail": "Raw document not found"}
    return serialize_submission(item)
