from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------- DOCUMENTS ----------

class DocumentCreate(BaseModel):
    title: str
    company: str
    project: str
    report_type: str = "RAW"
    document_type: str = "RAW"
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    html_content: str = ""
    plain_text: str = ""
    owner: str
    source_submission_id: Optional[int] = None
    parent_document_id: Optional[int] = None


class DocumentUpdate(BaseModel):
    title: str
    company: str
    project: str
    report_type: str
    document_type: str
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    html_content: str
    plain_text: str
    status: Optional[str] = "Draft"


class DocumentResponse(BaseModel):
    document_id: int
    title: str
    company: str
    project: str
    report_type: str
    document_type: str
    period_start: Optional[str]
    period_end: Optional[str]
    html_content: str
    plain_text: str
    owner: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- REPORT ENTRY ----------

class ReportEntryCreate(BaseModel):
    report_type: str
    report_title: str
    period_start: str
    period_end: str
    section_code: str
    section_title: str
    topic: str
    subtopic: Optional[str] = ""
    information: str
    owner: Optional[str] = ""


class ReportEntryUpdate(BaseModel):
    report_title: str
    period_start: str
    period_end: str
    section_code: str
    section_title: str
    topic: str
    subtopic: Optional[str] = ""
    information: str
    status: str = "Draft"


# ---------- AI ----------

class AIRequest(BaseModel):
    prompt: str


class AIResponse(BaseModel):
    response: str