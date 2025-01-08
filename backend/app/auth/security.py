from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from fastapi import HTTPException, status
from typing import Optional
from sqlalchemy.orm import Session
from ..models.user import User
import uuid
from sqlalchemy import Table, Column, String, Integer, DateTime, ForeignKey, Boolean
from ..database import Base

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

SECRET_KEY = "your-secret-key"  # Store in environment variables
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM) 

async def authenticate_user(username: str, password: str, db: Session) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user or not pwd_context.verify(password, user.hashed_password):
        return None
    return user 

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String, unique=True)
    expires_at = Column(DateTime)
    revoked = Column(Boolean, default=False)

async def store_refresh_token(user_id: int, token: str, db: Session):
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db_token = RefreshToken(user_id=user_id, token=token, expires_at=expires_at)
    db.add(db_token)
    db.commit()

async def verify_refresh_token(user_id: int, token: str, db: Session) -> bool:
    db_token = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.token == token,
        RefreshToken.expires_at > datetime.utcnow(),
        RefreshToken.revoked == False
    ).first()
    return bool(db_token)

async def rotate_refresh_token(user_id: int, old_token: str, new_token: str, db: Session):
    db_token = db.query(RefreshToken).filter_by(token=old_token).first()
    if db_token:
        db_token.revoked = True
    await store_refresh_token(user_id, new_token, db)
    db.commit() 

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate a password hash."""
    return pwd_context.hash(password) 