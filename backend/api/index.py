import sys
from pathlib import Path

# Add backend directory to Python path so relative imports work
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app  # noqa: E402
