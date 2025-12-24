"""Export management endpoints."""

import json
import csv
import io
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.api.deps import get_db
from backend.models.contract import Contract
from backend.models.extraction import Extraction
from backend.core.config import STORAGE_DIR

# Import Excel exporter from existing code
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from src.exporters.excel_exporter import ExcelExporter
from src.schema import ContractData

router = APIRouter()

# Ensure exports directory exists
EXPORTS_DIR = STORAGE_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


class ExportRequest(BaseModel):
    """Request to create an export."""
    extraction_ids: list[str]
    format: str = "xlsx"  # xlsx, csv, json


class ExportResponse(BaseModel):
    """Export creation response."""
    export_id: str
    format: str
    extraction_count: int
    download_url: str


@router.post("/", response_model=ExportResponse)
async def create_export(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """
    Create an export file from extraction results.

    Supports formats:
    - xlsx: Excel file with formatting
    - csv: Comma-separated values
    - json: JSON array of extraction data
    """
    if request.format not in ("xlsx", "csv", "json"):
        raise HTTPException(
            status_code=400,
            detail="Invalid format. Supported: xlsx, csv, json"
        )

    if not request.extraction_ids:
        raise HTTPException(
            status_code=400,
            detail="No extraction IDs provided"
        )

    # Fetch extractions
    extractions = db.query(Extraction).filter(
        Extraction.id.in_(request.extraction_ids),
        Extraction.status == "completed"
    ).all()

    if not extractions:
        raise HTTPException(
            status_code=404,
            detail="No completed extractions found"
        )

    # Generate export file
    export_id = str(uuid4())
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if request.format == "xlsx":
        filename = f"extraction_{timestamp}.xlsx"
        file_path = EXPORTS_DIR / filename

        # Convert to ContractData objects for Excel exporter
        contracts = []
        for extraction in extractions:
            # Get contract info
            contract = db.query(Contract).filter(
                Contract.id == extraction.contract_id
            ).first()

            # Add document source to extracted data
            data = extraction.extracted_data or {}
            if contract:
                data["document_source"] = contract.original_filename

            # Create ContractData from flat dict
            contract_data = ContractData.model_validate({
                "metadata": {
                    "member_name": data.get("member_name"),
                    "product_name": data.get("product_name"),
                    "product_description": data.get("product_description"),
                    "effective_date": data.get("effective_date"),
                    "document_source": data.get("document_source"),
                    "extraction_timestamp": extraction.completed_at.isoformat() if extraction.completed_at else None,
                },
                "territory": {
                    "permitted_states": data.get("permitted_states", "").split("; ") if data.get("permitted_states") else [],
                    "excluded_states": data.get("excluded_states", "").split("; ") if data.get("excluded_states") else [],
                    "admitted_status": data.get("admitted_status"),
                },
                "extraction_notes": extraction.extraction_notes or [],
            })
            contracts.append(contract_data)

        # Use existing Excel exporter
        exporter = ExcelExporter()
        exporter.export(contracts, file_path)

    elif request.format == "csv":
        filename = f"extraction_{timestamp}.csv"
        file_path = EXPORTS_DIR / filename

        # Get all field names from first extraction
        if extractions:
            fieldnames = list(extractions[0].extracted_data.keys()) if extractions[0].extracted_data else []

            with open(file_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for extraction in extractions:
                    writer.writerow(extraction.extracted_data or {})

    else:  # json
        filename = f"extraction_{timestamp}.json"
        file_path = EXPORTS_DIR / filename

        export_data = []
        for extraction in extractions:
            contract = db.query(Contract).filter(
                Contract.id == extraction.contract_id
            ).first()

            export_data.append({
                "extraction_id": extraction.id,
                "contract_id": extraction.contract_id,
                "contract_filename": contract.original_filename if contract else None,
                "model_provider": extraction.model_provider,
                "model_name": extraction.model_name,
                "extracted_at": extraction.completed_at.isoformat() if extraction.completed_at else None,
                "data": extraction.extracted_data or {},
            })

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2, default=str)

    return ExportResponse(
        export_id=export_id,
        format=request.format,
        extraction_count=len(extractions),
        download_url=f"/api/exports/{filename}/download",
    )


@router.get("/{filename}/download")
async def download_export(
    filename: str,
):
    """Download generated export file."""
    file_path = EXPORTS_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")

    # Determine media type
    if filename.endswith(".xlsx"):
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif filename.endswith(".csv"):
        media_type = "text/csv"
    else:
        media_type = "application/json"

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
    )


@router.get("/{extraction_id}/quick-export")
async def quick_export_extraction(
    extraction_id: str,
    format: str = Query("json", description="Export format: json, csv"),
    db: Session = Depends(get_db)
):
    """Quick export a single extraction without creating a file."""
    extraction = db.query(Extraction).filter(
        Extraction.id == extraction_id,
        Extraction.status == "completed"
    ).first()

    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    contract = db.query(Contract).filter(
        Contract.id == extraction.contract_id
    ).first()

    if format == "json":
        return {
            "extraction_id": extraction.id,
            "contract_filename": contract.original_filename if contract else None,
            "model": f"{extraction.model_provider}/{extraction.model_name}",
            "extracted_at": extraction.completed_at,
            "data": extraction.extracted_data or {},
        }

    elif format == "csv":
        output = io.StringIO()
        data = extraction.extracted_data or {}
        fieldnames = list(data.keys())

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(data)

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=extraction_{extraction_id[:8]}.csv"}
        )

    else:
        raise HTTPException(status_code=400, detail="Invalid format")
