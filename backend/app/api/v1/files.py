from fastapi import APIRouter, Depends, UploadFile, File as FastAPIFile, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
import logging
import os
from datetime import datetime
import aiofiles
import shutil

from ...schemas.file import File, FileCreate
from ...models.file import File as FileModel
from ...models.message import Message
from ...models.channel import Channel
from ..deps import get_db, get_current_user
from ...models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

# Configure file upload settings
UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "text/plain": ".txt"
}

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=File)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    message_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a file"""
    try:
        # Validate file size
        file_size = 0
        async with aiofiles.open(file.filename, 'wb') as temp_file:
            while chunk := await file.read(8192):
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File too large"
                    )
                await temp_file.write(chunk)

        # Validate file type
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="File type not supported"
            )

        # Verify message exists and user has access
        if message_id:
            message = db.query(Message).filter(Message.id == message_id).first()
            if not message:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Message not found"
                )
            
            # Check if user has access to the channel
            channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
            if current_user.id not in [member.id for member in channel.members]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to upload to this channel"
                )

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        extension = ALLOWED_TYPES[file.content_type]
        filename = f"{timestamp}_{file.filename.replace(' ', '_')}{extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Create database entry
        db_file = FileModel(
            filename=filename,
            file_type=file.content_type,
            file_size=file_size,
            file_url=f"/uploads/{filename}",
            message_id=message_id
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        return db_file

    except SQLAlchemyError as e:
        logger.error(f"Database error while uploading file: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not upload file"
        )
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not upload file"
        )

@router.get("/{file_id}", response_model=File)
async def get_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get file by ID"""
    try:
        file = db.query(FileModel).filter(FileModel.id == file_id).first()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # Check if user has access to the channel containing the message
        message = db.query(Message).filter(Message.id == file.message_id).first()
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this file"
            )

        return file

    except SQLAlchemyError as e:
        logger.error(f"Database error while fetching file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not fetch file"
        )

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete file"""
    try:
        file = db.query(FileModel).filter(FileModel.id == file_id).first()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # Check if user has permission (message sender or channel admin)
        message = db.query(Message).filter(Message.id == file.message_id).first()
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        
        if message.sender_id != current_user.id and channel.created_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this file"
            )

        # Delete physical file
        file_path = os.path.join(UPLOAD_DIR, os.path.basename(file.file_url))
        if os.path.exists(file_path):
            os.remove(file_path)

        # Delete database entry
        db.delete(file)
        db.commit()

    except SQLAlchemyError as e:
        logger.error(f"Database error while deleting file: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not delete file"
        )
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not delete file"
        )

@router.get("/channels/{channel_id}/files", response_model=List[File])
async def get_channel_files(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50
):
    """Get files in channel"""
    try:
        # Check if user has access to the channel
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found"
            )

        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this channel"
            )

        # Get files from messages in the channel
        files = (
            db.query(FileModel)
            .join(Message, Message.id == FileModel.message_id)
            .filter(Message.channel_id == channel_id)
            .order_by(FileModel.uploaded_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return files

    except SQLAlchemyError as e:
        logger.error(f"Database error while fetching channel files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not fetch channel files"
        ) 