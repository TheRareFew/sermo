from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
import logging
from datetime import datetime
import httpx

from ...schemas.user import (
    User, UserUpdate, UserStatus, 
    UserProfilePicture, UserPresence,
    UserCreate
)
from ...models.user import User as UserModel
from ..deps import get_db, get_current_user
from ...auth.auth0 import verify_auth0_token, security
from ...ai.profile_generator import generate_user_profile

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/auth0", response_model=User)
async def create_auth0_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    token_payload: dict = Depends(verify_auth0_token),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new user from Auth0 credentials or update existing user's username"""
    try:
        # Fetch user info from Auth0
        auth0_domain = "https://dev-fgo2qa1lzmrtvajq.us.auth0.com"
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{auth0_domain}/userinfo",
                headers={"Authorization": f"Bearer {credentials.credentials}"}
            )
            if response.status_code == 200:
                user_info = response.json()
                email = user_info.get('email')
                logger.debug(f"Retrieved email from Auth0: {email}")
            else:
                logger.warning(f"Failed to fetch user info from Auth0: {response.status_code}")
                email = None

        # Check if user already exists by auth0_id
        existing_user = db.query(UserModel).filter(
            UserModel.auth0_id == token_payload.get("sub")
        ).first()
        
        # Check if username is already taken by a different user
        username_exists = db.query(UserModel).filter(
            UserModel.username == user_data.username,
            UserModel.auth0_id != token_payload.get("sub")  # Exclude current user
        ).first()
        
        if username_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{user_data.username}' is already taken. Please choose a different username."
            )

        if existing_user:
            # Update existing user's username
            existing_user.username = user_data.username
            if email:
                existing_user.email = email
            db.commit()
            db.refresh(existing_user)
            return existing_user
        
        # Create new user if they don't exist
        new_user = UserModel(
            username=user_data.username,
            auth0_id=token_payload.get("sub"),
            email=email,
            is_active=True,
            status="online"
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
        
    except SQLAlchemyError as e:
        logger.error(f"Database error in create_auth0_user: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create user"
        )

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

@router.get("/presence", response_model=List[UserPresence])
async def get_users_presence(
    since: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get users presence information
    
    Args:
        since: Optional timestamp (in milliseconds) to get presence updates after
    """
    try:
        # Build base query for active users
        query = db.query(UserModel).filter(UserModel.is_active == True)

        # Add since filter if provided
        if since is not None:
            since_datetime = datetime.fromtimestamp(since / 1000.0)  # Convert milliseconds to datetime
            query = query.filter(UserModel.last_seen > since_datetime)
            logger.debug(f"Filtering presence updates after {since_datetime}")

        # Get users
        users = query.all()

        presence_info = [
            UserPresence(
                user_id=user.id,
                username=user.username,
                status=user.status or "offline",
                last_seen=user.last_seen or datetime.utcnow()
            )
            for user in users
        ]
        
        logger.info(f"Loaded presence info for {len(users)} users (since={since})")
        return presence_info

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_users_presence: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch user presence")

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

async def save_profile_picture(file: UploadFile, user_id: int) -> str:
    """Helper function to save profile picture"""
    # Implementation depends on your file storage solution
    # This is a placeholder - implement actual file storage logic
    try:
        file_location = f"backend/uploads/profile_pictures/{user_id}_{file.filename}"
        with open(file_location, "wb+") as file_object:
            file_object.write(await file.read())
        return f"/profile_pictures/{user_id}_{file.filename}"
    except Exception as e:
        logger.error(f"Error saving profile picture: {e}")
        raise HTTPException(status_code=500, detail="Could not save profile picture") 

@router.post("/{user_id}/generate-profile", response_model=User)
async def generate_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate a profile description for a user based on their message history"""
    try:
        # Check if user exists
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Generate profile
        description = await generate_user_profile(db, user_id)
        
        return user

    except SQLAlchemyError as e:
        logger.error(f"Database error in generate_profile: {e}")
        raise HTTPException(status_code=500, detail="Could not generate profile") 