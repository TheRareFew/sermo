from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
import logging
from datetime import datetime

from ...schemas.user import (
    User, UserUpdate, UserStatus, 
    UserProfilePicture, UserPresence
)
from ...models.user import User as UserModel
from ..deps import get_db, get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/me", response_model=User)
async def get_current_user_info(
    current_user: UserModel = Depends(get_current_user)
):
    """Get current user information"""
    return current_user

@router.put("/me", response_model=User)
async def update_current_user_info(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update current user information"""
    try:
        # Update only provided fields
        if user_update.full_name is not None:
            current_user.full_name = user_update.full_name
        if user_update.email is not None:
            # Check if email is already taken
            existing_user = db.query(UserModel).filter(
                UserModel.email == user_update.email,
                UserModel.id != current_user.id
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            current_user.email = user_update.email

        db.commit()
        db.refresh(current_user)
        return current_user

    except SQLAlchemyError as e:
        logger.error(f"Database error in update_current_user: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update user")

@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get user by ID"""
    try:
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_user: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch user")

@router.get("/", response_model=List[User])
async def get_users(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get list of users"""
    try:
        users = (
            db.query(UserModel)
            .filter(UserModel.is_active == True)
            .offset(skip)
            .limit(limit)
            .all()
        )
        return users

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_users: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch users")

@router.put("/me/profile-picture", response_model=User)
async def update_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update user profile picture"""
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be an image"
            )

        # Save file and update URL (implementation depends on your file storage solution)
        file_url = await save_profile_picture(file, current_user.id)
        
        current_user.profile_picture_url = file_url
        db.commit()
        db.refresh(current_user)
        return current_user

    except SQLAlchemyError as e:
        logger.error(f"Database error in update_profile_picture: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update profile picture")

@router.put("/me/status", response_model=User)
async def update_status(
    status_update: UserStatus,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Update user status"""
    try:
        valid_statuses = ["online", "offline", "away", "busy"]
        if status_update.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status must be one of: {', '.join(valid_statuses)}"
            )

        current_user.status = status_update.status
        current_user.last_seen = datetime.utcnow()
        db.commit()
        db.refresh(current_user)
        return current_user

    except SQLAlchemyError as e:
        logger.error(f"Database error in update_status: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update status")

@router.get("/presence", response_model=List[UserPresence])
async def get_users_presence(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get users presence information"""
    try:
        # Get presence info for all active users
        users = (
            db.query(UserModel)
            .filter(UserModel.is_active == True)
            .all()
        )

        presence_info = [
            UserPresence(
                user_id=user.id,
                username=user.username,
                status=user.status,
                last_seen=user.last_seen
            )
            for user in users
        ]
        return presence_info

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_users_presence: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch user presence")

async def save_profile_picture(file: UploadFile, user_id: int) -> str:
    """Helper function to save profile picture"""
    # Implementation depends on your file storage solution
    # This is a placeholder - implement actual file storage logic
    try:
        file_location = f"uploads/profile_pictures/{user_id}_{file.filename}"
        with open(file_location, "wb+") as file_object:
            file_object.write(file.file.read())
        return f"/profile_pictures/{user_id}_{file.filename}"
    except Exception as e:
        logger.error(f"Error saving profile picture: {e}")
        raise HTTPException(status_code=500, detail="Could not save profile picture") 