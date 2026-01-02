"""Extraction models management endpoints."""

import os
import httpx
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.models.extraction import ExtractionModel, FeaturedModel
from backend.schemas.models import ExtractionModelResponse, ProviderInfo, ModelPickerResponse
from backend.schemas.extraction import FeaturedModelConfig, FeaturedModelResponse, FeaturedModelsUpdate, FeaturedModelsResponse

router = APIRouter()

MODEL_DESCRIPTIONS = {
    "opus": "Most capable for complex work",
    "sonnet": "Best for everyday tasks",
    "haiku": "Fastest for quick answers",
}

OPENAI_MODEL_DESCRIPTIONS = {
    "gpt-4o": "Most capable multimodal model",
    "gpt-4o-mini": "Fast and affordable",
    "o1": "Advanced reasoning capabilities",
    "o1-mini": "Fast reasoning model",
    "o3-mini": "Latest compact reasoning",
    "gpt-4-turbo": "High capability with vision",
    "gpt-4": "Strong general performance",
    "gpt-3.5-turbo": "Fast and cost-effective",
}

def get_model_family(model_id: str) -> Optional[str]:
    """Extract the model family (opus, sonnet, haiku) from model ID."""
    model_lower = model_id.lower()
    if "opus" in model_lower:
        return "opus"
    elif "sonnet" in model_lower:
        return "sonnet"
    elif "haiku" in model_lower:
        return "haiku"
    return None

def get_model_version(display_name: str) -> str:
    """Extract version number from display name like 'Claude Sonnet 4' -> '4'."""
    parts = display_name.split()
    for part in reversed(parts):
        if part.replace('.', '').isdigit():
            return part
    return ""


def get_openai_model_family(model_id: str) -> Optional[str]:
    """Extract the model family from OpenAI model ID."""
    model_lower = model_id.lower()

    # Check for reasoning models first (o1, o3)
    if model_lower.startswith("o3"):
        return "o3"
    if model_lower.startswith("o1"):
        return "o1"

    # GPT-4o variants (gpt-4o, gpt-4o-mini)
    if "gpt-4o-mini" in model_lower:
        return "gpt-4o-mini"
    if "gpt-4o" in model_lower:
        return "gpt-4o"

    # GPT-4 turbo
    if "gpt-4-turbo" in model_lower:
        return "gpt-4-turbo"

    # Original GPT-4
    if model_lower.startswith("gpt-4"):
        return "gpt-4"

    # GPT-3.5
    if "gpt-3.5" in model_lower:
        return "gpt-3.5-turbo"

    return None


def get_openai_family_priority(family: str) -> int:
    """Return priority for OpenAI model families (higher = more prominent)."""
    priorities = {
        "gpt-4o": 100,
        "gpt-4o-mini": 90,
        "o1": 85,
        "o3": 80,
        "gpt-4-turbo": 70,
        "gpt-4": 60,
        "gpt-3.5-turbo": 50,
        "o1-mini": 45,
    }
    return priorities.get(family, 0)


def is_openai_chat_model(model_id: str) -> bool:
    """Check if model ID is a chat completion model we should show."""
    model_lower = model_id.lower()
    # Include GPT models and reasoning models
    if any(prefix in model_lower for prefix in ["gpt-4", "gpt-3.5", "o1", "o3"]):
        # Exclude specialized variants that aren't standard chat models
        exclude_patterns = [
            "instruct", "embedding", "audio", "realtime", "tts", "whisper", "dall-e",
            "transcribe", "diarize", "search", "deep-research", "-pro"
        ]
        if not any(pattern in model_lower for pattern in exclude_patterns):
            return True
    return False


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


@router.get("/anthropic")
async def get_anthropic_models(db: Session = Depends(get_db)):
    """Fetch available Claude models from Anthropic API dynamically."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    is_configured = bool(api_key)

    if not is_configured:
        return {
            "is_configured": False,
            "featured_models": [],
            "other_models": [],
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

        models_data = data.get("data", [])

        # Build a map of all models from API
        all_models_map: dict[str, dict] = {}
        models_by_family: dict[str, list] = {
            "opus": [],
            "sonnet": [],
            "haiku": [],
            "other": [],
        }

        for model in models_data:
            model_id = model.get("id", "")
            display_name = model.get("display_name", model_id)
            created_at = model.get("created_at", "")

            family = get_model_family(model_id)
            version = get_model_version(display_name)

            model_info = {
                "id": model_id,
                "display_name": display_name,
                "family": family or "other",
                "version": version,
                "created_at": created_at,
                "description": MODEL_DESCRIPTIONS.get(family, "") if family else "",
            }

            all_models_map[model_id] = model_info

            if family:
                models_by_family[family].append(model_info)
            else:
                models_by_family["other"].append(model_info)

        for family in models_by_family:
            models_by_family[family].sort(key=lambda x: x.get("created_at", ""), reverse=True)

        # Check for DB-configured featured models
        db_featured = get_featured_model_configs(db, "anthropic")

        if db_featured:
            # Use DB configuration
            featured_models = []
            featured_ids = set()

            for fm in db_featured:
                if fm.model_id in all_models_map:
                    model_info = all_models_map[fm.model_id].copy()
                    # Apply custom display name if set
                    if fm.display_name:
                        model_info["display_name"] = fm.display_name
                    featured_models.append(model_info)
                    featured_ids.add(fm.model_id)

            # Other models are everything not featured
            other_models = [m for m in all_models_map.values() if m["id"] not in featured_ids]
            other_models.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        else:
            # Default behavior: latest from each family
            featured_models = []
            other_models = []

            for family in ["opus", "sonnet", "haiku"]:
                if models_by_family[family]:
                    latest = models_by_family[family][0]
                    featured_models.append(latest)
                    other_models.extend(models_by_family[family][1:])

            other_models.extend(models_by_family["other"])
            other_models.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        return {
            "is_configured": True,
            "featured_models": featured_models,
            "other_models": other_models,
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch Anthropic models")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching models: {str(e)}")


@router.get("/openai")
async def get_openai_models(db: Session = Depends(get_db)):
    """Fetch available OpenAI models from OpenAI API dynamically."""
    api_key = os.getenv("OPENAI_API_KEY")
    is_configured = bool(api_key)

    if not is_configured:
        return {
            "is_configured": False,
            "featured_models": [],
            "other_models": [],
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={
                    "Authorization": f"Bearer {api_key}",
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

        models_data = data.get("data", [])

        # Build a map of all models and group by family
        all_models_map: dict[str, dict] = {}
        models_by_family: dict[str, list] = {}

        for model in models_data:
            model_id = model.get("id", "")

            # Only include chat completion models
            if not is_openai_chat_model(model_id):
                continue

            family = get_openai_model_family(model_id)
            if not family:
                continue

            created = model.get("created", 0)

            model_info = {
                "id": model_id,
                "display_name": model_id,  # OpenAI uses ID as display name
                "family": family,
                "created": created,
                "description": OPENAI_MODEL_DESCRIPTIONS.get(family, ""),
            }

            all_models_map[model_id] = model_info

            if family not in models_by_family:
                models_by_family[family] = []
            models_by_family[family].append(model_info)

        # Sort each family by created date (newest first)
        for family in models_by_family:
            models_by_family[family].sort(key=lambda x: x.get("created", 0), reverse=True)

        # Check for DB-configured featured models
        db_featured = get_featured_model_configs(db, "openai")

        if db_featured:
            # Use DB configuration
            featured_models = []
            featured_ids = set()

            for fm in db_featured:
                if fm.model_id in all_models_map:
                    model_info = all_models_map[fm.model_id].copy()
                    # Apply custom display name if set
                    if fm.display_name:
                        model_info["display_name"] = fm.display_name
                    featured_models.append(model_info)
                    featured_ids.add(fm.model_id)

            # Other models are everything not featured
            other_models = [m for m in all_models_map.values() if m["id"] not in featured_ids]
            other_models.sort(
                key=lambda x: (-get_openai_family_priority(x.get("family", "")), -x.get("created", 0))
            )
        else:
            # Default behavior: latest from each featured family
            featured_families = ["gpt-4o", "gpt-4o-mini", "o1", "o3"]

            featured_models = []
            other_models = []

            # Pick latest from each featured family
            for family in featured_families:
                if family in models_by_family and models_by_family[family]:
                    latest = models_by_family[family][0]
                    featured_models.append(latest)
                    # Add older versions to other_models
                    other_models.extend(models_by_family[family][1:])

            # Add remaining families to other_models
            for family, models in models_by_family.items():
                if family not in featured_families:
                    other_models.extend(models)

        # Sort other_models by family priority then created date
        other_models.sort(
            key=lambda x: (-get_openai_family_priority(x.get("family", "")), -x.get("created", 0))
        )

        return {
            "is_configured": True,
            "featured_models": featured_models,
            "other_models": other_models,
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch OpenAI models")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching OpenAI models: {str(e)}")


# =============================================================================
# FEATURED MODELS MANAGEMENT
# =============================================================================

def get_featured_model_configs(db: Session, provider: str) -> list[FeaturedModel]:
    """Get configured featured models for a provider from database."""
    return db.query(FeaturedModel).filter(
        FeaturedModel.provider == provider
    ).order_by(FeaturedModel.sort_order).all()


def get_featured_model_display_name(db: Session, provider: str, model_id: str) -> Optional[str]:
    """Get custom display name for a model if configured."""
    fm = db.query(FeaturedModel).filter(
        FeaturedModel.provider == provider,
        FeaturedModel.model_id == model_id
    ).first()
    return fm.display_name if fm and fm.display_name else None


@router.get("/featured/{provider}", response_model=FeaturedModelsResponse)
async def get_featured_models(
    provider: str,
    db: Session = Depends(get_db)
):
    """Get configured featured models for a provider."""
    if provider not in ["anthropic", "openai"]:
        raise HTTPException(status_code=400, detail="Provider must be 'anthropic' or 'openai'")

    featured = get_featured_model_configs(db, provider)

    return FeaturedModelsResponse(
        provider=provider,
        models=[
            FeaturedModelResponse(
                id=fm.id,
                provider=fm.provider,
                model_id=fm.model_id,
                display_name=fm.display_name,
                sort_order=fm.sort_order,
                created_at=fm.created_at,
                updated_at=fm.updated_at,
            )
            for fm in featured
        ]
    )


@router.put("/featured", response_model=FeaturedModelsResponse)
async def update_featured_models(
    data: FeaturedModelsUpdate,
    db: Session = Depends(get_db)
):
    """Update featured models for a provider. Replaces all existing featured models."""
    if data.provider not in ["anthropic", "openai"]:
        raise HTTPException(status_code=400, detail="Provider must be 'anthropic' or 'openai'")

    # Delete existing featured models for this provider
    db.query(FeaturedModel).filter(FeaturedModel.provider == data.provider).delete()

    # Add new featured models
    new_models = []
    for idx, model_config in enumerate(data.models):
        fm = FeaturedModel(
            provider=data.provider,
            model_id=model_config.model_id,
            display_name=model_config.display_name,
            sort_order=model_config.sort_order if model_config.sort_order else idx,
        )
        db.add(fm)
        new_models.append(fm)

    db.commit()

    # Refresh to get IDs
    for fm in new_models:
        db.refresh(fm)

    return FeaturedModelsResponse(
        provider=data.provider,
        models=[
            FeaturedModelResponse(
                id=fm.id,
                provider=fm.provider,
                model_id=fm.model_id,
                display_name=fm.display_name,
                sort_order=fm.sort_order,
                created_at=fm.created_at,
                updated_at=fm.updated_at,
            )
            for fm in new_models
        ]
    )
