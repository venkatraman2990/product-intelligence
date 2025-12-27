"""Authorities management endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.models.member import Authority, Member, ProductExtraction, ContractProductLink, GWPBreakdown
from backend.models.contract import Contract
from backend.schemas.member import (
    AuthorityResponse,
    AuthorityUpdate,
    AuthorityListItem,
    AuthorityListResponse,
)

router = APIRouter()


@router.post("/backfill")
def backfill_authorities(db: Session = Depends(get_db)):
    """
    One-time backfill: Create Authority records for all completed ProductExtractions
    that don't have one yet.
    """
    # Find all completed ProductExtractions without an Authority
    completed_extractions = db.query(ProductExtraction).filter(
        ProductExtraction.status == "completed"
    ).all()

    created_count = 0
    skipped_count = 0
    errors = []

    for extraction in completed_extractions:
        # Check if Authority already exists
        existing = db.query(Authority).filter(
            Authority.product_extraction_id == extraction.id
        ).first()

        if existing:
            skipped_count += 1
            continue

        try:
            # Get the contract-product link
            link = db.query(ContractProductLink).filter(
                ContractProductLink.id == extraction.contract_link_id
            ).first()

            if not link:
                errors.append(f"Link not found for extraction {extraction.id}")
                continue

            # Get the GWP breakdown with product info
            gwp = db.query(GWPBreakdown).filter(
                GWPBreakdown.id == link.gwp_breakdown_id
            ).first()

            if not gwp:
                errors.append(f"GWP breakdown not found for link {link.id}")
                continue

            # Get contract info
            from backend.models.extraction import Extraction
            parent_extraction = db.query(Extraction).filter(
                Extraction.id == link.extraction_id
            ).first()

            contract = None
            if parent_extraction:
                contract = db.query(Contract).filter(
                    Contract.id == parent_extraction.contract_id
                ).first()

            # Create Authority
            authority = Authority(
                product_extraction_id=extraction.id,
                contract_link_id=link.id,
                member_id=gwp.member_id,
                gwp_breakdown_id=gwp.id,
                lob_name=gwp.line_of_business.name,
                cob_name=gwp.class_of_business.name,
                product_name=gwp.product.name,
                sub_product_name=gwp.sub_product.name,
                mpp_name=gwp.member_product_program.name,
                contract_id=contract.id if contract else None,
                contract_name=contract.filename if contract else "Unknown",
                extracted_data=extraction.extracted_data or {},
                analysis_summary=extraction.analysis_summary,
            )
            db.add(authority)
            created_count += 1

        except Exception as e:
            errors.append(f"Error processing extraction {extraction.id}: {str(e)}")

    db.commit()

    return {
        "message": "Backfill complete",
        "created": created_count,
        "skipped": skipped_count,
        "errors": errors,
    }


@router.get("/", response_model=AuthorityListResponse)
def list_authorities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    member_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all authorities with pagination and search."""
    query = db.query(Authority)

    # Filter by member
    if member_id:
        query = query.filter(Authority.member_id == member_id)

    # Search across multiple fields
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Authority.contract_name.ilike(search_term)) |
            (Authority.lob_name.ilike(search_term)) |
            (Authority.cob_name.ilike(search_term)) |
            (Authority.product_name.ilike(search_term)) |
            (Authority.sub_product_name.ilike(search_term)) |
            (Authority.mpp_name.ilike(search_term))
        )

    total = query.count()
    authorities = query.order_by(Authority.created_at.desc()).offset(skip).limit(limit).all()

    # Build list items with field count
    items = []
    for auth in authorities:
        field_count = len(auth.extracted_data) if auth.extracted_data else 0
        items.append(AuthorityListItem(
            id=auth.id,
            member_id=auth.member_id,
            contract_id=auth.contract_id,
            contract_name=auth.contract_name,
            lob_name=auth.lob_name,
            cob_name=auth.cob_name,
            product_name=auth.product_name,
            sub_product_name=auth.sub_product_name,
            mpp_name=auth.mpp_name,
            field_count=field_count,
            created_at=auth.created_at,
            updated_at=auth.updated_at,
        ))

    return AuthorityListResponse(
        authorities=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{authority_id}", response_model=AuthorityResponse)
def get_authority(authority_id: str, db: Session = Depends(get_db)):
    """Get a single authority by ID."""
    authority = db.query(Authority).filter(Authority.id == authority_id).first()

    if not authority:
        raise HTTPException(status_code=404, detail="Authority not found")

    return authority


@router.patch("/{authority_id}", response_model=AuthorityResponse)
def update_authority(
    authority_id: str,
    data: AuthorityUpdate,
    db: Session = Depends(get_db),
):
    """Update authority extracted data fields."""
    authority = db.query(Authority).filter(Authority.id == authority_id).first()

    if not authority:
        raise HTTPException(status_code=404, detail="Authority not found")

    # Update fields if provided
    if data.extracted_data is not None:
        authority.extracted_data = data.extracted_data

    if data.analysis_summary is not None:
        authority.analysis_summary = data.analysis_summary

    db.commit()
    db.refresh(authority)

    return authority


@router.delete("/{authority_id}")
def delete_authority(authority_id: str, db: Session = Depends(get_db)):
    """Delete an authority record."""
    authority = db.query(Authority).filter(Authority.id == authority_id).first()

    if not authority:
        raise HTTPException(status_code=404, detail="Authority not found")

    db.delete(authority)
    db.commit()

    return {"message": "Authority deleted successfully"}
