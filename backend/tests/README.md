# Testing Guide

This directory contains all the tests for the Sermo Chat Application backend.

## Directory Structure

```
tests/
├── api/                    # API endpoint tests
│   └── v1/                # API v1 endpoint tests
│       ├── test_files.py  # File upload/download endpoint tests
│       └── test_channels.py # Channel management endpoint tests
├── conftest.py            # Pytest configuration and fixtures
└── run_all_tests.py       # Convenience script to run all tests
```

## Running Tests

There are several ways to run the tests:

### 1. Run All Tests with Coverage Report

```powershell
# From the backend directory
pytest
```

This will automatically:
- Run all tests with verbose output
- Generate a terminal coverage report with missing lines
- Use settings from pytest.ini

### 2. Run Specific Test Files

```powershell
# Run a specific test file
pytest tests/api/v1/test_files.py

# Run all tests in a directory
pytest tests/api/v1/
```

### 3. Run Tests with Specific Markers

```powershell
# Run only API tests
pytest -m api

# Run only file-related tests
pytest -m files

# Run only channel-related tests
pytest -m channels
```

## Test Coverage

The test suite covers:
- File upload/download functionality
- Channel management
- Authorization and permissions
- Error handling
- Pagination
- Input validation

Each test file focuses on a specific area of functionality:

### test_files.py
- File upload with size and type validation
- File retrieval and deletion
- Channel file listing with pagination
- Authorization checks

### test_channels.py
- Channel creation and management
- Channel membership
- Channel settings and permissions
- Direct message channels

## Configuration

The testing configuration is managed through `pytest.ini`, which includes:
- Test discovery patterns
- Coverage reporting settings
- Warning filters
- Custom markers for test categorization 