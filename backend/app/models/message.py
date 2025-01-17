from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship, backref
from sqlalchemy.ext.hybrid import hybrid_property
from ..database import Base
from datetime import datetime, UTC

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    sender_id = Column(Integer, ForeignKey("users.id"))
    channel_id = Column(Integer, ForeignKey("channels.id"))
    parent_id = Column(Integer, ForeignKey("messages.id"), nullable=True)  # For threads/replies
    has_attachments = Column(Boolean, nullable=False, default=False)  # Ensure column is created with default value
    is_bot = Column(Boolean, nullable=False, default=False)  # Add is_bot field
    
    # Relationships
    sender = relationship("User", back_populates="messages")
    channel = relationship("Channel", back_populates="messages")
    reactions = relationship("Reaction", back_populates="message")
    files = relationship("File", back_populates="message")
    replies = relationship("Message", backref=backref("parent", remote_side=[id]))
    bot_scores = relationship("BotMessageScore", back_populates="message") 