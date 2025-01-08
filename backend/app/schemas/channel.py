from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ChannelBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_direct_message: bool = False

class ChannelCreate(ChannelBase):
    member_ids: List[int]

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ChannelMember(BaseModel):
    user_id: int

class Channel(ChannelBase):
    id: int
    created_at: datetime
    created_by_id: int
    
    class Config:
        from_attributes = True 