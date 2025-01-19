from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
import logging
from datetime import datetime, UTC

from ...schemas.channel import Channel, ChannelCreate, ChannelUpdate, ChannelMember
from ...schemas.user import User as UserSchema
from ...models.channel import Channel as ChannelModel
from ...models.user import User
from ...models.message import Message as MessageModel
from ...schemas.message import Message as MessageSchema
from ..deps import get_db, get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[Channel])
async def get_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    since: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    show_public: bool = True
):
    """Get all channels the current user has access to
    
    Args:
        since: Optional timestamp (in milliseconds) to get channels updated after
        skip: Number of channels to skip (for pagination)
        limit: Maximum number of channels to return
        show_public: Whether to include public channels
    """
    try:
        query = db.query(ChannelModel)
        if show_public:
            # Get public channels OR channels where user is a member
            query = query.filter(
                (ChannelModel.is_public == True) | 
                (ChannelModel.members.any(id=current_user.id))
            )
        else:
            # Get only channels where user is a member
            query = query.filter(ChannelModel.members.any(id=current_user.id))
        
        # Add since filter if provided
        if since is not None:
            since_datetime = datetime.fromtimestamp(since / 1000.0)  # Convert milliseconds to datetime
            query = query.filter(ChannelModel.updated_at > since_datetime)
            logger.debug(f"Filtering channels updated after {since_datetime}")
        
        channels = query.order_by(ChannelModel.updated_at.desc()).offset(skip).limit(limit).all()
        logger.info(f"Loaded {len(channels)} channels (since={since}, skip={skip}, limit={limit})")
        return channels
    except SQLAlchemyError as e:
        logger.error(f"Database error while fetching channels: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not fetch channels"
        )

@router.post("/", response_model=Channel, status_code=status.HTTP_201_CREATED)
async def create_channel(
    channel: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new channel."""
    try:
        # Merge the current_user object into the current session
        current_user = db.merge(current_user)
        
        # For private channels, verify member_ids are provided
        if not channel.is_public and not channel.member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Private channels must specify member_ids"
            )
        
        # Verify all member IDs exist before creating the channel
        if channel.member_ids:
            members = db.query(User).filter(User.id.in_(channel.member_ids)).all()
            if len(members) != len(channel.member_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="One or more member IDs not found"
                )
        
        new_channel = ChannelModel(
            name=channel.name,
            description=channel.description,
            is_direct_message=channel.is_direct_message,
            is_public=channel.is_public,
            created_by_id=current_user.id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )
        db.add(new_channel)
        db.flush()  # Flush to get the channel ID

        # Add the creator as a member
        new_channel.members.append(current_user)

        # Add additional members if specified
        if channel.member_ids:
            new_channel.members.extend(members)

        db.commit()
        return new_channel
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error while creating channel: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating channel"
        )

@router.get("/{channel_id}", response_model=Channel)
async def get_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get channel by ID"""
    channel = db.query(ChannelModel).filter(ChannelModel.id == channel_id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # Check if user has access (public channel or member)
    if not channel.is_public and current_user.id not in [member.id for member in channel.members]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this private channel"
        )
    
    return channel

@router.put("/{channel_id}", response_model=Channel)
async def update_channel(
    channel_id: int,
    channel_update: ChannelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update channel"""
    db_channel = db.query(ChannelModel).filter(ChannelModel.id == channel_id).first()
    if not db_channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # Check if user is the creator
    if db_channel.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only channel creator can update channel"
        )
    
    try:
        # Update only provided fields
        if channel_update.name is not None:
            db_channel.name = channel_update.name
        if channel_update.description is not None:
            db_channel.description = channel_update.description
        
        db.commit()
        db.refresh(db_channel)
        return db_channel

    except SQLAlchemyError as e:
        logger.error(f"Database error while updating channel: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update channel"
        )

@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete channel"""
    db_channel = db.query(ChannelModel).filter(ChannelModel.id == channel_id).first()
    if not db_channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # Check if user is the creator
    if db_channel.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only channel creator can delete channel"
        )
    
    try:
        db.delete(db_channel)
        db.commit()
    except SQLAlchemyError as e:
        logger.error(f"Database error while deleting channel: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not delete channel"
        )

@router.post("/{channel_id}/members", status_code=status.HTTP_204_NO_CONTENT)
async def add_channel_member(
    channel_id: int,
    member: ChannelMember,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add member to channel"""
    db_channel = db.query(ChannelModel).filter(ChannelModel.id == channel_id).first()
    if not db_channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # Only allow member management for private channels
    if db_channel.is_public:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot manage members for public channels"
        )
    
    # Check if current user is a member
    if current_user.id not in [m.id for m in db_channel.members]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this channel"
        )
    
    # Get new member
    new_member = db.query(User).filter(User.id == member.user_id).first()
    if not new_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        db_channel.members.append(new_member)
        db.commit()
        db.refresh(db_channel)
        return None
    except SQLAlchemyError as e:
        logger.error(f"Database error while adding member: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not add member to channel"
        )

@router.delete("/{channel_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_channel_member(
    channel_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove member from channel"""
    db_channel = db.query(ChannelModel).filter(ChannelModel.id == channel_id).first()
    if not db_channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # Only allow member management for private channels
    if db_channel.is_public:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot manage members for public channels"
        )
    
    # Check if current user is the creator or removing themselves
    if db_channel.created_by_id != current_user.id and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only channel creator can remove members"
        )
    
    try:
        member_to_remove = db.query(User).filter(User.id == user_id).first()
        if not member_to_remove:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        db_channel.members.remove(member_to_remove)
        db.commit()
        return None
    except SQLAlchemyError as e:
        logger.error(f"Database error while removing member: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not remove member from channel"
        )

@router.get("/{channel_id}/members", response_model=List[UserSchema])
async def get_channel_members(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get channel members"""
    db_channel = db.query(ChannelModel).filter(ChannelModel.id == channel_id).first()
    if not db_channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # For public channels, automatically add the user as a member if they're not already
    if db_channel.is_public and current_user.id not in [m.id for m in db_channel.members]:
        try:
            db_channel.members.append(current_user)
            db.commit()
            db.refresh(db_channel)
            logger.info(f"Added user {current_user.id} to public channel {channel_id}")
        except SQLAlchemyError as e:
            logger.error(f"Database error while adding member to public channel: {e}")
            db.rollback()
            # Continue even if adding fails - they can still view members
    
    # Check if user is a member for private channels
    elif not db_channel.is_public and current_user.id not in [m.id for m in db_channel.members]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this channel"
        )
    
    return db_channel.members

@router.get("/{channel_id}/messages", response_model=List[MessageSchema])
async def get_channel_messages(
    channel_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get channel messages"""
    db_channel = db.query(ChannelModel).filter(ChannelModel.id == channel_id).first()
    if not db_channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # For public channels, automatically add the user as a member if they're not already
    if db_channel.is_public and current_user.id not in [m.id for m in db_channel.members]:
        try:
            db_channel.members.append(current_user)
            db.commit()
            db.refresh(db_channel)
            logger.info(f"Added user {current_user.id} to public channel {channel_id}")
        except SQLAlchemyError as e:
            logger.error(f"Database error while adding member to public channel: {e}")
            db.rollback()
            # Continue even if adding fails - they can still view messages
    
    # Check if user is a member for private channels
    elif not db_channel.is_public and current_user.id not in [m.id for m in db_channel.members]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this channel"
        )
    
    messages = (
        db.query(MessageModel)
        .filter(MessageModel.channel_id == channel_id)
        .order_by(MessageModel.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return messages 