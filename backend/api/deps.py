"""API dependencies."""

from typing import Generator
from sqlalchemy.orm import Session

from backend.core.database import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
