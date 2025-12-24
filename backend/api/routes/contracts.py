"""Contract management endpoints."""

import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.api.deps import get_db
from backend.core.config import UPLOADS_DIR, ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_MB
from backend.models.contract import Contract
from backend.models.extraction import Extraction
from backend.schemas.contract import (
    ContractListItem,
    ContractDetail,
    DocumentPreview,
    UploadResponse,
)

# Import document loader from existing code
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from src.extractors.document_loader import DocumentLoader

router = APIRouter()
document_loader = DocumentLoader()


def compute_file_hash(file_path: Path) -> str:
    """Compute SHA-256 hash of file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


@router.post("/upload", response_model=UploadResponse)
async def upload_contract(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a contract document (PDF/Word).

    - Validates file type (pdf, docx, doc)
    - Computes file hash for deduplication
    - Parses document to extract text and metadata
    - Stores file and creates database record
    """
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Check file size
    if file_size > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_UPLOAD_SIZE_MB}MB"
        )

    # Generate unique filename
    unique_id = str(uuid4())
    safe_filename = f"{unique_id}{file_ext}"
    file_path = UPLOADS_DIR / safe_filename

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Compute hash
    file_hash = compute_file_hash(file_path)

    # Check for duplicate
    existing = db.query(Contract).filter(
        Contract.file_hash == file_hash,
        Contract.is_deleted == False
    ).first()

    if existing:
        # Remove uploaded file (duplicate)
        file_path.unlink()
        # Return duplicate info with 409 status but proper response body
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=409,
            content={
                "id": existing.id,
                "contract_id": existing.id,
                "existing_contract_id": existing.id,
                "filename": existing.original_filename,
                "file_type": existing.file_type,
                "file_size_bytes": existing.file_size_bytes,
                "page_count": existing.page_count,
                "text_preview": (existing.extracted_text or "")[:2000],
                "message": "Document already exists",
                "is_duplicate": True,
            }
        )

    # Parse document
    try:
        loaded_doc = document_loader.load(file_path)
        extracted_text = loaded_doc.text
        page_count = loaded_doc.page_count
        doc_metadata = loaded_doc.metadata
    except Exception as e:
        file_path.unlink()
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse document: {str(e)}"
        )

    # Create database record
    contract = Contract(
        id=unique_id,
        filename=safe_filename,
        original_filename=file.filename,
        file_path=str(file_path),
        file_type=file_ext.lstrip("."),
        file_size_bytes=file_size,
        file_hash=file_hash,
        page_count=page_count,
        extracted_text=extracted_text,
        document_metadata=doc_metadata,
    )

    db.add(contract)
    db.commit()
    db.refresh(contract)

    # Return response with preview
    text_preview = extracted_text[:2000] if extracted_text else ""

    return UploadResponse(
        id=contract.id,
        contract_id=contract.id,
        filename=file.filename,
        file_type=contract.file_type,
        file_size_bytes=file_size,
        page_count=page_count,
        text_preview=text_preview,
    )


@router.get("/", response_model=list[ContractListItem])
async def list_contracts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all contracts with pagination and search."""
    query = db.query(Contract).filter(Contract.is_deleted == False)

    if search:
        query = query.filter(
            Contract.original_filename.ilike(f"%{search}%")
        )

    contracts = query.order_by(Contract.uploaded_at.desc()).offset(skip).limit(limit).all()

    # Add extraction counts
    result = []
    for contract in contracts:
        extraction_count = db.query(func.count(Extraction.id)).filter(
            Extraction.contract_id == contract.id
        ).scalar()

        latest_extraction = db.query(Extraction).filter(
            Extraction.contract_id == contract.id
        ).order_by(Extraction.created_at.desc()).first()

        result.append(ContractListItem(
            id=contract.id,
            original_filename=contract.original_filename,
            file_type=contract.file_type,
            file_size_bytes=contract.file_size_bytes,
            page_count=contract.page_count,
            uploaded_at=contract.uploaded_at,
            extraction_count=extraction_count,
            latest_extraction_status=latest_extraction.status if latest_extraction else None,
        ))

    return result


@router.get("/{contract_id}", response_model=ContractDetail)
async def get_contract(
    contract_id: str,
    db: Session = Depends(get_db)
):
    """Get contract details."""
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.is_deleted == False
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    text_preview = contract.extracted_text[:1000] if contract.extracted_text else None

    return ContractDetail(
        id=contract.id,
        filename=contract.filename,
        original_filename=contract.original_filename,
        file_type=contract.file_type,
        file_size_bytes=contract.file_size_bytes,
        file_hash=contract.file_hash,
        page_count=contract.page_count,
        document_metadata=contract.document_metadata or {},
        uploaded_at=contract.uploaded_at,
        updated_at=contract.updated_at,
        text_preview=text_preview,
    )


@router.get("/{contract_id}/preview", response_model=DocumentPreview)
async def get_contract_preview(
    contract_id: str,
    db: Session = Depends(get_db)
):
    """Get parsed document preview with text content."""
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.is_deleted == False
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    text = contract.extracted_text or ""
    text_preview = text[:2000]

    return DocumentPreview(
        contract_id=contract.id,
        filename=contract.original_filename,
        file_type=contract.file_type,
        page_count=contract.page_count,
        total_characters=len(text),
        text_preview=text_preview,
        metadata=contract.document_metadata or {},
    )


@router.get("/{contract_id}/text")
async def get_contract_text(
    contract_id: str,
    db: Session = Depends(get_db)
):
    """Get full extracted text."""
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.is_deleted == False
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    return {"text": contract.extracted_text or ""}


@router.get("/{contract_id}/download")
async def download_contract(
    contract_id: str,
    db: Session = Depends(get_db)
):
    """Download original contract file."""
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.is_deleted == False
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    file_path = Path(contract.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=contract.original_filename,
        media_type="application/octet-stream"
    )


@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: str,
    db: Session = Depends(get_db)
):
    """Soft delete a contract."""
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.is_deleted == False
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    contract.is_deleted = True
    contract.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Contract deleted successfully", "contract_id": contract_id}
