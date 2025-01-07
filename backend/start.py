import os
import sys
from pathlib import Path

# Add the project root to PYTHONPATH
root_dir = str(Path(__file__).parent.parent)
if root_dir not in sys.path:
    sys.path.append(root_dir)

os.system("uvicorn backend.main:app --reload") 