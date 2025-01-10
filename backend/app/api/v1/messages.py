from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
import logging
from datetime import datetime

from ...schemas.message import Message, MessageCreate, MessageUpdate, MessageReply
from ...models.message import Message as MessageModel
from ...models.channel import Channel
from ..deps import get_db, get_current_user
from ...models.user import User

router = APIRouter()
channel_router = APIRouter()
logger = logging.getLogger(__name__)

@channel_router.get("/{channel_id}/messages", response_model=List[Message])
async def get_channel_messages(
    channel_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get messages in channel"""
    try:
        # Check channel access
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not a member of this channel")

        # Get messages
        messages = (
            db.query(MessageModel)
            .filter(MessageModel.channel_id == channel_id)
            .filter(MessageModel.parent_id.is_(None))  # Only get top-level messages
            .order_by(MessageModel.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        # Log loaded messages
        logger.info(f"Loaded {len(messages)} messages from channel {channel_id} (skip={skip}, limit={limit})")
        return messages

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
        if not message.content.strip():
            raise HTTPException(status_code=422, detail="Message content cannot be empty")

        # Check channel access
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not a member of this channel")

        # Create message
        db_message = MessageModel(
            content=message.content,
            channel_id=channel_id,
            sender_id=current_user.id
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
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
        if not message.content.strip():
            raise HTTPException(status_code=422, detail="Message content cannot be empty")

        db_message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not db_message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        # Check ownership
        if db_message.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this message")

        # Update message
        db_message.content = message.content
        db_message.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_message)
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
        if not reply.content.strip():
            raise HTTPException(status_code=422, detail="Reply content cannot be empty")

        # Check parent message exists and user has access
        parent_message = db.query(MessageModel).filter(MessageModel.id == message_id).first()
        if not parent_message:
            raise HTTPException(status_code=404, detail="Parent message not found")

        channel = db.query(Channel).filter(Channel.id == parent_message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to reply to this message")

        # Create reply
        db_reply = MessageModel(
            content=reply.content,
            channel_id=parent_message.channel_id,
            sender_id=current_user.id,
            parent_id=message_id
        )
        db.add(db_reply)
        db.commit()
        db.refresh(db_reply)
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