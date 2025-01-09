"""
Convenience script to run all tests with coverage report.
Run this script from the backend directory using: python -m tests.run_all_tests
"""

import pytest
import sys
from pathlib import Path

def main():
    # Get the tests directory
    tests_dir = Path(__file__).parent
    
    # Arguments for pytest
    args = [
        "-v",                     # Verbose output
        "--cov=app",             # Coverage for app directory
        "--cov-report=term",     # Terminal coverage report
        "--cov-report=html",     # HTML coverage report
        str(tests_dir / "api"),  # Test directory
    ]
    
    # Run the tests
    exit_code = pytest.main(args)
    
    # Print coverage report location
    if exit_code == 0:
        print("\nHTML coverage report generated in htmlcov/index.html")
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main() 