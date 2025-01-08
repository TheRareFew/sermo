from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
import logging

from ...schemas.channel import Channel, ChannelCreate, ChannelUpdate, ChannelMember
from ...models.channel import Channel as ChannelModel
from ...models.user import User
from ..deps import get_db, get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[Channel])
async def get_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Get all channels the current user is a member of"""
    try:
        channels = (
            db.query(ChannelModel)
            .filter(ChannelModel.members.any(id=current_user.id))
            .offset(skip)
            .limit(limit)
            .all()
        )
        return channels
    except SQLAlchemyError as e:
        logger.error(f"Database error while fetching channels: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not fetch channels"
        )

@router.post("/", response_model=Channel)
async def create_channel(
    channel: ChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new channel"""
    try:
        # Verify all members exist
        members = db.query(User).filter(User.id.in_(channel.member_ids)).all()
        if len(members) != len(channel.member_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more member IDs are invalid"
            )

        # Create channel
        db_channel = ChannelModel(
            name=channel.name,
            description=channel.description,
            is_direct_message=channel.is_direct_message,
            created_by_id=current_user.id
        )
        db_channel.members = members + [current_user]  # Add creator to members
        
        db.add(db_channel)
        db.commit()
        db.refresh(db_channel)
        return db_channel

    except SQLAlchemyError as e:
        logger.error(f"Database error while creating channel: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create channel"
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
    
    # Check if user is a member
    if current_user.id not in [member.id for member in channel.members]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this channel"
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
    
    # Check if current user is the creator or removing themselves
    if db_channel.created_by_id != current_user.id and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only channel creator can remove members"
        )
    
    try:
        member = next((m for m in db_channel.members if m.id == user_id), None)
        if member:
            db_channel.members.remove(member)
            db.commit()
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User is not a member of this channel"
            )
    except SQLAlchemyError as e:
        logger.error(f"Database error while removing member: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not remove member from channel"
        )

@router.get("/{channel_id}/members", response_model=List[int])
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
    
    # Check if user is a member
    if current_user.id not in [m.id for m in db_channel.members]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this channel"
        )
    
    return [member.id for member in db_channel.members] 