"""Extraction models management endpoints."""

import os
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.models.extraction import ExtractionModel
from backend.schemas.models import ExtractionModelResponse, ProviderInfo, ModelPickerResponse

router = APIRouter()

# Default models configuration
DEFAULT_MODELS = [
    {
        "provider": "anthropic",
        "model_name": "claude-opus-4-20250514",
        "display_name": "Claude Opus 4",
        "description": "Most capable Claude model - highest accuracy for complex extraction",
        "sort_order": 1,
    },
    {
        "provider": "anthropic",
        "model_name": "claude-sonnet-4-20250514",
        "display_name": "Claude Sonnet 4",
        "description": "Balanced speed and accuracy - good for most documents",
        "sort_order": 2,
    },
    {
        "provider": "openai",
        "model_name": "gpt-4o",
        "display_name": "GPT-4o",
        "description": "Latest OpenAI model with JSON mode support",
        "sort_order": 3,
        "supports_json_mode": True,
    },
    {
        "provider": "openai",
        "model_name": "gpt-4o-mini",
        "display_name": "GPT-4o Mini",
        "description": "Cost-effective option for simpler documents",
        "sort_order": 4,
        "supports_json_mode": True,
    },
    {
        "provider": "landing_ai",
        "model_name": "ade-v1",
        "display_name": "Landing AI ADE",
        "description": "Specialized document extraction API",
        "sort_order": 5,
    },
]

PROVIDER_DISPLAY_NAMES = {
    "anthropic": "Anthropic (Claude)",
    "openai": "OpenAI (GPT)",
    "landing_ai": "Landing AI",
}


def check_provider_configured(provider: str) -> bool:
    """Check if provider API key is configured."""
    if provider == "anthropic":
        return bool(os.getenv("ANTHROPIC_API_KEY"))
    elif provider == "openai":
        return bool(os.getenv("OPENAI_API_KEY"))
    elif provider == "landing_ai":
        return bool(os.getenv("LANDING_AI_API_KEY"))
    return False


def seed_default_models(db: Session):
    """Seed default extraction models if not present."""
    existing_count = db.query(ExtractionModel).count()
    if existing_count == 0:
        for model_config in DEFAULT_MODELS:
            model = ExtractionModel(
                provider=model_config["provider"],
                model_name=model_config["model_name"],
                display_name=model_config["display_name"],
                description=model_config.get("description"),
                sort_order=model_config.get("sort_order", 0),
                supports_json_mode=model_config.get("supports_json_mode", False),
            )
            db.add(model)
        db.commit()


@router.get("/", response_model=list[ExtractionModelResponse])
async def list_available_models(
    db: Session = Depends(get_db)
):
    """List available extraction models."""
    # Seed defaults if needed
    seed_default_models(db)

    models = db.query(ExtractionModel).filter(
        ExtractionModel.is_active == True
    ).order_by(ExtractionModel.sort_order).all()

    return [
        ExtractionModelResponse(
            id=m.id,
            provider=m.provider,
            model_name=m.model_name,
            display_name=m.display_name,
            description=m.description,
            is_active=m.is_active,
            sort_order=m.sort_order,
        )
        for m in models
    ]


@router.get("/picker")
async def get_model_picker_data(
    db: Session = Depends(get_db)
):
    """Get models grouped by provider for the picker UI."""
    # Seed defaults if needed
    seed_default_models(db)

    models = db.query(ExtractionModel).filter(
        ExtractionModel.is_active == True
    ).order_by(ExtractionModel.sort_order).all()

    # Group by provider - return format expected by frontend
    models_by_provider = {
        "anthropic": [],
        "openai": [],
        "landing_ai": [],
    }
    
    configured_providers = []
    
    for m in models:
        is_configured = check_provider_configured(m.provider)
        # First model per provider is the default for that provider
        is_first_for_provider = m.provider in models_by_provider and len(models_by_provider[m.provider]) == 0
        model_data = {
            "provider": m.provider,
            "model_name": m.model_name,
            "display_name": m.display_name,
            "description": m.description or "",
            "is_configured": is_configured,
            "is_default": is_first_for_provider,
        }
        if m.provider in models_by_provider:
            models_by_provider[m.provider].append(model_data)
        
        # Track configured providers
        if is_configured and m.provider not in configured_providers:
            configured_providers.append(m.provider)

    return {
        "models": models_by_provider,
        "configured_providers": configured_providers,
    }


@router.get("/providers")
async def list_providers():
    """List extraction providers with configuration status."""
    providers = []
    for provider_id, display_name in PROVIDER_DISPLAY_NAMES.items():
        providers.append({
            "id": provider_id,
            "display_name": display_name,
            "is_configured": check_provider_configured(provider_id),
        })
    return providers
