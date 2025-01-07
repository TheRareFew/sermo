import os
from dotenv import load_dotenv

load_dotenv()

# Test database configuration
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:password@localhost/sermo_test"  # Update with your password
) 