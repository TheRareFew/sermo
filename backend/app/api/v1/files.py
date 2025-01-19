from fastapi import APIRouter, Depends, UploadFile, File as FastAPIFile, HTTPException, status, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
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
from ...ai.file_handler import process_file

router = APIRouter()
logger = logging.getLogger(__name__)

# Configure file upload settings
UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_TYPES = {
    # Images
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",  # Some browsers might use this variant
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
    # Videos
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/ogg": ".ogv",
    "video/quicktime": ".mov",
    # Documents
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    # Archives
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip",  # Alternative ZIP MIME type
    "application/x-rar-compressed": ".rar",
    # Audio
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    # Code
    "text/javascript": ".js",
    "application/javascript": ".js",  # Alternative JavaScript MIME type
    "text/css": ".css",
    "text/html": ".html",
    "application/json": ".json",
    "text/x-python": ".py",  # Python files
    "text/python": ".py",    # Alternative Python MIME type
    "application/x-python": ".py",  # Another Python MIME type
    "application/x-python-code": ".py"  # Yet another Python MIME type
}

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=File, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    message_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a file"""
    try:
        # Log incoming file information
        logger.info(f"Attempting to upload file: {file.filename}")
        logger.info(f"File content type: {file.content_type}")
        logger.info(f"Allowed types: {ALLOWED_TYPES}")

        # Get file extension from filename
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        # If content type isn't recognized but extension is valid, try to infer content type
        if file.content_type not in ALLOWED_TYPES:
            # Map of extensions to common MIME types
            extension_to_mime = {
                '.py': 'text/x-python',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.html': 'text/html',
                '.json': 'application/json',
                '.txt': 'text/plain',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogg': 'audio/ogg',
                '.mov': 'video/quicktime',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.zip': 'application/zip',
                '.rar': 'application/x-rar-compressed',
                '.pdf': 'application/pdf',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.xls': 'application/vnd.ms-excel',
                '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                '.ppt': 'application/vnd.ms-powerpoint',
                '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            }
            
            if file_extension in extension_to_mime:
                file.content_type = extension_to_mime[file_extension]
                logger.info(f"Inferred content type from extension: {file.content_type}")

        # Validate file type
        if file.content_type not in ALLOWED_TYPES:
            logger.error(f"File type not supported: {file.content_type}")
            logger.error(f"File extension: {file_extension}")
            logger.error(f"Current allowed types: {list(ALLOWED_TYPES.keys())}")
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type '{file.content_type}' not supported. Allowed types: {', '.join(ALLOWED_TYPES.keys())}"
            )

        # Verify message exists and user has access if message_id is provided
        if message_id is not None:
            message = db.query(Message).filter(Message.id == message_id).first()
            if not message:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Message not found"
                )
            
            # Check if user has access to the channel
            channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
            if not channel or current_user.id not in [member.id for member in channel.members]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to upload to this channel"
                )

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        extension = ALLOWED_TYPES[file.content_type]
        
        # Remove any existing extension from the original filename
        original_name = os.path.splitext(file.filename)[0]
        # Clean the filename
        safe_original_filename = "".join(c for c in original_name if c.isalnum() or c in "._-")
        filename = f"{timestamp}_{safe_original_filename}{extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        # Save file and track size
        file_size = 0
        try:
            with open(file_path, "wb") as buffer:
                while chunk := await file.read(8192):
                    file_size += len(chunk)
                    if file_size > MAX_FILE_SIZE:
                        # Clean up partial file
                        buffer.close()
                        os.remove(file_path)
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024 * 1024)}MB"
                        )
                    buffer.write(chunk)
        except Exception as e:
            # Clean up on error
            if os.path.exists(file_path):
                os.remove(file_path)
            raise e

        # Create database entry
        db_file = FileModel(
            filename=filename,
            file_type=file.content_type,
            file_size=file_size,
            file_path=f"/uploads/{filename}",
            message_id=message_id,  # Can be None
            uploaded_by_id=current_user.id
        )
        
        try:
            db.add(db_file)
            db.flush()  # Get the ID without committing
            
            # Generate file description if applicable
            if file.content_type.startswith(('text/', 'image/')) or file.content_type == 'application/pdf':
                logger.info(f"Starting file description generation for {filename}")
                try:
                    description = await process_file(
                        file_path=file_path,
                        file_type=file.content_type,
                        file_id=db_file.id,
                        filename=filename,
                        uploaded_by=current_user.username,
                        message=None,
                        created_at=db_file.created_at
                    )
                    if description:
                        logger.info(f"Successfully generated description for {filename}")
                        db_file.description = description[0] if isinstance(description, tuple) else description
                    else:
                        logger.warning(f"No description generated for {filename}")
                except Exception as e:
                    logger.error(f"Error generating file description for {filename}: {str(e)}", exc_info=True)
                    # Continue without description if there's an error
            else:
                logger.info(f"Skipping file description generation for unsupported type: {file.content_type}")
            
            # Update message has_attachments if message_id is provided
            if message_id:
                message = db.query(Message).filter(Message.id == message_id).first()
                if message:
                    message.has_attachments = True
            
            db.commit()
            db.refresh(db_file)
            
            # Convert to response model
            return File(
                id=db_file.id,
                filename=db_file.filename,
                file_type=db_file.file_type,
                file_size=db_file.file_size,
                file_path=db_file.file_path,
                description=db_file.description,  # Include description in response
                message_id=db_file.message_id,
                uploaded_by_id=db_file.uploaded_by_id,
                created_at=db_file.created_at,
                updated_at=db_file.updated_at
            )
        except SQLAlchemyError as e:
            # Clean up file if database operation fails
            if os.path.exists(file_path):
                os.remove(file_path)
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e)
            )

    except HTTPException as e:
        logger.error(f"Error uploading file: {e.status_code}: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        # Clean up file if it was saved
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
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

        # Check if user has permission (file uploader, message sender, or channel admin)
        message = db.query(Message).filter(Message.id == file.message_id).first()
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        
        if (file.uploaded_by_id != current_user.id and 
            message.sender_id != current_user.id and 
            channel.created_by_id != current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this file"
            )

        # Delete physical file
        file_path = os.path.join(UPLOAD_DIR, os.path.basename(file.file_path))
        if os.path.exists(file_path):
            os.remove(file_path)

        # Delete database entry
        db.delete(file)
        
        # Update message has_attachments if this was the last file
        if file.message_id:
            message = db.query(Message).filter(Message.id == file.message_id).first()
            if message:
                remaining_files = db.query(FileModel).filter(
                    FileModel.message_id == file.message_id,
                    FileModel.id != file.id
                ).count()
                message.has_attachments = remaining_files > 0
        
        db.commit()

    except HTTPException:
        raise
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
            .order_by(FileModel.created_at.desc())
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

@router.patch("/{file_id}", response_model=File)
async def update_file(
    file_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update file's message ID"""
    try:
        # Get the file
        file = db.query(FileModel).filter(FileModel.id == file_id).first()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # Verify the user uploaded this file
        if file.uploaded_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this file"
            )

        # Verify the message exists
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )

        # Update the file
        file.message_id = message_id
        db.commit()
        db.refresh(file)

        return file

    except SQLAlchemyError as e:
        logger.error(f"Database error while updating file: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update file"
        ) 

@router.get("/messages/{message_id}/files", response_model=List[File])
async def get_message_files(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get files attached to a message"""
    try:
        # Check if message exists and user has access
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )

        # Check if user has access to the channel
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if not channel or current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access these files"
            )

        # Get files
        files = db.query(FileModel).filter(FileModel.message_id == message_id).all()
        return files

    except SQLAlchemyError as e:
        logger.error(f"Database error while fetching message files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not fetch files"
        ) 

@router.get("/download/{file_id}")
async def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download a file"""
    try:
        # Get the file
        file = db.query(FileModel).filter(FileModel.id == file_id).first()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        # If file is attached to a message, check channel access
        if file.message_id:
            message = db.query(Message).filter(Message.id == file.message_id).first()
            if message:
                channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
                if not channel or current_user.id not in [member.id for member in channel.members]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to access this file"
                    )
        # If file is not attached to a message, only allow access to the uploader
        elif file.uploaded_by_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this file"
            )

        # Get the full file path
        file_path = os.path.join(UPLOAD_DIR, os.path.basename(file.file_path))
        
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found on disk"
            )

        # Return the file as a response with cache control headers
        headers = {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache"
        }
        
        return FileResponse(
            path=file_path,
            filename=file.filename,
            media_type=file.file_type,
            headers=headers
        )

    except SQLAlchemyError as e:
        logger.error(f"Database error while downloading file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not download file"
        ) 