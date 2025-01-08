from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt, JWTError
from .security import (
    authenticate_user, create_access_token, create_refresh_token,
    store_refresh_token, verify_refresh_token, rotate_refresh_token,
    ALGORITHM, SECRET_KEY
)
from .models import Token

router = APIRouter()

@router.post("/login")
async def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    # Verify user credentials
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Store refresh token in database
    await store_refresh_token(user.id, refresh_token)

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
        refresh_token=refresh_token
    )

@router.post("/refresh")
async def refresh_token(response: Response, refresh_token: str = Cookie(None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    # Verify refresh token
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Verify token in database and hasn't been revoked
    if not await verify_refresh_token(user_id, refresh_token):
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")

    # Create new tokens
    new_access_token = create_access_token({"sub": user_id})
    new_refresh_token = create_refresh_token({"sub": user_id})

    # Rotate refresh token
    await rotate_refresh_token(user_id, refresh_token, new_refresh_token)

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
        refresh_token=new_refresh_token
    ) 