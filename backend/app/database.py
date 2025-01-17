from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from datetime import datetime, UTC

# Load environment variables from .env file
load_dotenv()

# Use DATABASE_URL from environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def create_test_users(db_session):
    """Create test users for development"""
    from .models.user import User
    from .auth.security import get_password_hash
    
    test_users = [
        {
            "username": "test_00",
            "email": "test00@example.com",
            "full_name": "Test User 00",
            "password": "1234",
            "is_active": True
        },
        {
            "username": "test_01",
            "email": "test01@example.com",
            "full_name": "Test User 01",
            "password": "1234",
            "is_active": True
        }
    ]
    
    for user_data in test_users:
        user = User(
            username=user_data["username"],
            email=user_data["email"],
            full_name=user_data["full_name"],
            hashed_password=get_password_hash(user_data["password"]),
            is_active=user_data["is_active"],
            status="offline",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )
        db_session.add(user)
    
    try:
        db_session.commit()
        print(f"Created test users: {[user['username'] for user in test_users]}")
    except Exception as e:
        print(f"Error creating test users: {e}")
        db_session.rollback()

def init_db(create_test_data: bool = False):
    """Initialize database tables"""
    # Import all models here to ensure they are registered with SQLAlchemy
    from .models.user import User
    from .models.channel import Channel
    from .models.message import Message
    from .models.file import File
    from .models.presence import Presence
    from .models.reaction import Reaction
    from .models.bot_message_score import BotMessageScore
    from .auth.security import RefreshToken
    
    # Check if tables exist by trying to query the User table
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables_exist = inspector.has_table("users")
    
    if not tables_exist:
        print("Creating all tables...")
        Base.metadata.create_all(bind=engine)
        
        if create_test_data:
            # Create test users only if tables were just created
            print("Creating test users...")
            db = SessionLocal()
            try:
                create_test_users(db)
            finally:
                db.close()
        print("Database initialization complete!")
    else:
        print("Tables already exist, skipping initialization.")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 