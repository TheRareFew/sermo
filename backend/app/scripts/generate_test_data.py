from faker import Faker
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import List
import logging
import os

from ..database import SessionLocal
from ..models.user import User
from ..models.channel import Channel, channel_members
from ..models.message import Message
from ..models.file import File
from ..models.presence import Presence
from ..models.reaction import Reaction
from ..auth.security import get_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Faker
fake = Faker()

def create_test_users(db: Session, num_users: int = 10) -> List[User]:
    """Generate test users"""
    logger.info(f"Generating {num_users} test users...")
    users = []
    
    for _ in range(num_users):
        user = User(
            username=fake.user_name(),
            email=fake.email(),
            full_name=fake.name(),
            hashed_password=get_password_hash("testpassword123"),  # Same password for all test users
            profile_picture_url=fake.image_url(),
            status=random.choice(["online", "offline", "away", "busy"]),
            last_seen=fake.date_time_between(start_date="-30d", end_date="now"),
            created_at=fake.date_time_between(start_date="-1y", end_date="-30d"),
            is_active=True
        )
        db.add(user)
        users.append(user)
    
    db.commit()
    logger.info("Test users generated successfully")
    return users

def create_test_channels(db: Session, users: List[User], num_channels: int = 5) -> List[Channel]:
    """Generate test channels"""
    logger.info(f"Generating {num_channels} test channels...")
    channels = []
    
    for _ in range(num_channels):
        # Random subset of users for channel members
        member_count = random.randint(2, len(users))
        members = random.sample(users, member_count)
        
        channel = Channel(
            name=fake.word() if not fake.boolean(chance_of_getting_true=30) else f"dm-{fake.word()}",
            description=fake.sentence() if fake.boolean(chance_of_getting_true=70) else None,
            is_direct_message=fake.boolean(chance_of_getting_true=30),
            created_at=fake.date_time_between(start_date="-30d", end_date="now"),
            created_by_id=random.choice(users).id,
            members=members
        )
        db.add(channel)
        channels.append(channel)
    
    db.commit()
    logger.info("Test channels generated successfully")
    return channels

def create_test_messages(db: Session, channels: List[Channel], users: List[User], num_messages_per_channel: int = 20) -> List[Message]:
    """Generate test messages"""
    logger.info(f"Generating {num_messages_per_channel} messages per channel...")
    messages = []
    
    for channel in channels:
        channel_members = [member.id for member in channel.members]
        
        for _ in range(num_messages_per_channel):
            # Create parent message
            sender_id = random.choice(channel_members)
            message = Message(
                content=fake.paragraph(),
                created_at=fake.date_time_between(start_date="-30d", end_date="now"),
                updated_at=fake.date_time_between(start_date="-30d", end_date="now"),
                sender_id=sender_id,
                channel_id=channel.id
            )
            db.add(message)
            messages.append(message)
            
            # Sometimes add replies
            if fake.boolean(chance_of_getting_true=30):
                num_replies = random.randint(1, 3)
                for _ in range(num_replies):
                    reply = Message(
                        content=fake.paragraph(),
                        created_at=fake.date_time_between(start_date=message.created_at, end_date="now"),
                        updated_at=fake.date_time_between(start_date=message.created_at, end_date="now"),
                        sender_id=random.choice(channel_members),
                        channel_id=channel.id,
                        parent_id=message.id
                    )
                    db.add(reply)
                    messages.append(reply)
    
    db.commit()
    logger.info("Test messages generated successfully")
    return messages

def create_test_files(db: Session, messages: List[Message]) -> List[File]:
    """Generate test files"""
    logger.info("Generating test files...")
    files = []
    
    # Attach files to random messages
    for message in random.sample(messages, len(messages) // 5):  # Attach files to 20% of messages
        file_type = random.choice(["image/jpeg", "image/png", "image/gif", "application/pdf", "text/plain"])
        extension = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "application/pdf": ".pdf",
            "text/plain": ".txt"
        }[file_type]
        
        file = File(
            filename=f"{fake.word()}{extension}",
            file_type=file_type,
            file_size=random.randint(1000, 5000000),  # Random size between 1KB and 5MB
            file_path=f"/uploads/{fake.uuid4()}{extension}",
            uploaded_by_id=message.sender_id,
            message_id=message.id,
            created_at=fake.date_time_between(start_date=message.created_at, end_date="now"),
            updated_at=fake.date_time_between(start_date=message.created_at, end_date="now")
        )
        db.add(file)
        files.append(file)
    
    db.commit()
    logger.info("Test files generated successfully")
    return files

def create_test_presence(db: Session, users: List[User]) -> List[Presence]:
    """Generate test presence data"""
    logger.info("Generating test presence data...")
    presence_records = []
    
    for user in users:
        presence = Presence(
            user_id=user.id,
            status=random.choice(["online", "offline", "away", "busy"]),
            last_seen=fake.date_time_between(start_date="-1d", end_date="now")
        )
        db.add(presence)
        presence_records.append(presence)
    
    db.commit()
    logger.info("Test presence data generated successfully")
    return presence_records

def create_test_reactions(db: Session, messages: List[Message], users: List[User]) -> List[Reaction]:
    """Generate test reactions"""
    logger.info("Generating test reactions...")
    reactions = []
    
    # Common emojis for testing
    emoji_list = ["👍", "❤️", "😂", "🎉", "🔥", "👏", "🤔", "😍"]
    
    # Add reactions to random messages
    for message in random.sample(messages, len(messages) // 3):  # React to 33% of messages
        # Generate 1-3 reactions per message
        num_reactions = random.randint(1, 3)
        # Get random users who haven't reacted to this message yet
        potential_reactors = random.sample(users, min(num_reactions, len(users)))
        
        for user in potential_reactors:
            reaction = Reaction(
                emoji=random.choice(emoji_list),
                created_at=fake.date_time_between(start_date=message.created_at, end_date="now"),
                updated_at=fake.date_time_between(start_date=message.created_at, end_date="now"),
                user_id=user.id,
                message_id=message.id
            )
            db.add(reaction)
            reactions.append(reaction)
    
    db.commit()
    logger.info("Test reactions generated successfully")
    return reactions

def main():
    """Main function to generate all test data"""
    logger.info("Starting test data generation...")
    
    try:
        db = SessionLocal()
        
        # Generate test data
        users = create_test_users(db)
        channels = create_test_channels(db, users)
        messages = create_test_messages(db, channels, users)
        files = create_test_files(db, messages)
        presence = create_test_presence(db, users)
        reactions = create_test_reactions(db, messages, users)
        
        logger.info("Test data generation completed successfully!")
        
    except Exception as e:
        logger.error(f"Error generating test data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main() 