from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
import logging
from datetime import datetime

from ...schemas.reaction import Reaction, ReactionCreate
from ...models.reaction import Reaction as ReactionModel
from ...models.message import Message
from ...models.channel import Channel
from ...models.bot_message_score import BotMessageScore
from ..deps import get_db, get_current_user
from ...models.user import User
from .websockets import manager

router = APIRouter()
logger = logging.getLogger(__name__)

async def update_bot_message_score(db: Session, message_id: int):
    """Update bot message score based on thumbs up/down reactions"""
    try:
        # Get the message
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message or not message.is_bot:
            return
        
        # Count thumbs up and thumbs down reactions
        reactions = db.query(ReactionModel).filter(
            ReactionModel.message_id == message_id,
            ReactionModel.emoji.in_(['👍', '👎'])
        ).all()
        
        score = sum(1 if r.emoji == '👍' else -1 for r in reactions)
        
        # Get or create bot message score
        bot_score = db.query(BotMessageScore).filter(
            BotMessageScore.message_id == message_id,
            BotMessageScore.bot_user_id == message.sender_id
        ).first()
        
        if bot_score:
            bot_score.score = score
        else:
            bot_score = BotMessageScore(
                message_id=message_id,
                bot_user_id=message.sender_id,
                score=score
            )
            db.add(bot_score)
        
        db.commit()
        logger.debug(f"Updated bot message score for message {message_id}: {score}")
        
    except SQLAlchemyError as e:
        logger.error(f"Error updating bot message score: {e}")
        db.rollback()

@router.post("/{message_id}/reactions", response_model=Reaction)
async def add_reaction(
    message_id: int,
    reaction: ReactionCreate = Body(..., embed=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add reaction to message"""
    try:
        # Log the raw request data
        logger.debug(f"Adding reaction - message_id: {message_id}, reaction data: {reaction}")
        
        if not hasattr(reaction, 'emoji'):
            logger.error("Invalid reaction data: missing emoji field")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reaction data: missing emoji field"
            )

        if not reaction.emoji:
            logger.error("Invalid reaction data: empty emoji")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reaction data: empty emoji"
            )
        
        # Check message exists and user has access
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            logger.debug(f"Message {message_id} not found")
            raise HTTPException(status_code=404, detail="Message not found")

        # Check channel access
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            logger.debug(f"User {current_user.id} not authorized to access channel {channel.id}")
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
            logger.debug(f"User {current_user.id} already reacted with emoji {reaction.emoji}")
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
        logger.debug(f"Created reaction {db_reaction.id}")

        # Update bot message score if this is a thumbs up/down reaction
        if message.is_bot and reaction.emoji in ['👍', '👎']:
            await update_bot_message_score(db, message_id)

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
        logger.debug("Successfully broadcast reaction")

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

@router.delete("/{message_id}/reactions", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reaction_by_emoji(
    message_id: int,
    emoji: str = Query(..., description="The emoji to remove"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove reaction from message by emoji"""
    try:
        logger.debug(f"Attempting to remove reaction - message_id: {message_id}, emoji: {emoji}, user_id: {current_user.id}")
        
        # Check message exists and user has access
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            logger.debug(f"Message {message_id} not found")
            raise HTTPException(status_code=404, detail="Message not found")

        # Check channel access
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            logger.debug(f"User {current_user.id} not authorized to access channel {channel.id}")
            raise HTTPException(status_code=403, detail="Not authorized to react to this message")

        # Find the reaction
        reaction_to_remove = (
            db.query(ReactionModel)
            .filter(
                ReactionModel.message_id == message_id,
                ReactionModel.user_id == current_user.id,
                ReactionModel.emoji == emoji
            )
            .first()
        )

        if not reaction_to_remove:
            logger.debug(f"Reaction not found - message_id: {message_id}, emoji: {emoji}, user_id: {current_user.id}")
            raise HTTPException(status_code=404, detail="Reaction not found")

        logger.debug(f"Found reaction to remove: {reaction_to_remove.id}")

        # Store reaction data before deletion
        reaction_data = {
            "userId": str(current_user.id),
            "emoji": reaction_to_remove.emoji
        }

        # Delete reaction
        db.delete(reaction_to_remove)
        db.commit()
        logger.debug(f"Successfully deleted reaction {reaction_to_remove.id}")

        # Update bot message score if this was a thumbs up/down reaction
        if message.is_bot and emoji in ['👍', '👎']:
            await update_bot_message_score(db, message_id)

        # Broadcast reaction removal via WebSocket
        await manager.broadcast_reaction(
            channel_id=channel.id,
            message_id=str(message_id),
            reaction=reaction_data,
            is_add=False
        )
        logger.debug("Successfully broadcast reaction removal")

    except SQLAlchemyError as e:
        logger.error(f"Database error in remove_reaction_by_emoji: {e}")
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