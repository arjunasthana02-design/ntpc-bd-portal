from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import SessionLocal
from app.models import Employee, User

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    full_name: str
    username: str
    password: str
    role: str = "EMPLOYEE"


@router.post("/login")
def login(data: LoginRequest):
    db = SessionLocal()
    try:
        user = db.query(User).filter(
            User.username == data.username,
            User.password == data.password
        ).first()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid Username or Password"
            )

        if user.role != "ADMIN" and user.status != "APPROVED":
            raise HTTPException(
                status_code=403,
                detail="Registration is pending admin approval"
            )

        return {
            "user_id": user.user_id,
            "name": user.full_name,
            "username": user.username,
            "role": user.role
        }
    finally:
        db.close()


@router.post("/register")
def register(data: RegisterRequest):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(
            User.username == data.username
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Username already exists"
            )

        role = "ADMIN" if data.role == "ADMIN" else "EMPLOYEE"
        status = "APPROVED" if role == "ADMIN" else "PENDING"

        new_user = User(
            full_name=data.full_name,
            username=data.username,
            password=data.password,
            role=role,
            status=status
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        employee = Employee(
            user_id=new_user.user_id,
            full_name=new_user.full_name,
            username=new_user.username,
            password=new_user.password,
            role=new_user.role,
            status=new_user.status,
        )
        db.add(employee)
        db.commit()

        return {
            "message": "Registration submitted. Admin approval is required before login."
        }
    finally:
        db.close()