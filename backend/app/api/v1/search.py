from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_, func, and_
from typing import List
import logging

from ...schemas.search import (
    SearchParams,
    MessageSearchResult,
    FileSearchResult,
    ChannelSearchResult
)
from ...models.message import Message
from ...models.file import File
from ...models.channel import Channel, channel_members
from ..deps import get_db, get_current_user
from ...models.user import User

# Create router with explicit tags
router = APIRouter(
    tags=["search"]
)
logger = logging.getLogger(__name__)

@router.get("/messages", response_model=List[MessageSearchResult])
async def search_messages(
    query: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search messages across all channels the user has access to"""
    try:
        # Return empty list for empty query
        if not query.strip():
            return []

        # Get all channels the user is a member of
        user_channels = (
            db.query(Channel.id)
            .join(channel_members)
            .filter(channel_members.c.user_id == current_user.id)
            .subquery()
        )

        # Search messages in those channels
        messages = (
            db.query(
                Message,
                Channel.name.label('channel_name')
            )
            .join(Channel)
            .filter(
                and_(
                    Message.channel_id.in_(user_channels),
                    Message.content.ilike(f"%{query}%")
                )
            )
            .order_by(Message.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        # Convert to response model
        results = [
            MessageSearchResult(
                id=msg.Message.id,
                content=msg.Message.content,
                created_at=msg.Message.created_at,
                sender_id=msg.Message.sender_id,
                channel_id=msg.Message.channel_id,
                channel_name=msg.channel_name
            )
            for msg in messages
        ]

        return results

    except SQLAlchemyError as e:
        logger.error(f"Database error in search_messages: {e}")
        raise HTTPException(status_code=500, detail="Search operation failed")

@router.get("/files", response_model=List[FileSearchResult])
async def search_files(
    query: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search files across all channels the user has access to"""
    try:
        # Return empty list for empty query
        if not query.strip():
            return []

        # Get all channels the user is a member of
        user_channels = (
            db.query(Channel.id)
            .join(channel_members)
            .filter(channel_members.c.user_id == current_user.id)
            .subquery()
        )

        # Search files in those channels
        files = (
            db.query(
                File,
                Channel.name.label('channel_name')
            )
            .select_from(File)
            .join(Message, File.message_id == Message.id)
            .join(Channel, Message.channel_id == Channel.id)
            .filter(
                and_(
                    Message.channel_id.in_(user_channels),
                    or_(
                        File.filename.ilike(f"%{query}%"),
                        File.file_type.ilike(f"%{query}%")
                    )
                )
            )
            .order_by(File.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        # Convert to response model
        results = [
            FileSearchResult(
                id=file.File.id,
                filename=file.File.filename,
                file_type=file.File.file_type,
                file_path=file.File.file_path,
                created_at=file.File.created_at,
                channel_id=file.File.message.channel_id,
                channel_name=file.channel_name
            )
            for file in files
        ]

        return results

    except SQLAlchemyError as e:
        logger.error(f"Database error in search_files: {e}")
        raise HTTPException(status_code=500, detail="Search operation failed")

@router.get("/channels", response_model=List[ChannelSearchResult])
async def search_channels(
    query: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search channels the user has access to"""
    try:
        # Return empty list for empty query
        if not query.strip():
            return []

        # Search channels
        channels = (
            db.query(
                Channel,
                func.count(channel_members.c.user_id).label('member_count')
            )
            .join(channel_members)
            .filter(
                and_(
                    channel_members.c.user_id == current_user.id,
                    or_(
                        Channel.name.ilike(f"%{query}%"),
                        Channel.description.ilike(f"%{query}%")
                    )
                )
            )
            .group_by(Channel.id)
            .order_by(Channel.name)
            .offset(skip)
            .limit(limit)
            .all()
        )

        # Convert to response model
        results = [
            ChannelSearchResult(
                id=channel.Channel.id,
                name=channel.Channel.name,
                description=channel.Channel.description,
                is_direct_message=channel.Channel.is_direct_message,
                member_count=channel.member_count
            )
            for channel in channels
        ]

        return results

    except SQLAlchemyError as e:
        logger.error(f"Database error in search_channels: {e}")
        raise HTTPException(status_code=500, detail="Search operation failed") 