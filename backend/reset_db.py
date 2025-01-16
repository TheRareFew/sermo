from sqlalchemy import create_engine, inspect, text
from app.database import Base, init_db, DATABASE_URL, SessionLocal
import sys
from sqlalchemy.orm import close_all_sessions

def reset_database(create_test_data: bool = False):
    """Reset the database by dropping all tables and recreating them"""
    print("Starting database reset...")
    
    # Close all existing sessions
    print("Closing all database sessions...")
    close_all_sessions()
    
    # Create engine and drop all tables
    print("Dropping all tables...")
    engine = create_engine(DATABASE_URL)
    
    # Force drop all tables
    Base.metadata.reflect(engine)  # Get all tables
    Base.metadata.drop_all(engine)
    
    # Clear metadata to avoid table redefinition issues
    Base.metadata.clear()
    
    # Dispose engine connections
    engine.dispose()
    
    print("Creating new tables...")
    new_engine = create_engine(DATABASE_URL)
    
    # Import all models to ensure they are registered
    from app.models.user import User
    from app.models.channel import Channel
    from app.models.message import Message
    from app.models.file import File
    from app.models.presence import Presence
    from app.models.reaction import Reaction
    from app.auth.security import RefreshToken
    
    Base.metadata.create_all(new_engine)
    
    # Initialize with test data if requested
    if create_test_data:
        print("Adding test data...")
        init_db(create_test_data=True)
    
    print("Database reset complete!")

if __name__ == "__main__":
    # Check if --with-test-data flag is provided
    create_test_data = "--with-test-data" in sys.argv
    reset_database(create_test_data) 