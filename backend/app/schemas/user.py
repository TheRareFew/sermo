from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None

class UserStatus(BaseModel):
    status: str  # online, offline, away, busy

class UserProfilePicture(BaseModel):
    profile_picture_url: str

class User(UserBase):
    id: int
    profile_picture_url: Optional[str] = None
    status: str = "offline"
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserPresence(BaseModel):
    user_id: int
    username: str
    status: str
    last_seen: datetime 