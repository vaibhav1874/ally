import os
from pathlib import Path
from dotenv import load_dotenv

# Load env files
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# Core Configurations
API_PORT = int(os.getenv("PORT", 8000))
API_HOST = os.getenv("HOST", "127.0.0.1")

# SQLite Database Location
DB_PATH = BASE_DIR / "ally.db"

# Gemini Configs
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Sandbox Directory for Safe Execution
SANDBOX_DIR = BASE_DIR / "sandbox"
SANDBOX_DIR.mkdir(exist_ok=True)

# Application System States
DEBUG = os.getenv("DEBUG", "true").lower() in ("true", "1", "t")

def verify_config():
    """Validates configuration and prints warnings if secrets are missing."""
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY is not set. Ally's cognitive features will be restricted to offline fallback.")
    else:
        print("Gemini API key is configured successfully.")
    print(f"Database path: {DB_PATH}")
    print(f"Sandbox directory: {SANDBOX_DIR}")
