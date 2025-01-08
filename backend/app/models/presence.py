from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base
import datetime

class Presence(Base):
    __tablename__ = "presence"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    status = Column(String)  # online, offline, away, busy
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="presence_status", uselist=False) 