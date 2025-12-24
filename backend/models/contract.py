"""Contract ORM models."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from backend.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Contract(Base):
    """Uploaded contract document."""

    __tablename__ = "contracts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, doc
    file_size_bytes = Column(BigInteger, nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)  # SHA-256

    # Parsed document data
    page_count = Column(Integer)
    extracted_text = Column(Text)
    document_metadata = Column(JSON, default=dict)

    # Tracking
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Soft delete
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime)

    # Relationships
    versions = relationship("ContractVersion", back_populates="contract", cascade="all, delete-orphan")
    extractions = relationship("Extraction", back_populates="contract", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Contract {self.id}: {self.original_filename}>"


class ContractVersion(Base):
    """Track different versions of the same contract."""

    __tablename__ = "contract_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    parent_version_id = Column(String(36), ForeignKey("contract_versions.id"))

    # Version-specific file info
    file_path = Column(String(500), nullable=False)
    file_hash = Column(String(64), nullable=False)

    # Change tracking
    change_description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    contract = relationship("Contract", back_populates="versions")
    extractions = relationship("Extraction", back_populates="version")

    def __repr__(self):
        return f"<ContractVersion {self.contract_id} v{self.version_number}>"
