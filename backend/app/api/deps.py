from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..auth.auth0 import verify_auth0_token
from ..models.user import User
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
security = HTTPBearer()

def get_db() -> Generator:
    """Dependency for getting database session"""
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Dependency for getting current authenticated user"""
    try:
        # Verify token using Auth0
        payload = await verify_auth0_token(credentials)
        auth0_id = payload.get("sub")
        if auth0_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )

        # Get user by Auth0 ID
        user = db.query(User).filter(User.auth0_id == auth0_id).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        ) 