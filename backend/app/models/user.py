from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from ..database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    profile_picture_url = Column(String, nullable=True)
    status = Column(String, default="offline")  # online, offline, away, busy
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    messages = relationship("Message", back_populates="sender")
    channels_created = relationship("Channel", back_populates="created_by", foreign_keys="Channel.created_by_id")
    channels = relationship("Channel", secondary="channel_members", back_populates="members") 