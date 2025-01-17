from pydantic import BaseModel, Field, validator
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ReactionBase(BaseModel):
    emoji: str = Field(..., description="The emoji character to use for the reaction")

    @validator('emoji')
    def validate_emoji(cls, v):
        logger.debug(f"Validating emoji: {repr(v)}, type: {type(v)}")
        if not v:
            raise ValueError("Emoji cannot be empty")
        if not isinstance(v, str):
            raise ValueError("Emoji must be a string")
        return v

class ReactionCreate(ReactionBase):
    model_config = {
        "json_schema_extra": {
            "example": {
                "emoji": "👍"
            }
        }
    }

    def __init__(self, **data):
        logger.debug(f"Creating ReactionCreate with raw data: {repr(data)}, types: {[(k, type(v)) for k, v in data.items()]}")
        super().__init__(**data)
        logger.debug(f"Created ReactionCreate object: {repr(self)}")

class Reaction(ReactionBase):
    id: int
    message_id: int
    user_id: int

    class Config:
        from_attributes = True 