"""Extraction ORM models."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship

from backend.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Extraction(Base):
    """Extraction job and results."""

    __tablename__ = "extractions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)
    version_id = Column(String(36), ForeignKey("contract_versions.id"), nullable=True)

    # Extraction configuration
    model_provider = Column(String(50), nullable=False)  # anthropic, openai, landing_ai
    model_name = Column(String(100), nullable=False)  # claude-opus-4-20250514, gpt-4o, etc.

    # Status tracking
    status = Column(String(50), nullable=False, default="pending")  # pending, processing, completed, failed
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)

    # Extracted data (JSON matching ContractData schema)
    extracted_data = Column(JSON, default=dict)

    # Quality metrics
    confidence_score = Column(Float)
    fields_extracted = Column(Integer)
    fields_total = Column(Integer)
    extraction_notes = Column(JSON, default=list)

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    contract = relationship("Contract", back_populates="extractions")
    version = relationship("ContractVersion", back_populates="extractions")

    def __repr__(self):
        return f"<Extraction {self.id}: {self.status}>"


class ExtractionModel(Base):
    """Available extraction models."""

    __tablename__ = "extraction_models"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider = Column(String(50), nullable=False)  # anthropic, openai, landing_ai
    model_name = Column(String(100), nullable=False)
    display_name = Column(String(200), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)

    # Configuration
    max_tokens = Column(Integer, default=8192)
    supports_json_mode = Column(Boolean, default=False)

    # Ordering for UI
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ExtractionModel {self.provider}/{self.model_name}>"
