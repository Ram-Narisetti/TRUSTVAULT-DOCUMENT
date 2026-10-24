import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")


class Config:
    """Base application configuration."""
    SECRET_KEY = os.getenv("SECRET_KEY", "trustvault-dev-secret-key-change-in-production-min32bytes!")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("SECRET_KEY", "trustvault-jwt-dev-secret-key-min32bytes!"))
    JWT_EXPIRATION_DELTA = timedelta(hours=int(os.getenv("JWT_EXPIRATION_HOURS", 8)))
    
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        instance_dir = BASE_DIR / "instance"
        instance_dir.mkdir(parents=True, exist_ok=True)
        db_file = (instance_dir / "trustvault.db").resolve()
        DATABASE_URL = f"sqlite:///{db_file.as_posix()}"
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # File Storage
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads"))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 15 * 1024 * 1024))  # 15 MB
    
    # Allowed File Extensions
    ALLOWED_EXTENSIONS = {
        "pdf", "docx", "xlsx", "pptx", "txt", "csv", "png", "jpg", "jpeg"
    }
    
    # Security & Rate Limiting
    RATELIMIT_DEFAULT = "120/minute"
    RATELIMIT_STORAGE_URI = "memory://"
    RATELIMIT_STRATEGY = "fixed-window"
    
    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    
    # Environment
    ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"


class TestingConfig(Config):
    """Configuration for automated test suite."""
    TESTING = True
    test_db = (BASE_DIR / "instance" / "test_trustvault.db").resolve()
    test_db.parent.mkdir(parents=True, exist_ok=True)
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{test_db.as_posix()}"
    UPLOAD_FOLDER = str(BASE_DIR / "tests" / "test_uploads")
    RATELIMIT_ENABLED = False  # Controlled per test

