"""Members API routes."""

from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.api.deps import get_db
from backend.models.member import (
    Member,
    GWPBreakdown,
    MemberContract,
    ContractTermMapping,
)
from backend.models.contract import Contract
from backend.schemas.member import (
    MemberListResponse,
    MemberListItem,
    MemberDetail,
    MemberContractCreate,
    MemberContractResponse,
    MemberContractListResponse,
    GWPTreeResponse,
    ImportResponse,
    TermMappingCreate,
    TermMappingResponse,
)
from backend.services.member_import import import_from_excel, get_member_gwp_tree

router = APIRouter()


# =============================================================================
# MEMBER ENDPOINTS
# =============================================================================

@router.get("/", response_model=MemberListResponse)
def list_members(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all members with pagination and search."""
    query = db.query(Member)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Member.name.ilike(search_term)) |
            (Member.member_id.ilike(search_term))
        )

    # Get total count
    total = query.count()

    # Get paginated results
    members = query.order_by(Member.name).offset(skip).limit(limit).all()

    # Build response with computed stats
    member_items = []
    for m in members:
        # Calculate total GWP
        gwp_sum = db.query(func.sum(GWPBreakdown.total_gwp)).filter(
            GWPBreakdown.member_id == m.id
        ).scalar() or Decimal("0")

        # Count GWP rows
        gwp_count = db.query(GWPBreakdown).filter(
            GWPBreakdown.member_id == m.id
        ).count()

        # Count contracts
        contract_count = db.query(MemberContract).filter(
            MemberContract.member_id == m.id
        ).count()

        member_items.append(MemberListItem(
            id=m.id,
            member_id=m.member_id,
            name=m.name,
            total_gwp=gwp_sum,
            gwp_row_count=gwp_count,
            contract_count=contract_count,
        ))

    return MemberListResponse(
        members=member_items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/by-contract/{contract_id}")
def get_members_for_contract(
    contract_id: str,
    db: Session = Depends(get_db),
):
    """Get all members linked to a contract."""
    member_contracts = db.query(MemberContract).filter(
        MemberContract.contract_id == contract_id
    ).all()

    members = []
    for mc in member_contracts:
        member = db.query(Member).filter(Member.id == mc.member_id).first()
        if member:
            members.append({
                "id": str(member.id),
                "member_id": member.member_id,
                "name": member.name,
                "link_id": str(mc.id),
                "version_number": mc.version_number,
                "is_current": mc.is_current,
            })

    return {"members": members, "total": len(members)}


@router.get("/{member_id}", response_model=MemberDetail)
def get_member(
    member_id: str,
    db: Session = Depends(get_db),
):
    """Get member details by UUID or member_id code."""
    # Try UUID first, then member_id code
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        member = db.query(Member).filter(Member.member_id == member_id).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Calculate stats
    gwp_sum = db.query(func.sum(GWPBreakdown.total_gwp)).filter(
        GWPBreakdown.member_id == member.id
    ).scalar() or Decimal("0")

    gwp_count = db.query(GWPBreakdown).filter(
        GWPBreakdown.member_id == member.id
    ).count()

    # Get GWP breakdowns with joined dimensions
    breakdowns = db.query(GWPBreakdown).filter(
        GWPBreakdown.member_id == member.id
    ).all()

    return MemberDetail(
        id=member.id,
        member_id=member.member_id,
        name=member.name,
        created_at=member.created_at,
        updated_at=member.updated_at,
        total_gwp=gwp_sum,
        gwp_row_count=gwp_count,
        gwp_breakdowns=breakdowns,
    )


@router.get("/{member_id}/gwp-tree")
def get_member_gwp_tree_endpoint(
    member_id: str,
    db: Session = Depends(get_db),
):
    """Get hierarchical GWP tree for a member."""
    # Try UUID first, then member_id code
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        member = db.query(Member).filter(Member.member_id == member_id).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    tree = get_member_gwp_tree(db, member.id)
    return tree


# =============================================================================
# MEMBER CONTRACT ENDPOINTS
# =============================================================================

@router.get("/{member_id}/contracts", response_model=MemberContractListResponse)
def list_member_contracts(
    member_id: str,
    db: Session = Depends(get_db),
):
    """List all contracts linked to a member."""
    # Find member
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        member = db.query(Member).filter(Member.member_id == member_id).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Get contracts with joined contract info
    member_contracts = db.query(MemberContract).filter(
        MemberContract.member_id == member.id
    ).order_by(MemberContract.created_at.desc()).all()

    contracts = []
    for mc in member_contracts:
        contract = db.query(Contract).filter(Contract.id == mc.contract_id).first()
        contracts.append(MemberContractResponse(
            id=mc.id,
            member_id=mc.member_id,
            contract_id=mc.contract_id,
            version_number=mc.version_number,
            is_current=mc.is_current,
            effective_date=mc.effective_date,
            created_at=mc.created_at,
            contract_filename=contract.original_filename if contract else None,
            contract_file_type=contract.file_type if contract else None,
        ))

    return MemberContractListResponse(
        contracts=contracts,
        total=len(contracts),
    )


@router.post("/{member_id}/contracts", response_model=MemberContractResponse)
def link_contract_to_member(
    member_id: str,
    data: MemberContractCreate,
    db: Session = Depends(get_db),
):
    """Link a contract to a member."""
    # Find member
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        member = db.query(Member).filter(Member.member_id == member_id).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Verify contract exists
    contract = db.query(Contract).filter(Contract.id == data.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Check if this member-contract link already exists
    existing = db.query(MemberContract).filter(
        MemberContract.member_id == member.id,
        MemberContract.contract_id == data.contract_id,
    ).first()

    if existing:
        # Return the existing link instead of creating a duplicate
        return MemberContractResponse(
            id=existing.id,
            member_id=existing.member_id,
            contract_id=existing.contract_id,
            version_number=existing.version_number,
            is_current=existing.is_current,
            effective_date=existing.effective_date,
            created_at=existing.created_at,
            contract_filename=contract.original_filename,
            contract_file_type=contract.file_type,
        )

    # Create new member-contract link
    member_contract = MemberContract(
        member_id=member.id,
        contract_id=data.contract_id,
        version_number=data.version_number or "v1",
        effective_date=data.effective_date,
        is_current=True,
    )
    db.add(member_contract)
    db.commit()
    db.refresh(member_contract)

    return MemberContractResponse(
        id=member_contract.id,
        member_id=member_contract.member_id,
        contract_id=member_contract.contract_id,
        version_number=member_contract.version_number,
        is_current=member_contract.is_current,
        effective_date=member_contract.effective_date,
        created_at=member_contract.created_at,
        contract_filename=contract.original_filename,
        contract_file_type=contract.file_type,
    )


@router.delete("/{member_id}/contracts/{contract_id}")
def unlink_contract_from_member(
    member_id: str,
    contract_id: str,
    db: Session = Depends(get_db),
):
    """Unlink a contract from a member."""
    # Find member
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        member = db.query(Member).filter(Member.member_id == member_id).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Find and delete the member-contract link
    member_contract = db.query(MemberContract).filter(
        MemberContract.member_id == member.id,
        MemberContract.contract_id == contract_id,
    ).first()

    if not member_contract:
        raise HTTPException(status_code=404, detail="Contract link not found")

    db.delete(member_contract)
    db.commit()

    return {"message": "Contract unlinked successfully"}


@router.post("/{member_id}/contracts/{contract_id}/new-version", response_model=MemberContractResponse)
def create_new_contract_version(
    member_id: str,
    contract_id: str,
    new_contract_id: str = Query(..., description="ID of the new contract document"),
    effective_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Create a new version of a member's contract."""
    # Find member
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        member = db.query(Member).filter(Member.member_id == member_id).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Verify new contract exists
    new_contract = db.query(Contract).filter(Contract.id == new_contract_id).first()
    if not new_contract:
        raise HTTPException(status_code=404, detail="New contract not found")

    # Get current version number
    current = db.query(MemberContract).filter(
        MemberContract.member_id == member.id,
        MemberContract.contract_id == contract_id,
        MemberContract.is_current == True,
    ).first()

    if current:
        # Parse version number and increment
        current_num = int(current.version_number.replace("v", ""))
        new_version = f"v{current_num + 1}"
        current.is_current = False
    else:
        new_version = "v1"

    # Create new version
    from datetime import date
    eff_date = None
    if effective_date:
        eff_date = date.fromisoformat(effective_date)

    member_contract = MemberContract(
        member_id=member.id,
        contract_id=new_contract_id,
        version_number=new_version,
        effective_date=eff_date,
        is_current=True,
    )
    db.add(member_contract)
    db.commit()
    db.refresh(member_contract)

    return MemberContractResponse(
        id=member_contract.id,
        member_id=member_contract.member_id,
        contract_id=member_contract.contract_id,
        version_number=member_contract.version_number,
        is_current=member_contract.is_current,
        effective_date=member_contract.effective_date,
        created_at=member_contract.created_at,
        contract_filename=new_contract.original_filename,
        contract_file_type=new_contract.file_type,
    )


# =============================================================================
# IMPORT ENDPOINT
# =============================================================================

@router.post("/import", response_model=ImportResponse)
def import_members(
    file_path: str = Query(..., description="Path to Excel file"),
    db: Session = Depends(get_db),
):
    """Import members and GWP data from Excel file."""
    try:
        result = import_from_excel(db, file_path)
        return ImportResponse(**result)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Excel file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


# =============================================================================
# TERM MAPPING ENDPOINTS
# =============================================================================

@router.post("/term-mappings", response_model=TermMappingResponse)
def create_term_mapping(
    data: TermMappingCreate,
    db: Session = Depends(get_db),
):
    """Create a term mapping between an extraction field and GWP row."""
    # Verify GWP breakdown exists
    gwp = db.query(GWPBreakdown).filter(GWPBreakdown.id == data.gwp_breakdown_id).first()
    if not gwp:
        raise HTTPException(status_code=404, detail="GWP breakdown not found")

    mapping = ContractTermMapping(
        extraction_id=data.extraction_id,
        gwp_breakdown_id=data.gwp_breakdown_id,
        field_path=data.field_path,
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)

    return mapping


@router.get("/term-mappings/extraction/{extraction_id}")
def get_term_mappings_for_extraction(
    extraction_id: str,
    db: Session = Depends(get_db),
):
    """Get all term mappings for an extraction."""
    mappings = db.query(ContractTermMapping).filter(
        ContractTermMapping.extraction_id == extraction_id
    ).all()

    return {"mappings": mappings, "total": len(mappings)}


@router.get("/term-mappings/gwp/{gwp_id}")
def get_term_mappings_for_gwp(
    gwp_id: str,
    db: Session = Depends(get_db),
):
    """Get all term mappings for a GWP breakdown row."""
    mappings = db.query(ContractTermMapping).filter(
        ContractTermMapping.gwp_breakdown_id == gwp_id
    ).all()

    return {"mappings": mappings, "total": len(mappings)}
