from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, Boolean
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime, UTC

# Association table for channel members
channel_members = Table(
    "channel_members",
    Base.metadata,
    Column("channel_id", Integer, ForeignKey("channels.id")),
    Column("user_id", Integer, ForeignKey("users.id")),
)

class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    is_direct_message = Column(Boolean, default=False)
    is_public = Column(Boolean, default=True)
    is_vc = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    created_by_id = Column(Integer, ForeignKey("users.id"))

    # Set up relationships
    messages = relationship("Message", back_populates="channel")
    members = relationship("User", secondary=channel_members, back_populates="channels")
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="created_channels") 