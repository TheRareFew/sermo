from pydantic import BaseModel, Field

class BotMessageScoreBase(BaseModel):
    message_id: int = Field(description="ID of the message being scored")
    bot_user_id: int = Field(description="ID of the bot user who made the message")
    score: float = Field(description="Score given to the message", ge=0.0, le=1.0)

class BotMessageScoreCreate(BotMessageScoreBase):
    pass

class BotMessageScore(BotMessageScoreBase):
    id: int

    class Config:
        from_attributes = True 