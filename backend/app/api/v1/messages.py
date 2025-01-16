from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
import logging
from datetime import datetime
import asyncio

from ...schemas.message import Message, MessageCreate, MessageUpdate, MessageReply
from ...models.message import Message as MessageModel
from ...models.channel import Channel
from ...models.file import File as FileModel
from ..deps import get_db, get_current_user
from ...models.user import User
from .websockets import manager
from ...ai.message_indexer import index_message

router = APIRouter()
channel_router = APIRouter()
logger = logging.getLogger(__name__)

@channel_router.get("/{channel_id}/messages", response_model=List[Message])
async def get_channel_messages(
    channel_id: int,
    since: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get messages from channel
    
    Args:
        channel_id: ID of the channel
        since: Optional timestamp (in milliseconds) to get messages after
        skip: Number of messages to skip (for pagination)
        limit: Maximum number of messages to return
    """
    try:
        # Check channel exists and user has access
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to view this channel")

        # Build base query
        query = (
            db.query(MessageModel)
            .filter(MessageModel.channel_id == channel_id)
            .filter(MessageModel.parent_id.is_(None))  # Only get top-level messages
            .options(
                joinedload(MessageModel.reactions),
                joinedload(MessageModel.sender),
                joinedload(MessageModel.files)
            )
        )

        # Add since filter if provided
        if since is not None:
            since_datetime = datetime.fromtimestamp(since / 1000.0)  # Convert milliseconds to datetime
            query = query.filter(MessageModel.created_at > since_datetime)
            logger.debug(f"Filtering messages after {since_datetime}")

        # Get total count for this query
        total_count = query.count()

        # Add ordering and pagination
        messages = (
            query
            .order_by(MessageModel.created_at.desc())  # Most recent first
            .offset(skip)
            .limit(limit)
            .all()
        )

        # Log loaded messages
        logger.info(f"Loaded {len(messages)} messages from channel {channel_id} (since={since}, skip={skip}, limit={limit}, total={total_count})")
        
        # Return messages in chronological order (oldest first)
        return list(reversed(messages))

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_channel_messages: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@channel_router.post("/{channel_id}/messages", response_model=Message)
async def create_message(
    channel_id: int,
    message: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new message in channel"""
    try:
        if not message.is_valid:
            raise HTTPException(status_code=422, detail="Message must have either content or file attachments")

        # Set default content for file-only messages
        content = message.content
        if not content and message.file_ids:
            content = "file"

        # Check channel access
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        # For public channels, automatically add the user as a member if they're not already
        if channel.is_public and current_user.id not in [m.id for m in channel.members]:
            try:
                channel.members.append(current_user)
                db.commit()
                db.refresh(channel)
                logger.info(f"Added user {current_user.id} to public channel {channel_id}")
            except SQLAlchemyError as e:
                logger.error(f"Database error while adding member to public channel: {e}")
                db.rollback()
                # Continue even if adding fails - they can still post in public channels
        
        # For private channels, check if user is a member
        elif not channel.is_public and current_user.id not in [m.id for m in channel.members]:
            raise HTTPException(status_code=403, detail="Not a member of this channel")

        # Create message
        db_message = MessageModel(
            content=content,  # Use potentially modified content
            channel_id=channel_id,
            sender_id=current_user.id,
            has_attachments=bool(message.file_ids),
            is_bot=message.is_bot
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        # Update file associations if file_ids provided
        if message.file_ids:
            files = db.query(FileModel).filter(FileModel.id.in_(message.file_ids)).all()
            for file in files:
                file.message_id = db_message.id
            db.commit()
        
        # Refresh to load relationships
        db_message = db.query(MessageModel).options(
            joinedload(MessageModel.sender),
            joinedload(MessageModel.files),
            joinedload(MessageModel.channel)
        ).filter(MessageModel.id == db_message.id).first()

        # Broadcast the new message via WebSocket
        await manager.broadcast_message(channel_id, db_message, exclude_user_id=current_user.id)

        # Index the message in Pinecone (non-blocking)
        asyncio.create_task(index_message(db_message))

        return db_message

    except SQLAlchemyError as e:
        logger.error(f"Database error in create_message: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{message_id}", response_model=Message)
async def update_message(
    message_id: int,
    message: MessageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update message"""
    try:
        if not message.is_valid:
            raise HTTPException(status_code=422, detail="Message must have either content or file attachments")

        # Set default content for file-only messages
        content = message.content
        if not content and message.file_ids:
            content = "file"

        db_message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not db_message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check ownership
        if db_message.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this message")

        # Update message
        db_message.content = content  # Use potentially modified content
        db_message.updated_at = datetime.utcnow()
        
        # Update file associations if file_ids provided
        if message.file_ids:
            files = db.query(FileModel).filter(FileModel.id.in_(message.file_ids)).all()
            for file in files:
                file.message_id = db_message.id
            db_message.has_attachments = True
        
        db.commit()
        db.refresh(db_message)

        # Broadcast the message update via WebSocket
        await manager.broadcast_message_update(
            db_message.channel_id,
            str(message_id),
            {
                "content": message.content,
                "updated_at": db_message.updated_at.isoformat(),
                "has_attachments": db_message.has_attachments
            }
        )

        return db_message

    except SQLAlchemyError as e:
        logger.error(f"Database error in update_message: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete message"""
    try:
        db_message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not db_message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check ownership or channel admin
        channel = db.query(Channel).filter(Channel.id == db_message.channel_id).first()
        if db_message.sender_id != current_user.id and channel.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this message")

        db.delete(db_message)
        db.commit()

    except SQLAlchemyError as e:
        logger.error(f"Database error in delete_message: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{message_id}/replies", response_model=List[Message])
async def get_message_replies(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get message replies"""
    try:
        # Check message exists and user has access
        message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to view this message")

        replies = (
            db.query(MessageModel)
            .filter(MessageModel.parent_id == message_id)
            .options(
                joinedload(MessageModel.reactions),
                joinedload(MessageModel.sender),
                joinedload(MessageModel.files)
            )
            .order_by(MessageModel.created_at)
            .all()
        )
        return replies

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_message_replies: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{message_id}/replies", response_model=Message)
async def create_message_reply(
    message_id: int,
    reply: MessageReply,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create reply to message"""
    try:
        if not reply.is_valid:
            raise HTTPException(status_code=422, detail="Message must have either content or file attachments")

        # Set default content for file-only messages
        content = reply.content
        if not content and reply.file_ids:
            content = "file"

        # Check parent message exists and user has access
        parent_message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not parent_message:
            raise HTTPException(status_code=404, detail="Parent message not found")

        channel = db.query(Channel).filter(Channel.id == parent_message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to reply to this message")

        # Create reply
        db_reply = MessageModel(
            content=content,  # Use potentially modified content
            channel_id=parent_message.channel_id,
            sender_id=current_user.id,
            parent_id=message_id,
            has_attachments=bool(reply.file_ids)
        )
        db.add(db_reply)
        db.commit()
        db.refresh(db_reply)
        
        # Update file associations if file_ids provided
        if reply.file_ids:
            files = db.query(FileModel).filter(FileModel.id.in_(reply.file_ids)).all()
            for file in files:
                file.message_id = db_reply.id
            db.commit()
        
        # Refresh to load relationships
        db_reply = db.query(MessageModel).options(
            joinedload(MessageModel.sender),
            joinedload(MessageModel.files),
            joinedload(MessageModel.channel)
        ).filter(MessageModel.id == db_reply.id).first()

        # Index the reply in Pinecone (non-blocking)
        asyncio.create_task(index_message(db_reply))

        # Broadcast the new reply via WebSocket
        await manager.broadcast_message(parent_message.channel_id, db_reply, exclude_user_id=current_user.id)

        return db_reply

    except SQLAlchemyError as e:
        logger.error(f"Database error in create_message_reply: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{message_id}/thread", response_model=List[Message])
async def get_message_thread(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get message thread (parent message and all replies)"""
    try:
        # Get parent message
        message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Check access
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to view this thread")

        # Get thread messages
        thread = [message] + (
            db.query(MessageModel)
            .filter(MessageModel.parent_id == message_id)
            .order_by(MessageModel.created_at)
            .all()
        )
        return thread

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_message_thread: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{message_id}", response_model=Message)
async def get_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific message"""
    try:
        # Check message exists and user has access
        message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to view this message")

        return message

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_message: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{message_id}/position", response_model=int)
async def get_message_position(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a message's position in its channel (number of messages before it)"""
    try:
        # Get the message to check channel access and get channel_id
        message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to view this message")

        # Count messages before this one in the same channel
        position = db.query(MessageModel).filter(
            MessageModel.channel_id == message.channel_id,
            MessageModel.created_at < message.created_at
        ).count()

        return position

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_message_position: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 