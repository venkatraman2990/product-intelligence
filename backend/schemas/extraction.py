"""Extraction API schemas."""

from datetime import datetime
from typing import Optional, Any, List
from pydantic import BaseModel, Field


class ExtractionRequest(BaseModel):
    """Request to start an extraction."""

    contract_id: str
    model_provider: str = "anthropic"  # anthropic, openai, landing_ai
    model_name: str = "claude-opus-4-20250514"
    version_id: Optional[str] = None


class ExtractionResponse(BaseModel):
    """Response after starting extraction."""

    extraction_id: str
    contract_id: str
    status: str
    model_provider: str
    model_name: str
    message: str = "Extraction started"


class ExtractionStatus(BaseModel):
    """Extraction job status."""

    extraction_id: str
    status: str  # pending, processing, completed, failed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    progress_percent: Optional[int] = None


class ExtractionResult(BaseModel):
    """Full extraction result."""

    id: str
    contract_id: str
    version_id: Optional[str] = None
    model_provider: str
    model_name: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    # Extracted data
    extracted_data: dict = Field(default_factory=dict)
    fields_extracted: Optional[int] = None
    fields_total: Optional[int] = None
    extraction_notes: list = Field(default_factory=list)

    created_at: datetime

    class Config:
        from_attributes = True


class ExtractionUpdate(BaseModel):
    """Request to update extraction fields."""

    extracted_data: dict = Field(default_factory=dict)


class ExtractionSummary(BaseModel):
    """Summary for list views."""

    id: str
    contract_id: str
    contract_filename: Optional[str] = None
    model_provider: str
    model_name: str
    status: str
    fields_extracted: Optional[int] = None
    fields_total: Optional[int] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    extracted_data: dict = Field(default_factory=dict)
    extraction_notes: list = Field(default_factory=list)

    class Config:
        from_attributes = True


# =============================================================================
# FEATURED MODELS SCHEMAS
# =============================================================================

class FeaturedModelConfig(BaseModel):
    """Configuration for a single featured model."""

    model_id: str
    display_name: Optional[str] = None  # Custom display name (optional)
    sort_order: int = 0


class FeaturedModelResponse(BaseModel):
    """Response for a featured model with full details."""

    id: str
    provider: str
    model_id: str
    display_name: Optional[str] = None
    sort_order: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeaturedModelsUpdate(BaseModel):
    """Request to update featured models for a provider."""

    provider: str  # anthropic or openai
    models: List[FeaturedModelConfig]


class FeaturedModelsResponse(BaseModel):
    """Response with all featured models for a provider."""

    provider: str
    models: List[FeaturedModelResponse]
