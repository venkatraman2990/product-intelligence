"""Extraction management endpoints."""

from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.models.contract import Contract
from backend.models.extraction import Extraction
from backend.schemas.extraction import (
    ExtractionRequest,
    ExtractionResponse,
    ExtractionStatus,
    ExtractionResult,
    ExtractionUpdate,
    ExtractionSummary,
)

# Import extractors from existing code
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from src.extractors import get_extractor
from src.schema import ContractData

router = APIRouter()


def run_extraction_task(
    extraction_id: str,
    contract_id: str,
    model_provider: str,
    model_name: str,
    document_path: str,
    document_text: str,
):
    """Background task to run extraction."""
    from backend.core.database import SessionLocal

    db = SessionLocal()
    try:
        # Update status to processing
        extraction = db.query(Extraction).filter(Extraction.id == extraction_id).first()
        if not extraction:
            return

        extraction.status = "processing"
        extraction.started_at = datetime.utcnow()
        db.commit()

        try:
            # Initialize extractor
            if model_provider == "landing_ai":
                extractor = get_extractor("landing_ai")
            else:
                extractor = get_extractor(
                    "llm",
                    provider=model_provider,
                    model=model_name
                )

            # Run extraction
            result: ContractData = extractor.extract(
                document_path=document_path,
                document_text=document_text
            )

            # Count extracted fields
            flat_data = result.to_flat_dict()
            fields_extracted = sum(
                1 for v in flat_data.values()
                if v is not None and v != "" and v != []
            )
            fields_total = len(ContractData.get_flat_columns())

            # Update extraction record
            extraction.extracted_data = flat_data
            extraction.status = "completed"
            extraction.completed_at = datetime.utcnow()
            extraction.fields_extracted = fields_extracted
            extraction.fields_total = fields_total
            extraction.extraction_notes = result.extraction_notes

        except Exception as e:
            extraction.status = "failed"
            extraction.error_message = str(e)
            extraction.completed_at = datetime.utcnow()

        db.commit()

    finally:
        db.close()


@router.post("/", response_model=ExtractionResponse)
async def start_extraction(
    request: ExtractionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start an extraction job for a contract.

    - Creates extraction record with status 'pending'
    - Queues background task
    - Returns extraction ID for status polling
    """
    # Verify contract exists
    contract = db.query(Contract).filter(
        Contract.id == request.contract_id,
        Contract.is_deleted == False
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Validate provider
    valid_providers = {"anthropic", "openai", "landing_ai"}
    if request.model_provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Valid options: {', '.join(valid_providers)}"
        )

    # Create extraction record
    extraction = Extraction(
        contract_id=request.contract_id,
        version_id=request.version_id,
        model_provider=request.model_provider,
        model_name=request.model_name,
        status="pending",
    )

    db.add(extraction)
    db.commit()
    db.refresh(extraction)

    # Queue background task
    background_tasks.add_task(
        run_extraction_task,
        extraction_id=extraction.id,
        contract_id=contract.id,
        model_provider=request.model_provider,
        model_name=request.model_name,
        document_path=contract.file_path,
        document_text=contract.extracted_text,
    )

    return ExtractionResponse(
        extraction_id=extraction.id,
        contract_id=contract.id,
        status="pending",
        model_provider=request.model_provider,
        model_name=request.model_name,
        message="Extraction started. Poll /extractions/{id}/status for updates.",
    )


@router.get("/{extraction_id}", response_model=ExtractionResult)
async def get_extraction(
    extraction_id: str,
    db: Session = Depends(get_db)
):
    """Get extraction result by ID."""
    extraction = db.query(Extraction).filter(Extraction.id == extraction_id).first()

    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    return ExtractionResult(
        id=extraction.id,
        contract_id=extraction.contract_id,
        version_id=extraction.version_id,
        model_provider=extraction.model_provider,
        model_name=extraction.model_name,
        status=extraction.status,
        started_at=extraction.started_at,
        completed_at=extraction.completed_at,
        error_message=extraction.error_message,
        extracted_data=extraction.extracted_data or {},
        fields_extracted=extraction.fields_extracted,
        fields_total=extraction.fields_total,
        extraction_notes=extraction.extraction_notes or [],
        created_at=extraction.created_at,
    )


@router.get("/{extraction_id}/status", response_model=ExtractionStatus)
async def get_extraction_status(
    extraction_id: str,
    db: Session = Depends(get_db)
):
    """Get extraction job status for polling."""
    extraction = db.query(Extraction).filter(Extraction.id == extraction_id).first()

    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    # Calculate progress
    progress = None
    if extraction.status == "pending":
        progress = 0
    elif extraction.status == "processing":
        progress = 50
    elif extraction.status in ("completed", "failed"):
        progress = 100

    return ExtractionStatus(
        extraction_id=extraction.id,
        status=extraction.status,
        started_at=extraction.started_at,
        completed_at=extraction.completed_at,
        error_message=extraction.error_message,
        progress_percent=progress,
    )


@router.get("/contract/{contract_id}", response_model=list[ExtractionSummary])
async def list_contract_extractions(
    contract_id: str,
    db: Session = Depends(get_db)
):
    """List all extractions for a contract."""
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.is_deleted == False
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    extractions = db.query(Extraction).filter(
        Extraction.contract_id == contract_id
    ).order_by(Extraction.created_at.desc()).all()

    return [
        ExtractionSummary(
            id=e.id,
            contract_id=e.contract_id,
            contract_filename=contract.original_filename,
            model_provider=e.model_provider,
            model_name=e.model_name,
            status=e.status,
            fields_extracted=e.fields_extracted,
            created_at=e.created_at,
        )
        for e in extractions
    ]


@router.patch("/{extraction_id}", response_model=ExtractionResult)
async def update_extraction(
    extraction_id: str,
    updates: ExtractionUpdate,
    db: Session = Depends(get_db)
):
    """Update extracted fields (manual corrections)."""
    extraction = db.query(Extraction).filter(Extraction.id == extraction_id).first()

    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    if extraction.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Can only update completed extractions"
        )

    # Merge updates
    current_data = extraction.extracted_data or {}
    current_data.update(updates.extracted_data)
    extraction.extracted_data = current_data
    extraction.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(extraction)

    return ExtractionResult(
        id=extraction.id,
        contract_id=extraction.contract_id,
        version_id=extraction.version_id,
        model_provider=extraction.model_provider,
        model_name=extraction.model_name,
        status=extraction.status,
        started_at=extraction.started_at,
        completed_at=extraction.completed_at,
        error_message=extraction.error_message,
        extracted_data=extraction.extracted_data or {},
        fields_extracted=extraction.fields_extracted,
        fields_total=extraction.fields_total,
        extraction_notes=extraction.extraction_notes or [],
        created_at=extraction.created_at,
    )


@router.get("/", response_model=list[ExtractionSummary])
async def list_extractions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all extractions with filtering."""
    query = db.query(Extraction)

    if status:
        query = query.filter(Extraction.status == status)

    extractions = query.order_by(Extraction.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for e in extractions:
        contract = db.query(Contract).filter(Contract.id == e.contract_id).first()
        result.append(ExtractionSummary(
            id=e.id,
            contract_id=e.contract_id,
            contract_filename=contract.original_filename if contract else None,
            model_provider=e.model_provider,
            model_name=e.model_name,
            status=e.status,
            fields_extracted=e.fields_extracted,
            created_at=e.created_at,
        ))

    return result
