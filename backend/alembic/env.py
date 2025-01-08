from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# this is the Alembic Config object
config = context.config

# Set the sqlalchemy url from environment variable
config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL"))

# ... rest of your env.py configuration ... 