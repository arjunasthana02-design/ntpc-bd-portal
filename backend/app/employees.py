from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.database import SessionLocal
from app.models import Employee, User

router = APIRouter(prefix="/employees", tags=["employees"])


# =========================================================
# PAYLOADS
# =========================================================
class EmployeePayload(BaseModel):
    full_name: str
    username: str
    password: str = ""
    role: str = "EMPLOYEE"
    status: str = "APPROVED"


class CompanyAssignmentPayload(BaseModel):
    company_name: str
    company_type: str = ""
    description: str = ""


# =========================================================
# HELPERS
# =========================================================
def serialize_user(user: User):
    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "username": user.username,
        "role": user.role,
        "status": user.status or "PENDING",
        "created_at": user.created_at.isoformat() if user.created_at else "",
    }


def sync_employee_record(db, user: User):
    employee = db.query(Employee).filter(Employee.user_id == user.user_id).first()

    if not employee:
        employee = db.query(Employee).filter(Employee.username == user.username).first()

    if not employee:
        employee = Employee(username=user.username)
        db.add(employee)

    employee.user_id = user.user_id
    employee.full_name = user.full_name
    employee.username = user.username
    employee.password = user.password
    employee.role = user.role
    employee.status = user.status or "PENDING"
    return employee


def ensure_company_tables(db):
    dialect = db.bind.dialect.name
    pk_type = "INTEGER PRIMARY KEY AUTOINCREMENT" if dialect == "sqlite" else "INTEGER PRIMARY KEY AUTO_INCREMENT"
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS companies (
            company_id {pk_type},
            company_name VARCHAR(255) NOT NULL,
            short_name VARCHAR(50),
            company_type VARCHAR(255),
            description TEXT,
            is_custom INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """.format(pk_type=pk_type)))

    db.execute(text("""
        CREATE TABLE IF NOT EXISTS employee_companies (
            assignment_id {pk_type},
            user_id INTEGER NOT NULL,
            company_id INTEGER NOT NULL,
            UNIQUE(user_id, company_id)
        )
    """.format(pk_type=pk_type)))

    db.commit()


# =========================================================
# EMPLOYEE CRUD
# =========================================================
@router.get("")
def list_employees():
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.full_name).all()

        for user in users:
            sync_employee_record(db, user)

        db.commit()
        return [serialize_user(user) for user in users]
    finally:
        db.close()


@router.post("")
def add_employee(payload: EmployeePayload):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == payload.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")

        if not payload.password:
            raise HTTPException(status_code=400, detail="Password is required")

        user = User(
            full_name=payload.full_name,
            username=payload.username,
            password=payload.password,
            role=payload.role or "EMPLOYEE",
            status=payload.status or "APPROVED",
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        sync_employee_record(db, user)
        db.commit()

        return serialize_user(user)
    finally:
        db.close()


@router.put("/{user_id}")
def update_employee(user_id: int, payload: EmployeePayload):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")

        duplicate = db.query(User).filter(
            User.username == payload.username,
            User.user_id != user_id
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Username already exists")

        user.full_name = payload.full_name
        user.username = payload.username

        if payload.password and payload.password.strip():
            user.password = payload.password.strip()

        user.role = payload.role or user.role
        user.status = payload.status or user.status

        sync_employee_record(db, user)
        db.commit()
        db.refresh(user)

        return serialize_user(user)
    finally:
        db.close()


@router.patch("/{user_id}/status")
def update_status(user_id: int, status: str):
    allowed = {"PENDING", "APPROVED", "REJECTED"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")

        user.status = status
        sync_employee_record(db, user)
        db.commit()
        db.refresh(user)

        return serialize_user(user)
    finally:
        db.close()


@router.delete("/{user_id}")
def delete_employee(user_id: int):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")

        employee = db.query(Employee).filter(Employee.user_id == user_id).first()
        if employee:
            db.delete(employee)

        ensure_company_tables(db)
        db.execute(
            text("DELETE FROM employee_companies WHERE user_id = :user_id"),
            {"user_id": user_id}
        )

        db.delete(user)
        db.commit()

        return {"message": "Employee deleted"}
    finally:
        db.close()


# =========================================================
# COMPANY ASSIGNMENT
# =========================================================
@router.get("/{user_id}/companies")
def get_employee_companies(user_id: int):
    db = SessionLocal()
    try:
        ensure_company_tables(db)

        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")

        rows = db.execute(text("""
            SELECT
                c.company_id,
                c.company_name,
                c.company_type,
                c.description
            FROM employee_companies ec
            JOIN companies c ON ec.company_id = c.company_id
            WHERE ec.user_id = :user_id
            ORDER BY c.company_name
        """), {"user_id": user_id}).fetchall()

        return [
            {
                "company_id": row.company_id,
                "company_name": row.company_name,
                "company_type": row.company_type or "",
                "description": row.description or ""
            }
            for row in rows
        ]
    finally:
        db.close()


@router.post("/{user_id}/companies")
def assign_company_to_employee(user_id: int, payload: CompanyAssignmentPayload):
    db = SessionLocal()
    try:
        ensure_company_tables(db)

        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")

        company_name = (payload.company_name or "").strip()
        company_type = (payload.company_type or "").strip()
        description = (payload.description or "").strip()

        if not company_name:
            raise HTTPException(status_code=400, detail="Company name is required")

        existing_company = db.execute(text("""
            SELECT company_id
            FROM companies
            WHERE LOWER(company_name) = LOWER(:company_name)
        """), {"company_name": company_name}).fetchone()

        if existing_company:
            company_id = existing_company.company_id

            db.execute(text("""
                UPDATE companies
                SET company_type = :company_type,
                    description = :description
                WHERE company_id = :company_id
            """), {
                "company_type": company_type,
                "description": description,
                "company_id": company_id
            })
        else:
            result = db.execute(text("""
                INSERT INTO companies (company_name, company_type, description)
                VALUES (:company_name, :company_type, :description)
            """), {
                "company_name": company_name,
                "company_type": company_type,
                "description": description
            })
            db.commit()

            if hasattr(result, "lastrowid") and result.lastrowid:
                company_id = result.lastrowid
            else:
                row = db.execute(text("""
                    SELECT company_id FROM companies
                    WHERE LOWER(company_name) = LOWER(:company_name)
                """), {"company_name": company_name}).fetchone()

                if not row:
                    raise HTTPException(status_code=500, detail="Company could not be created")
                company_id = row.company_id

        already_assigned = db.execute(text("""
            SELECT assignment_id
            FROM employee_companies
            WHERE user_id = :user_id AND company_id = :company_id
        """), {
            "user_id": user_id,
            "company_id": company_id
        }).fetchone()

        if already_assigned:
            db.commit()
            return {"message": "Company already assigned", "company_id": company_id}

        db.execute(text("""
            INSERT INTO employee_companies (user_id, company_id)
            VALUES (:user_id, :company_id)
        """), {
            "user_id": user_id,
            "company_id": company_id
        })

        db.commit()

        return {
            "message": "Company assigned successfully",
            "company_id": company_id
        }
    finally:
        db.close()


@router.delete("/{user_id}/companies/{company_id}")
def remove_company_from_employee(user_id: int, company_id: int):
    db = SessionLocal()
    try:
        ensure_company_tables(db)

        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")

        row = db.execute(text("""
            SELECT assignment_id
            FROM employee_companies
            WHERE user_id = :user_id AND company_id = :company_id
        """), {
            "user_id": user_id,
            "company_id": company_id
        }).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Company assignment not found")

        db.execute(text("""
            DELETE FROM employee_companies
            WHERE user_id = :user_id AND company_id = :company_id
        """), {
            "user_id": user_id,
            "company_id": company_id
        })

        db.commit()

        return {"message": "Company assignment removed"}
    finally:
        db.close()
