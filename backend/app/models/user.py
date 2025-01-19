from sqlalchemy import Column, Integer, String, Boolean, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime, UTC

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    auth0_id = Column(String, unique=True, index=True)  # Auth0 user ID
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    description = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)  # Optional for Auth0 users
    is_active = Column(Boolean, default=True)
    profile_picture_url = Column(String, nullable=True)
    status = Column(String, default="offline")
    last_seen = Column(DateTime, nullable=True)
    last_profile_generated = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    is_bot = Column(Boolean, default=False)

    # Relationships
    messages = relationship("Message", back_populates="sender")
    channels = relationship("Channel", secondary="channel_members", back_populates="members")
    created_channels = relationship("Channel", back_populates="created_by")
    files = relationship("File", back_populates="uploaded_by")
    reactions = relationship("Reaction", back_populates="user")
    presence = relationship("Presence", back_populates="user", uselist=False)
    bot_scores = relationship("BotMessageScore", back_populates="bot_user") 