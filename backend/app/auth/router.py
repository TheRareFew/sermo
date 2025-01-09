from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from .security import (
    authenticate_user, create_access_token, create_refresh_token,
    store_refresh_token, verify_refresh_token, rotate_refresh_token,
    ALGORITHM, SECRET_KEY, get_password_hash
)
from .models import Token
from ..api.deps import get_db
from ..models.user import User
from ..schemas.user import UserCreate
from datetime import datetime, UTC

router = APIRouter()

@router.post("/register", response_model=Token)
async def register(
    user_data: UserCreate,
    response: Response,
    db: Session = Depends(get_db)
):
    """Register a new user and return access and refresh tokens."""
    # Check if username already exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email already exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create tokens
    access_token = create_access_token({"sub": str(db_user.id)})
    refresh_token = create_refresh_token({"sub": str(db_user.id)})

    # Store refresh token in database
    await store_refresh_token(db_user.id, refresh_token, db)

    # Set cookies
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=604800  # 7 days
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token
    )

@router.post("/login", response_model=Token)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login user and return access and refresh tokens."""
    # Verify user credentials
    user = await authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Create tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Store refresh token in database
    await store_refresh_token(user.id, refresh_token, db)

    # Set cookies
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=604800  # 7 days
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token
    )

@router.post("/refresh", response_model=Token)
async def refresh_token(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str = Cookie(None)
):
    """Refresh access token using refresh token."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing"
        )

    # Verify refresh token
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    # Verify token in database and hasn't been revoked
    if not await verify_refresh_token(user_id, refresh_token, db):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalid or expired"
        )

    # Create new tokens
    new_access_token = create_access_token({"sub": user_id})
    new_refresh_token = create_refresh_token({"sub": user_id})

    # Rotate refresh token
    await rotate_refresh_token(user_id, refresh_token, new_refresh_token, db)

    # Set new cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=604800
    )

    return Token(
        access_token=new_access_token,
        token_type="bearer",
        refresh_token=new_refresh_token
    ) 