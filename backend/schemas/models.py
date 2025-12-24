"""Extraction models API schemas."""

from typing import Optional
from pydantic import BaseModel


class ExtractionModelResponse(BaseModel):
    """Available extraction model."""

    id: str
    provider: str
    model_name: str
    display_name: str
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0

    class Config:
        from_attributes = True


class ProviderInfo(BaseModel):
    """Extraction provider information."""

    id: str  # anthropic, openai, landing_ai
    display_name: str
    is_configured: bool  # Has API key configured
    models: list[ExtractionModelResponse] = []


class ModelPickerResponse(BaseModel):
    """Response for model picker endpoint."""

    providers: list[ProviderInfo]
