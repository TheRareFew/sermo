from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime
import os
from dotenv import load_dotenv
from passlib.context import CryptContext
from sqlalchemy.exc import OperationalError
import sys
from pathlib import Path

# Debug: Print current working directory
print(f"Current working directory: {os.getcwd()}")

# Clear any existing DATABASE_URL from environment
if 'DATABASE_URL' in os.environ:
    del os.environ['DATABASE_URL']

# Load from .env file
env_path = Path(__file__).parent.parent / '.env'
print(f"Looking for .env at: {env_path}")

if env_path.exists():
    print(f"Loading .env from: {env_path}")
    load_dotenv(env_path, override=True)
else:
    print(f"Warning: .env file not found at {env_path}")

DATABASE_URL = os.getenv("DATABASE_URL")
print(f"Loaded DATABASE_URL: {DATABASE_URL}")

if not DATABASE_URL:
    print("Error: DATABASE_URL not set in environment")
    print(f"Checked location: {env_path}")
    sys.exit(1)

try:
    engine = create_engine(DATABASE_URL, future=True)
    # Test the connection
    with engine.connect() as conn:
        pass
except OperationalError as e:
    print(f"Error connecting to database: {e}")
    print(f"Using DATABASE_URL: {DATABASE_URL}")
    sys.exit(1)

# Use declarative_base from orm instead of ext.declarative
Base = declarative_base()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    sender = Column(String)
    account_name = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    channel_id = Column(Integer, ForeignKey("channels.id"))
    message_type = Column(String, default="message")
    recipient_id = Column(String, nullable=True)
    
    channel = relationship("Channel", back_populates="messages")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    display_name = Column(String)
    status = Column(String, default="online")
    created_at = Column(DateTime, default=datetime.utcnow)

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.password_hash)

class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    messages = relationship("Message", back_populates="channel")

def init_db():
    # Drop all tables in correct order
    Message.__table__.drop(engine, checkfirst=True)
    Channel.__table__.drop(engine, checkfirst=True)
    User.__table__.drop(engine, checkfirst=True)
    
    # Recreate all tables
    Base.metadata.create_all(bind=engine)
    
    # Create a default channel
    db = SessionLocal()
    try:
        default_channel = Channel(name="General")
        db.add(default_channel)
        db.commit()
        print("Created default channel")
    except Exception as e:
        print(f"Error creating default channel: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 