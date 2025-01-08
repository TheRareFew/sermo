from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base
import datetime

class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    file_type = Column(String)
    file_size = Column(Integer)
    file_url = Column(String)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    message_id = Column(Integer, ForeignKey("messages.id"))

    # Relationships
    message = relationship("Message", back_populates="files") 