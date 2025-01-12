from pydantic import BaseModel, Field, constr
from typing import Optional, List
from datetime import datetime
from .reaction import Reaction

class MessageBase(BaseModel):
    content: constr(min_length=1, strip_whitespace=True) = Field(..., description="Message content")

class MessageCreate(MessageBase):
    pass

class MessageUpdate(MessageBase):
    pass

class MessageReply(MessageBase):
    pass

class Message(MessageBase):
    id: int
    created_at: datetime
    updated_at: datetime
    sender_id: int
    channel_id: int
    parent_id: Optional[int] = None
    reactions: List[Reaction] = []

    class Config:
        from_attributes = True 