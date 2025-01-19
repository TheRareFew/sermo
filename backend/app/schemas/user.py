from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    status: Optional[str] = "offline"
    is_active: Optional[bool] = True
    description: Optional[str] = None

class UserCreate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None

class UserStatus(BaseModel):
    status: str

class UserProfilePicture(BaseModel):
    profile_picture_url: str

class UserPresence(BaseModel):
    id: int
    username: str
    status: str
    last_seen: Optional[datetime]

class User(UserBase):
    id: int
    auth0_id: Optional[str] = None
    last_seen: Optional[datetime]
    last_profile_generated: Optional[datetime]

    class Config:
        orm_mode = True 