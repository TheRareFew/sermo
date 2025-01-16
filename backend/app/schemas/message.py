from pydantic import BaseModel, Field, constr
from typing import Optional, List
from datetime import datetime
from .reaction import Reaction
from .file import File

class MessageBase(BaseModel):
    content: Optional[str] = Field(None, description="Message content")

class MessageCreate(MessageBase):
    channel_id: int = Field(description="ID of the channel")
    parent_id: Optional[int] = Field(default=None, description="ID of the parent message if this is a reply")
    file_ids: Optional[List[int]] = Field(default=None, description="List of file IDs to attach to the message")
    is_bot: Optional[bool] = False
    
    @property
    def is_valid(self) -> bool:
        """A message is valid if it has either content or file attachments"""
        return bool((self.content and self.content.strip()) or self.file_ids)

class MessageUpdate(MessageBase):
    file_ids: Optional[List[int]] = Field(default=None, description="List of file IDs to attach to the message")
    
    @property
    def is_valid(self) -> bool:
        """A message is valid if it has either content or file attachments"""
        return bool((self.content and self.content.strip()) or self.file_ids)

class MessageReply(MessageBase):
    file_ids: Optional[List[int]] = Field(default=None, description="List of file IDs to attach to the message")
    
    @property
    def is_valid(self) -> bool:
        """A message is valid if it has either content or file attachments"""
        return bool((self.content and self.content.strip()) or self.file_ids)

class Message(MessageBase):
    id: int
    created_at: datetime
    updated_at: datetime
    sender_id: int
    channel_id: int
    parent_id: Optional[int] = None
    reactions: List[Reaction] = []
    files: List[File] = []
    has_attachments: bool = False
    is_bot: bool = False

    model_config = {"from_attributes": True} 