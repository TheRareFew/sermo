from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
import logging
from datetime import datetime

from ...schemas.reaction import Reaction, ReactionCreate
from ...models.reaction import Reaction as ReactionModel
from ...models.message import Message
from ...models.channel import Channel
from ..deps import get_db, get_current_user
from ...models.user import User
from .websockets import manager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/{message_id}/reactions", response_model=Reaction)
async def add_reaction(
    message_id: int,
    reaction: ReactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add reaction to message"""
    try:
        # Check message exists and user has access
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Check channel access
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to react to this message")

        # Check if user already reacted with this emoji
        existing_reaction = (
            db.query(ReactionModel)
            .filter(
                ReactionModel.message_id == message_id,
                ReactionModel.user_id == current_user.id,
                ReactionModel.emoji == reaction.emoji
            )
            .first()
        )
        if existing_reaction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already reacted with this emoji"
            )

        # Create reaction
        db_reaction = ReactionModel(
            emoji=reaction.emoji,
            message_id=message_id,
            user_id=current_user.id
        )
        db.add(db_reaction)
        db.commit()
        db.refresh(db_reaction)

        # Broadcast reaction via WebSocket
        reaction_data = {
            "userId": str(current_user.id),
            "emoji": reaction.emoji,
            "timestamp": datetime.utcnow().isoformat()
        }
        await manager.broadcast_reaction(
            channel_id=channel.id,
            message_id=str(message_id),
            reaction=reaction_data,
            is_add=True
        )

        return db_reaction

    except SQLAlchemyError as e:
        logger.error(f"Database error in add_reaction: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{message_id}/reactions/{reaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reaction(
    message_id: int,
    reaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove reaction from message"""
    try:
        # Check reaction exists
        reaction = (
            db.query(ReactionModel)
            .filter(ReactionModel.id == reaction_id, ReactionModel.message_id == message_id)
            .first()
        )
        if not reaction:
            raise HTTPException(status_code=404, detail="Reaction not found")

        # Check ownership
        if reaction.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to remove this reaction")

        # Get channel ID before deleting reaction
        message = db.query(Message).filter(Message.id == message_id).first()
        channel_id = message.channel_id

        # Store reaction data before deletion
        reaction_data = {
            "userId": str(current_user.id),
            "emoji": reaction.emoji
        }

        # Delete reaction
        db.delete(reaction)
        db.commit()

        # Broadcast reaction removal via WebSocket
        await manager.broadcast_reaction(
            channel_id=channel_id,
            message_id=str(message_id),
            reaction=reaction_data,
            is_add=False
        )

    except SQLAlchemyError as e:
        logger.error(f"Database error in remove_reaction: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{message_id}/reactions", response_model=List[Reaction])
async def get_reactions(
    message_id: int,
    since: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get message reactions
    
    Args:
        message_id: ID of the message
        since: Optional timestamp (in milliseconds) to get reactions after
    """
    try:
        # Check message exists and user has access
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Check channel access
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
            
        # Check if user is a member of the channel
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view reactions in this channel"
            )

        # Build base query
        query = db.query(ReactionModel).filter(ReactionModel.message_id == message_id)

        # Add since filter if provided
        if since is not None:
            since_datetime = datetime.fromtimestamp(since / 1000.0)  # Convert milliseconds to datetime
            query = query.filter(ReactionModel.created_at > since_datetime)
            logger.debug(f"Filtering reactions after {since_datetime}")

        reactions = query.order_by(ReactionModel.created_at.desc()).all()
        logger.info(f"Loaded {len(reactions)} reactions for message {message_id} (since={since})")
        return reactions

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_reactions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 