from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class FileBase(BaseModel):
    filename: str
    file_type: str
    file_size: int
    file_url: str

class FileCreate(FileBase):
    message_id: int

class File(FileBase):
    id: int
    uploaded_at: datetime
    message_id: int

    class Config:
        from_attributes = True 