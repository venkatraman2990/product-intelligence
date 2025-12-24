"""Backend configuration settings."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
BACKEND_DIR = Path(__file__).parent.parent
STORAGE_DIR = BACKEND_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"

# Ensure directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Database
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/product_intelligence"
)

# For SQLite fallback (easier local development)
SQLITE_URL = f"sqlite:///{BASE_DIR}/data/product_intelligence.db"

# Use SQLite if PostgreSQL not configured
USE_SQLITE = os.getenv("USE_SQLITE", "true").lower() == "true"

if USE_SQLITE:
    # Ensure data directory exists
    (BASE_DIR / "data").mkdir(parents=True, exist_ok=True)
    SQLALCHEMY_DATABASE_URL = SQLITE_URL
else:
    SQLALCHEMY_DATABASE_URL = DATABASE_URL

# API settings
API_V1_PREFIX = "/api"
PROJECT_NAME = "Product Intelligence"

# File upload settings
MAX_UPLOAD_SIZE_MB = 50
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}

# CORS settings
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
