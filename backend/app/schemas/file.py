from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class FileBase(BaseModel):
    filename: str
    file_type: str
    file_size: int
    file_path: str

class FileCreate(FileBase):
    message_id: Optional[int] = None

class File(FileBase):
    id: int
    message_id: Optional[int] = None
    uploaded_by_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True) 