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

# Ollama Configs
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava")

# Sandbox Directory for Safe Execution
SANDBOX_DIR = BASE_DIR / "sandbox"
SANDBOX_DIR.mkdir(exist_ok=True)

# Application System States
DEBUG = os.getenv("DEBUG", "true").lower() in ("true", "1", "t")

def verify_config():
    """Validates configuration and prints local model setup."""
    print("Ally configured to run in Local AI Mode using Ollama.")
    print(f"Ollama host endpoint: {OLLAMA_HOST}")
    print(f"Ollama chat model: {OLLAMA_MODEL}")
    print(f"Ollama vision model: {OLLAMA_VISION_MODEL}")
    print(f"Database path: {DB_PATH}")
    print(f"Sandbox directory: {SANDBOX_DIR}")
