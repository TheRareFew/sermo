from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class FileBase(BaseModel):
    filename: str
    file_type: str
    file_size: int
    file_path: str

class FileCreate(FileBase):
    message_id: int

class File(FileBase):
    id: int
    created_at: datetime
    updated_at: datetime
    message_id: int
    uploaded_by_id: int

    model_config = {"from_attributes": True} 