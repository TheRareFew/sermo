from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
import logging

from ...schemas.reaction import Reaction, ReactionCreate
from ...models.reaction import Reaction as ReactionModel
from ...models.message import Message
from ...models.channel import Channel
from ..deps import get_db, get_current_user
from ...models.user import User

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

        db.delete(reaction)
        db.commit()

    except SQLAlchemyError as e:
        logger.error(f"Database error in remove_reaction: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{message_id}/reactions", response_model=List[Reaction])
async def get_reactions(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get message reactions"""
    try:
        # Check message exists and user has access
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Check channel access
        channel = db.query(Channel).filter(Channel.id == message.channel_id).first()
        if current_user.id not in [member.id for member in channel.members]:
            raise HTTPException(status_code=403, detail="Not authorized to view this message")

        reactions = (
            db.query(ReactionModel)
            .filter(ReactionModel.message_id == message_id)
            .all()
        )
        return reactions

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_reactions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 