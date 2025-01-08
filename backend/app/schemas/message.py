from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    pass

class MessageUpdate(MessageBase):
    pass

class MessageReply(MessageBase):
    parent_id: int

class Message(MessageBase):
    id: int
    created_at: datetime
    updated_at: datetime
    sender_id: int
    channel_id: int
    parent_id: Optional[int] = None

    class Config:
        from_attributes = True 