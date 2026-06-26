from database import SessionLocal
from models import User

db = SessionLocal()

users = db.query(User).all()

for user in users:
    print(
        user.user_id,
        user.full_name,
        user.username,
        user.role
    )

db.close()