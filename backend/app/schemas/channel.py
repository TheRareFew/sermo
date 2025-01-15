from pydantic import BaseModel, ConfigDict, Field, constr
from typing import List, Optional
from datetime import datetime

class ChannelBase(BaseModel):
    name: constr(min_length=1, strip_whitespace=True)
    description: Optional[str] = None
    is_direct_message: bool = False
    is_public: bool = True
    is_vc: bool = False

class ChannelCreate(ChannelBase):
    member_ids: List[int] = Field(default_factory=list)

class ChannelUpdate(BaseModel):
    name: Optional[constr(min_length=1, strip_whitespace=True)] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    is_vc: Optional[bool] = None

class ChannelMember(BaseModel):
    user_id: int

class Channel(ChannelBase):
    id: int
    created_at: datetime
    created_by_id: int
    
    model_config = ConfigDict(from_attributes=True)