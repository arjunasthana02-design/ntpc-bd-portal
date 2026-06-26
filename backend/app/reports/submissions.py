from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import DataSubmission

from .files import SUBMISSION_DIR, extract_text_from_path, relative_path, resolve_stored_path, store_upload


router = APIRouter(tags=["Report Submissions"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_submission(item: DataSubmission) -> dict:
    return {
        "submission_id": item.submission_id,
        "id": str(item.submission_id),
        "report_type": item.report_type,
        "data_title": item.data_title,
        "title": item.data_title or item.file_name,
        "period_start": item.period_start,
        "period_end": item.period_end,
        "week_label": item.week_label,
        "section_code": item.section_code,
        "section_title": item.section_title,
        "company": item.company,
        "project": item.project,
        "topic": item.topic,
        "subtopic": item.subtopic,
        "source_type": item.source_type,
        "file_name": item.file_name,
        "file_names": item.file_names,
        "stored_path": item.stored_path,
        "stored_paths": item.stored_paths,
        "extracted_text": item.extracted_text,
        "status": item.status,
        "submitted_by": item.submitted_by,
        "review_note": item.review_note,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("/summary")
def report_summary(db: Session = Depends(get_db)):
    submissions = db.query(DataSubmission).all()
    return {
        "total_submissions": len(submissions),
        "review_submissions": len([s for s in submissions if s.status == "Under Review"]),
        "approved_submissions": len([s for s in submissions if s.status == "Approved"]),
        "weekly_entries": len([s for s in submissions if (s.report_type or "").upper() == "WEEKLY"]),
        "monthly_entries": len([s for s in submissions if (s.report_type or "").upper() == "MONTHLY"]),
        "raw_entries": len([s for s in submissions if (s.report_type or "").upper() == "RAW"]),
        "final_entries": len([s for s in submissions if s.status == "Final"]),
    }


@router.get("/submissions")
def list_submissions(
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
    query = db.query(DataSubmission)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                DataSubmission.data_title.like(like),
                DataSubmission.company.like(like),
                DataSubmission.project.like(like),
                DataSubmission.topic.like(like),
                DataSubmission.extracted_text.like(like),
            )
        )
    if company:
        query = query.filter(DataSubmission.company.like(f"%{company}%"))
    if project:
        query = query.filter(DataSubmission.project.like(f"%{project}%"))
    if topic:
        query = query.filter(DataSubmission.topic.like(f"%{topic}%"))
    if employee:
        query = query.filter(DataSubmission.submitted_by.like(f"%{employee}%"))
    if business_avenue:
        query = query.filter(DataSubmission.section_title.like(f"%{business_avenue}%"))
    if date_from:
        query = query.filter(DataSubmission.created_at >= date_from)
    if date_to:
        query = query.filter(DataSubmission.created_at <= f"{date_to} 23:59:59")
    return [serialize_submission(item) for item in query.order_by(DataSubmission.created_at.desc()).limit(500).all()]


@router.post("/submissions")
async def create_submission(
    report_type: Annotated[str, Form()] = "RAW",
    data_title: Annotated[str, Form()] = "",
    period_start: Annotated[str, Form()] = "",
    period_end: Annotated[str, Form()] = "",
    week_label: Annotated[str, Form()] = "",
    section_code: Annotated[str, Form()] = "OTHER",
    section_title: Annotated[str, Form()] = "Other",
    company: Annotated[str, Form()] = "",
    project: Annotated[str, Form()] = "",
    topic: Annotated[str, Form()] = "",
    subtopic: Annotated[str, Form()] = "",
    source_type: Annotated[str, Form()] = "File Upload",
    extracted_text: Annotated[str, Form()] = "",
    submitted_by: Annotated[str, Form()] = "",
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    if not data_title and not files:
        raise HTTPException(status_code=400, detail="Data title or file is required")

    stored_paths = []
    file_names = []
    extracted_parts = [extracted_text.strip()] if extracted_text else []
    for upload in files:
        stored = await store_upload(upload, SUBMISSION_DIR)
        stored_paths.append(relative_path(stored) or "")
        file_names.append(upload.filename or stored.name)
        extracted = extract_text_from_path(stored)
        if extracted:
            extracted_parts.append(f"File: {upload.filename}\n{extracted}")

    item = DataSubmission(
        report_type=report_type,
        data_title=data_title or (file_names[0] if file_names else "Untitled Submission"),
        period_start=period_start,
        period_end=period_end,
        week_label=week_label,
        section_code=section_code,
        section_title=section_title,
        company=company,
        project=project,
        topic=topic or data_title,
        subtopic=subtopic,
        source_type=source_type,
        file_name=file_names[0] if file_names else None,
        file_names="; ".join(file_names) if file_names else None,
        stored_path=stored_paths[0] if stored_paths else None,
        stored_paths=";".join(stored_paths) if stored_paths else None,
        extracted_text="\n\n".join(part for part in extracted_parts if part),
        status="Under Review",
        submitted_by=submitted_by,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_submission(item)


@router.put("/submissions/{submission_id}")
def update_submission(submission_id: int, payload: dict, db: Session = Depends(get_db)):
    item = db.get(DataSubmission, submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    if "text_data" in payload and "extracted_text" not in payload:
        payload["extracted_text"] = payload["text_data"]
    for field in ["report_type", "period_start", "period_end", "data_title", "company", "project", "topic", "subtopic", "section_code", "section_title", "source_type", "submitted_by", "extracted_text", "status", "review_note"]:
        if field in payload:
            setattr(item, field, payload[field])
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return serialize_submission(item)


@router.patch("/submissions/{submission_id}/review")
def review_submission(submission_id: int, payload: dict, db: Session = Depends(get_db)):
    item = db.get(DataSubmission, submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    status = payload.get("status")
    if status not in {"Under Review", "Approved", "Rejected", "Final"}:
        raise HTTPException(status_code=400, detail="Invalid review status")
    item.status = status
    item.review_note = payload.get("review_note", item.review_note)
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return serialize_submission(item)


@router.delete("/submissions/{submission_id}")
def delete_submission(submission_id: int, db: Session = Depends(get_db)):
    item = db.get(DataSubmission, submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    db.delete(item)
    db.commit()
    return {"deleted": True, "submission_id": submission_id}


@router.get("/submissions/{submission_id}")
def get_submission(submission_id: int, db: Session = Depends(get_db)):
    item = db.get(DataSubmission, submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    return serialize_submission(item)


@router.get("/submissions/{submission_id}/download")
def download_submission(submission_id: int, db: Session = Depends(get_db)):
    item = db.get(DataSubmission, submission_id)
    if not item or not item.stored_path:
        raise HTTPException(status_code=404, detail="Uploaded file not found")
    path = resolve_stored_path(item.stored_path)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Uploaded file missing on disk")
    return FileResponse(path, filename=item.file_name or path.name)
