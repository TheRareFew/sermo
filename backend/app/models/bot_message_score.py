from sqlalchemy import Column, Integer, ForeignKey, Float
from sqlalchemy.orm import relationship
from ..database import Base

class BotMessageScore(Base):
    __tablename__ = "bot_message_scores"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    bot_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=False)

    # Relationships
    message = relationship("Message", back_populates="bot_scores")
    bot_user = relationship("User", back_populates="bot_scores") 