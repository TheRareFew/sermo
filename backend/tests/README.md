# Test Suite Documentation

## Overview
This directory contains the test suite for the SERMO chat application backend. The tests are written using pytest and follow the same directory structure as the main application code.

## Directory Structure
```
tests/
├── api/
│   └── v1/
│       ├── test_channels.py
│       └── ... (other endpoint tests)
├── conftest.py
└── README.md
```

## Test Configuration
- `conftest.py`: Contains pytest fixtures and test configuration
- Uses SQLite in-memory database for testing
- Provides fixtures for:
  - Database session
  - Test application instance
  - Async HTTP client
  - Test user and authentication

## Running Tests
To run the test suite:
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/api/v1/test_channels.py

# Run with verbose output
pytest -v

# Run with coverage report
pytest --cov=app
```

## Test Conventions
1. Test files should mirror the structure of the application
2. Each endpoint should have both success and error case tests
3. Use descriptive test names that indicate what is being tested
4. Each test should be independent and clean up after itself
5. Use fixtures for common setup code
6. Include docstrings for test functions

## Fixtures
- `db`: Provides a fresh database session for each test
- `test_app`: Creates a test instance of the FastAPI application
- `async_client`: Provides an async HTTP client for testing endpoints
- `test_user`: Creates a test user
- `test_user_token`: Provides an authentication token for the test user

## Database
Tests use an in-memory SQLite database with the following characteristics:
- Fresh database for each test
- Automatic cleanup after each test
- No persistence between tests
- Fast execution

## Authentication
Test authentication is handled through:
- JWT tokens generated for test users
- Bearer token authentication
- Automatic token generation in fixtures 