from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..auth.security import decode_token
from ..models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_db() -> Generator:
    """Dependency for getting database session"""
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Dependency for getting current authenticated user"""
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user

async def get_user_from_token(token: str) -> Optional[User]:
    """Get user from token for WebSocket authentication"""
    try:
        # Create a new database session
        db = SessionLocal()
        try:
            # Decode token and get user ID
            payload = decode_token(token)
            user_id = int(payload.get("sub"))
            if user_id is None:
                return None

            # Get user from database
            user = db.query(User).filter(User.id == user_id).first()
            return user
        except (ValueError, Exception):
            return None
        finally:
            db.close()
    except Exception:
        return None 