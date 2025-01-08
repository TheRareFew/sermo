from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, backref
from ..database import Base
import datetime

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
    sender_id = Column(Integer, ForeignKey("users.id"))
    channel_id = Column(Integer, ForeignKey("channels.id"))
    parent_id = Column(Integer, ForeignKey("messages.id"), nullable=True)  # For threads/replies
    
    # Relationships
    sender = relationship("User", back_populates="messages")
    channel = relationship("Channel", back_populates="messages")
    reactions = relationship("Reaction", back_populates="message")
    files = relationship("File", back_populates="message")
    replies = relationship("Message", backref=backref("parent", remote_side=[id])) 