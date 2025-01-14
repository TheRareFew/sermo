from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models.user import User

def update_lain():
    db = SessionLocal()
    try:
        lain = db.query(User).filter(User.username == "lain").first()
        if lain and not lain.full_name:
            lain.full_name = "Lain Iwakura"
            db.commit()
            print("Updated Lain's full_name")
        else:
            print("Lain not found or already has full_name set")
    finally:
        db.close()

if __name__ == "__main__":
    update_lain() 