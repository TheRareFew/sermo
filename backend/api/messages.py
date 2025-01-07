from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..models import Message, get_db

router = APIRouter()

@router.get("/messages/channel/{channel_id}")
async def get_channel_messages(
    channel_id: str,
    db: Session = Depends(get_db)
) -> List[Message]:
    # Get messages in reverse chronological order (newest first)
    messages = (
        db.query(Message)
        .filter(Message.channel_id == channel_id)
        .order_by(desc(Message.timestamp))
        .all()
    )
    
    # Convert numeric IDs to string and ensure uniqueness
    for message in messages:
        message.id = f"{message.id}-{message.timestamp.isoformat()}"
    
    return messages
 