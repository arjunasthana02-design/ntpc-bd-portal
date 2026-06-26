from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ReportEntry

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/")
def list_documents():

    db: Session = SessionLocal()

    rows = (
        db.query(ReportEntry)
        .order_by(ReportEntry.updated_at.desc())
        .all()
    )

    result = []

    for row in rows:

        result.append(
            {
                "id": row.entry_id,
                "title": row.report_title,
                "topic": row.topic,
                "status": row.status,
                "updated_at": row.updated_at,
            }
        )

    db.close()

    return result


@router.get("/{doc_id}")
def open_document(doc_id: int):

    db = SessionLocal()

    row = (
        db.query(ReportEntry)
        .filter(
            ReportEntry.entry_id == doc_id
        )
        .first()
    )

    db.close()

    return row


@router.delete("/{doc_id}")
def delete_document(doc_id: int):

    db = SessionLocal()

    row = (
        db.query(ReportEntry)
        .filter(
            ReportEntry.entry_id == doc_id
        )
        .first()
    )

    if row:

        db.delete(row)

        db.commit()

    db.close()

    return {
        "success": True,
    }