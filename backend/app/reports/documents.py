import html
import re
import zipfile
from datetime import datetime
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import AITrainingDocument, DataSubmission, Document, DocumentVersion, ReportDraft

from .ai import generate_grounded_report
from .files import TRAINING_DIR, dumps_ids, extract_text_from_path, loads_ids, relative_path, resolve_stored_path, store_upload


router = APIRouter(tags=["Reports and AI Training"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_draft(item: ReportDraft) -> dict:
    return {
        "draft_id": item.draft_id,
        "id": str(item.draft_id),
        "report_type": item.report_type,
        "title": item.title,
        "period_start": item.period_start,
        "period_end": item.period_end,
        "month": item.month,
        "year": item.year,
        "html_content": item.html_content,
        "html": item.html_content,
        "plain_text": item.plain_text,
        "text": item.plain_text,
        "source_submission_ids": loads_ids(item.source_submission_ids),
        "source_training_ids": loads_ids(item.source_training_ids),
        "generation_mode": item.generation_mode,
        "status": item.status,
        "created_by": item.created_by,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def serialize_training(item: AITrainingDocument) -> dict:
    return {
        "training_id": item.training_id,
        "id": str(item.training_id),
        "title": item.title,
        "category": item.category,
        "company": item.company,
        "project": item.project,
        "topic": item.topic,
        "business_avenue": item.business_avenue,
        "file_name": item.file_name,
        "stored_path": item.stored_path,
        "extracted_text": item.extracted_text,
        "uploaded_by": item.uploaded_by,
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def serialize_document(item: Document) -> dict:
    return {
        "document_id": item.document_id,
        "id": str(item.document_id),
        "title": item.title,
        "company": item.company,
        "project": item.project,
        "report_type": item.report_type,
        "document_type": item.document_type,
        "period_start": item.period_start,
        "period_end": item.period_end,
        "html_content": item.html_content,
        "html": item.html_content,
        "plain_text": item.plain_text,
        "text": item.plain_text,
        "owner": item.owner,
        "source_submission_id": item.source_submission_id,
        "parent_document_id": item.parent_document_id,
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def apply_document_payload(doc: Document, payload: dict) -> Document:
    doc.title = payload.get("title") or doc.title or "Untitled Document"
    doc.company = payload.get("company") or doc.company or "NTPC"
    doc.project = payload.get("project") or doc.project or "Business Development"
    doc.report_type = payload.get("report_type") or doc.report_type or "RAW"
    doc.document_type = payload.get("document_type") or doc.document_type or doc.report_type
    doc.period_start = payload.get("period_start", doc.period_start)
    doc.period_end = payload.get("period_end", doc.period_end)
    doc.html_content = payload.get("html_content", payload.get("html", doc.html_content or ""))
    doc.plain_text = payload.get("plain_text", payload.get("text", doc.plain_text or ""))
    doc.owner = payload.get("owner", doc.owner)
    doc.source_submission_id = payload.get("source_submission_id", doc.source_submission_id)
    doc.parent_document_id = payload.get("parent_document_id", doc.parent_document_id)
    doc.status = payload.get("status", doc.status or "Draft")
    doc.updated_at = datetime.utcnow()
    return doc


def html_to_text(value: str | None) -> str:
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", value or "", flags=re.I)
    text = re.sub(r"</\s*(p|div|li|h[1-6])\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(re.sub(r"\n{3,}", "\n\n", text)).strip()


def create_generated_document(source: Document, report_type: str, db: Session) -> Document:
    generated = generate_grounded_report(
        report_type=report_type,
        title=(
            "KEY ACTIVITIES OF BUSINESS DEVELOPMENT"
            if report_type == "monthly"
            else "SNAPSHOT OF BUSINESS DEVELOPMENT ACTIVITIES"
        ),
        submissions=[],
        training_docs=db.query(AITrainingDocument).filter(AITrainingDocument.status == "Active").limit(8).all(),
        period_start=source.period_start,
        period_end=source.period_end,
        prefer_ollama=False,
    )
    source_text = source.plain_text or html_to_text(source.html_content)
    body = generated["html"]
    if source_text:
        body = body.replace(
            "</div>",
            f'<div class="report-section-title">Source Document</div><div>{html.escape(source_text)}</div></div>',
            1,
        )
    doc = Document(
        title=f"{source.title} - {report_type.title()} Report",
        company=source.company,
        project=source.project,
        report_type=report_type.upper(),
        document_type=report_type.upper(),
        period_start=source.period_start,
        period_end=source.period_end,
        html_content=body,
        plain_text=html_to_text(body),
        owner=source.owner,
        parent_document_id=source.document_id,
        status="Draft",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def build_docx(title: str, body: str) -> bytes:
    paragraphs = [title, *[line for line in (body or "").splitlines() if line.strip()]]
    document_xml = "".join(
        f"<w:p><w:r><w:t>{html.escape(paragraph)}</w:t></w:r></w:p>"
        for paragraph in paragraphs
    )
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""
    document = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>{document_xml}<w:sectPr/></w:body>
</w:document>"""
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def safe_filename(value: str, suffix: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", value or "document").strip("_") or "document"
    return f"{stem}.{suffix}"


@router.post("/generate")
def generate_report(payload: dict, db: Session = Depends(get_db)):
    report_type = (payload.get("report_type") or "weekly").lower()
    title = payload.get("title") or (
        "KEY ACTIVITIES OF BUSINESS DEVELOPMENT" if report_type == "monthly" else "SNAPSHOT OF BUSINESS DEVELOPMENT ACTIVITIES"
    )
    submission_ids = [int(value) for value in payload.get("submission_ids", [])]
    training_ids = [int(value) for value in payload.get("training_ids", [])]

    submissions = db.query(DataSubmission).filter(DataSubmission.submission_id.in_(submission_ids)).all() if submission_ids else []
    training_query = db.query(AITrainingDocument).filter(AITrainingDocument.status == "Active")
    if training_ids:
        training_query = training_query.filter(AITrainingDocument.training_id.in_(training_ids))
    training_docs = training_query.order_by(AITrainingDocument.created_at.desc()).limit(12).all()

    generated = generate_grounded_report(
        report_type=report_type,
        title=title,
        submissions=submissions,
        training_docs=training_docs,
        period_start=payload.get("period_start"),
        period_end=payload.get("period_end"),
        month=payload.get("month"),
        year=payload.get("year"),
        prefer_ollama=bool(payload.get("use_ollama", True)),
    )
    draft = ReportDraft(
        report_type=report_type,
        title=title,
        period_start=payload.get("period_start"),
        period_end=payload.get("period_end"),
        month=payload.get("month"),
        year=payload.get("year"),
        html_content=generated["html"],
        plain_text=generated["text"],
        source_submission_ids=dumps_ids([item.submission_id for item in submissions]),
        source_training_ids=dumps_ids([item.training_id for item in training_docs]),
        generation_mode=generated["generation_mode"],
        created_by=payload.get("created_by"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return serialize_draft(draft)


@router.get("/drafts")
def list_drafts(report_type: str | None = None, db: Session = Depends(get_db)):
    query = db.query(ReportDraft)
    if report_type:
        query = query.filter(ReportDraft.report_type == report_type.lower())
    return [serialize_draft(item) for item in query.order_by(ReportDraft.updated_at.desc()).limit(200).all()]


@router.get("/drafts/{draft_id}")
def get_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = db.get(ReportDraft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Report draft not found")
    return serialize_draft(draft)


@router.put("/drafts/{draft_id}")
def update_draft(draft_id: int, payload: dict, db: Session = Depends(get_db)):
    draft = db.get(ReportDraft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Report draft not found")
    draft.title = payload.get("title", draft.title)
    draft.html_content = payload.get("html_content", payload.get("html", draft.html_content))
    draft.plain_text = payload.get("plain_text", payload.get("text", draft.plain_text))
    draft.status = payload.get("status", draft.status)
    draft.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(draft)
    return serialize_draft(draft)


@router.delete("/drafts/{draft_id}")
def delete_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = db.get(ReportDraft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Report draft not found")
    db.delete(draft)
    db.commit()
    return {"deleted": True, "draft_id": draft_id}


@router.get("/documents")
def list_documents(q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Document)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Document.title.like(like),
                Document.company.like(like),
                Document.project.like(like),
                Document.plain_text.like(like),
            )
        )
    return [serialize_document(item) for item in query.order_by(Document.updated_at.desc()).limit(300).all()]


@router.post("/documents")
def create_document(payload: dict, db: Session = Depends(get_db)):
    doc = Document(
        title=payload.get("title") or "Untitled Document",
        company=payload.get("company") or "NTPC",
        project=payload.get("project") or "Business Development",
        report_type=payload.get("report_type") or "RAW",
        document_type=payload.get("document_type") or "REPORT",
        html_content=payload.get("html_content") or payload.get("html") or "",
        plain_text=payload.get("plain_text") or payload.get("text") or "",
        owner=payload.get("owner"),
        status=payload.get("status") or "Draft",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return serialize_document(doc)


@router.get("/documents/{document_id}")
def get_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return serialize_document(doc)


@router.put("/documents/{document_id}")
def update_document(document_id: int, payload: dict, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.add(DocumentVersion(
        document_id=document_id,
        html_content=doc.html_content,
        plain_text=doc.plain_text,
        changed_by=payload.get("owner"),
        change_note="Manual save",
    ))
    apply_document_payload(doc, payload)
    db.commit()
    db.refresh(doc)
    return serialize_document(doc)


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).delete()
    db.delete(doc)
    db.commit()
    return {"deleted": True, "document_id": document_id}


@router.post("/documents/{document_id}/autosave")
def autosave_document(document_id: int, payload: dict, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    version = DocumentVersion(
        document_id=document_id,
        html_content=doc.html_content,
        plain_text=doc.plain_text,
        changed_by=payload.get("changed_by"),
        change_note="Autosave snapshot",
    )
    db.add(version)
    doc.html_content = payload.get("html_content", payload.get("html", doc.html_content))
    doc.plain_text = payload.get("plain_text", payload.get("text", doc.plain_text))
    doc.updated_at = datetime.utcnow()
    db.commit()
    return {"document_id": document_id, "saved": True}


@router.post("/ai/generate")
def generate_ai_from_document(payload: dict, db: Session = Depends(get_db)):
    doc = db.get(Document, int(payload.get("document_id") or 0))
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    generated = generate_grounded_report(
        report_type=(doc.report_type or "weekly").lower(),
        title=doc.title,
        submissions=[],
        training_docs=db.query(AITrainingDocument).filter(AITrainingDocument.status == "Active").limit(8).all(),
        period_start=doc.period_start,
        period_end=doc.period_end,
        prefer_ollama=bool(payload.get("use_ollama", True)),
    )
    source = doc.plain_text or html_to_text(doc.html_content)
    doc.html_content = generated["html"] if not source else f'{generated["html"]}<hr><h3>Current Draft Context</h3><p>{html.escape(source)}</p>'
    doc.plain_text = html_to_text(doc.html_content)
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return serialize_document(doc)


@router.post("/weekly/generate/{document_id}")
def generate_weekly_document(document_id: int, db: Session = Depends(get_db)):
    source = db.get(Document, document_id)
    if not source:
        raise HTTPException(status_code=404, detail="Document not found")
    return serialize_document(create_generated_document(source, "weekly", db))


@router.post("/monthly/generate/{document_id}")
def generate_monthly_document(document_id: int, db: Session = Depends(get_db)):
    source = db.get(Document, document_id)
    if not source:
        raise HTTPException(status_code=404, detail="Document not found")
    return serialize_document(create_generated_document(source, "monthly", db))


@router.get("/export/pdf/{document_id}")
def export_document_pdf(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF export dependency missing: {exc}") from exc

    buffer = BytesIO()
    pdf = SimpleDocTemplate(buffer, pagesize=A4, title=doc.title)
    styles = getSampleStyleSheet()
    story = [Paragraph(html.escape(doc.title), styles["Title"]), Spacer(1, 12)]
    for paragraph in html_to_text(doc.html_content).splitlines():
        if paragraph.strip():
            story.append(Paragraph(html.escape(paragraph.strip()), styles["BodyText"]))
            story.append(Spacer(1, 6))
    pdf.build(story)
    return Response(
        buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename(doc.title, "pdf")}"'},
    )


@router.get("/export/docx/{document_id}")
def export_document_docx(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return Response(
        build_docx(doc.title, html_to_text(doc.html_content)),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename(doc.title, "docx")}"'},
    )


@router.get("/documents/{document_id}/versions")
def document_versions(document_id: int, db: Session = Depends(get_db)):
    versions = db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).order_by(DocumentVersion.created_at.desc()).all()
    return [
        {
            "version_id": item.version_id,
            "document_id": item.document_id,
            "plain_text": item.plain_text,
            "html_content": item.html_content,
            "changed_by": item.changed_by,
            "change_note": item.change_note,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in versions
    ]


@router.get("/training")
def list_training(q: str | None = None, category: str | None = None, db: Session = Depends(get_db)):
    query = db.query(AITrainingDocument)
    if category:
        query = query.filter(AITrainingDocument.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                AITrainingDocument.title.like(like),
                AITrainingDocument.company.like(like),
                AITrainingDocument.project.like(like),
                AITrainingDocument.topic.like(like),
                AITrainingDocument.extracted_text.like(like),
            )
        )
    return [serialize_training(item) for item in query.order_by(AITrainingDocument.created_at.desc()).limit(300).all()]


@router.post("/training")
async def upload_training_document(
    title: Annotated[str, Form()] = "",
    category: Annotated[str, Form()] = "Reference Material",
    company: Annotated[str, Form()] = "",
    project: Annotated[str, Form()] = "",
    topic: Annotated[str, Form()] = "",
    business_avenue: Annotated[str, Form()] = "",
    uploaded_by: Annotated[str, Form()] = "",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    stored = await store_upload(file, TRAINING_DIR)
    extracted = extract_text_from_path(stored)
    item = AITrainingDocument(
        title=title or file.filename or "Training Document",
        category=category,
        company=company,
        project=project,
        topic=topic,
        business_avenue=business_avenue,
        file_name=file.filename,
        stored_path=relative_path(stored),
        extracted_text=extracted,
        uploaded_by=uploaded_by,
        status="Active",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_training(item)


@router.get("/training/{training_id}/download")
def download_training(training_id: int, db: Session = Depends(get_db)):
    item = db.get(AITrainingDocument, training_id)
    if not item:
        raise HTTPException(status_code=404, detail="Training document not found")
    path = resolve_stored_path(item.stored_path)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Training file missing on disk")
    return FileResponse(path, filename=item.file_name or path.name)
