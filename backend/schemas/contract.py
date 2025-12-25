"""Contract API schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ContractCreate(BaseModel):
    """Schema for contract creation (upload response)."""

    filename: str
    original_filename: str
    file_type: str
    file_size_bytes: int


class ContractResponse(BaseModel):
    """Basic contract response."""

    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    page_count: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ContractListItem(BaseModel):
    """Contract item for list view."""

    id: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    page_count: Optional[int] = None
    uploaded_at: datetime
    extraction_count: int = 0
    latest_extraction_status: Optional[str] = None

    class Config:
        from_attributes = True


class ContractDetail(BaseModel):
    """Detailed contract information."""

    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    file_hash: str
    page_count: Optional[int] = None
    document_metadata: dict = Field(default_factory=dict)
    uploaded_at: datetime
    updated_at: datetime
    text_preview: Optional[str] = None  # First 1000 chars
    extracted_text: Optional[str] = None  # Full document text for citation highlighting

    class Config:
        from_attributes = True


class DocumentPreview(BaseModel):
    """Parsed document preview."""

    contract_id: str
    filename: str
    file_type: str
    page_count: Optional[int] = None
    total_characters: int
    text_preview: str  # First 2000 chars
    metadata: dict = Field(default_factory=dict)


class ContractVersionResponse(BaseModel):
    """Contract version response."""

    id: str
    contract_id: str
    version_number: int
    file_hash: str
    change_description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    """Response after successful upload."""

    id: str  # Contract ID (for frontend compatibility)
    contract_id: str  # Contract ID (legacy)
    filename: str
    file_type: str
    file_size_bytes: int
    page_count: Optional[int] = None
    text_preview: str
    message: str = "Contract uploaded successfully"
    is_duplicate: bool = False
    existing_contract_id: Optional[str] = None
