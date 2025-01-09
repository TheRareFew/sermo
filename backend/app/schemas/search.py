from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class SearchParams(BaseModel):
    query: str
    skip: int = 0
    limit: int = 20

class MessageSearchResult(BaseModel):
    id: int
    content: str
    created_at: datetime
    sender_id: int
    channel_id: int
    channel_name: str  # Include channel context
    
    class Config:
        from_attributes = True

class FileSearchResult(BaseModel):
    id: int
    filename: str
    file_type: str
    file_path: str
    created_at: datetime
    channel_id: int
    channel_name: str
    
    class Config:
        from_attributes = True

class ChannelSearchResult(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_direct_message: bool
    member_count: int
    
    class Config:
        from_attributes = True 