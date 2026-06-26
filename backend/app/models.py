from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200))
    username = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default="EMPLOYEE")
    status = Column(String(50), default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)


class Employee(Base):
    __tablename__ = "employees"

    employee_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    full_name = Column(String(200))
    username = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default="EMPLOYEE")
    status = Column(String(50), default="PENDING")
    gmail_address = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Company(Base):
    __tablename__ = "companies"

    company_id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(200), unique=True, nullable=False)
    short_name = Column(String(50), nullable=True)
    company_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    is_custom = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmployeeCompany(Base):
    __tablename__ = "employee_companies"

    assignment_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    company_id = Column(Integer, nullable=False, index=True)


class ReportEntry(Base):
    __tablename__ = "report_entries"

    entry_id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(20), index=True)
    report_title = Column(String(255))
    period_start = Column(String(20))
    period_end = Column(String(20))
    section_code = Column(String(10))
    section_title = Column(String(200))
    topic = Column(String(200), index=True)
    subtopic = Column(String(200), nullable=True)
    information = Column(Text)
    status = Column(String(50), default="Draft")
    owner = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DataSubmission(Base):
    __tablename__ = "data_submissions"

    submission_id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(20), index=True)
    data_title = Column(String(255), nullable=True)
    period_start = Column(String(20))
    period_end = Column(String(20))
    week_label = Column(String(20), nullable=True)
    section_code = Column(String(10))
    section_title = Column(String(200))
    company = Column(String(200), nullable=True)
    project = Column(String(200), nullable=True)
    topic = Column(String(200), index=True)
    subtopic = Column(String(200), nullable=True)
    source_type = Column(String(50))
    file_name = Column(String(255), nullable=True)
    file_names = Column(Text, nullable=True)
    stored_path = Column(String(500), nullable=True)
    stored_paths = Column(Text, nullable=True)
    extracted_text = Column(Text)
    status = Column(String(50), default="Under Review")
    submitted_by = Column(String(100), nullable=True)
    linked_entry_id = Column(Integer, nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    document_id = Column(Integer, primary_key=True, index=True)

    title = Column(String(255), nullable=False)

    company = Column(String(255), nullable=False)

    project = Column(String(255), nullable=False)

    report_type = Column(String(20), default="RAW")
    document_type = Column(String(20), default="RAW")

    period_start = Column(String(20), nullable=True)
    period_end = Column(String(20), nullable=True)

    html_content = Column(Text)
    plain_text = Column(Text)

    owner = Column(String(100))

    source_submission_id = Column(Integer, nullable=True)
    parent_document_id = Column(Integer, nullable=True)

    status = Column(String(30), default="Draft")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    version_id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, nullable=False, index=True)
    html_content = Column(Text)
    plain_text = Column(Text)
    changed_by = Column(String(100), nullable=True)
    change_note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AITrainingDocument(Base):
    __tablename__ = "ai_training_documents"

    training_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(80), index=True)
    company = Column(String(200), nullable=True, index=True)
    project = Column(String(200), nullable=True, index=True)
    topic = Column(String(200), nullable=True, index=True)
    business_avenue = Column(String(120), nullable=True, index=True)
    file_name = Column(String(255), nullable=True)
    stored_path = Column(String(500), nullable=True)
    extracted_text = Column(Text)
    uploaded_by = Column(String(100), nullable=True)
    status = Column(String(50), default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReportDraft(Base):
    __tablename__ = "report_drafts"

    draft_id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(20), index=True)
    title = Column(String(255), nullable=False)
    period_start = Column(String(20), nullable=True)
    period_end = Column(String(20), nullable=True)
    month = Column(Integer, nullable=True)
    year = Column(Integer, nullable=True)
    html_content = Column(Text)
    plain_text = Column(Text)
    source_submission_ids = Column(Text, nullable=True)
    source_training_ids = Column(Text, nullable=True)
    generation_mode = Column(String(40), default="Grounded Draft")
    status = Column(String(50), default="Draft")
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
