from pydantic import BaseModel
from datetime import datetime

class ReactionBase(BaseModel):
    emoji: str

class ReactionCreate(ReactionBase):
    pass

class Reaction(ReactionBase):
    id: int
    message_id: int
    user_id: int

    class Config:
        from_attributes = True 