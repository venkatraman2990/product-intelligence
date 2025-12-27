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
    MemberProductProgram,
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
# STATS ENDPOINT
# =============================================================================

@router.get("/stats")
def get_member_stats(db: Session = Depends(get_db)):
    """Get member and product statistics."""
    member_count = db.query(Member).count()
    mpp_count = db.query(MemberProductProgram).count()
    return {
        "member_count": member_count,
        "product_count": mpp_count,
    }


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


# =============================================================================
# AI MAPPING SUGGESTIONS ENDPOINT
# =============================================================================

from pydantic import BaseModel
from typing import List
import json

class SuggestMappingsRequest(BaseModel):
    extraction_id: str
    member_id: str
    model_provider: str = "anthropic"  # anthropic, openai, or landingai
    extracted_fields: List[dict]  # [{path: str, value: str}]
    product_combinations: List[dict]  # [{id, cob, lob, product, sub_product, mpp, total_gwp}]

class MappingSuggestion(BaseModel):
    field_path: str
    gwp_breakdown_id: str
    confidence: float  # 0-1
    reason: str

@router.post("/term-mappings/suggest")
def suggest_term_mappings(
    request: SuggestMappingsRequest,
    db: Session = Depends(get_db),
):
    """Use AI to suggest mappings between extraction fields and product combinations."""

    # Build prompt for AI
    fields_text = "\n".join([
        f"- {f['path']}: {f['value'][:100]}..." if len(str(f.get('value', ''))) > 100 else f"- {f['path']}: {f['value']}"
        for f in request.extracted_fields
    ])

    products_text = "\n".join([
        f"- ID: {p['id']} | {p.get('lob', {}).get('name', 'N/A')} > {p.get('cob', {}).get('name', 'N/A')} > {p.get('product', {}).get('name', 'N/A')} > {p.get('sub_product', {}).get('name', 'N/A')} > {p.get('mpp', {}).get('name', 'N/A')} (GWP: ${p.get('total_gwp', 0)})"
        for p in request.product_combinations[:50]  # Limit to 50 products
    ])

    system_prompt = """You are an expert insurance underwriter assistant. Your task is to suggest mappings between extracted contract fields and product combinations.

Analyze the extracted fields and match them to the most relevant product combinations based on:
1. Line of Business (LOB) and Class of Business (COB) alignment
2. Product type matching (e.g., liability fields to liability products)
3. Coverage type matching
4. Insurance domain knowledge

Return a JSON array of suggested mappings. For each mapping include:
- field_path: The exact field path from the extracted fields
- gwp_breakdown_id: The ID of the product combination to map to
- confidence: A score from 0 to 1 (0.8+ for strong matches, 0.5-0.8 for moderate, below 0.5 for weak)
- reason: Brief explanation of why this mapping makes sense

Only suggest mappings where there's a clear logical connection. Don't force mappings for unrelated fields."""

    user_prompt = f"""Please analyze these extracted contract fields and suggest mappings to product combinations.

## Extracted Fields:
{fields_text}

## Available Product Combinations:
{products_text}

Return a JSON array of mapping suggestions. Example format:
[
  {{"field_path": "limits.per_occurrence", "gwp_breakdown_id": "abc123", "confidence": 0.85, "reason": "Per occurrence limit aligns with General Liability coverage"}},
  {{"field_path": "deductible.amount", "gwp_breakdown_id": "def456", "confidence": 0.7, "reason": "Deductible structure matches Property product terms"}}
]

Return ONLY the JSON array, no other text."""

    try:
        if request.model_provider == "anthropic":
            import anthropic
            from config.settings import ANTHROPIC_API_KEY

            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            response_text = response.content[0].text

        elif request.model_provider == "openai":
            import openai
            from config.settings import OPENAI_API_KEY

            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o",
                max_tokens=4096,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt + "\n\nWrap your response in a JSON object with a 'suggestions' array."},
                ],
            )
            response_text = response.choices[0].message.content

        else:
            # Default fallback for landingai or unsupported providers
            return {"suggestions": [], "error": f"Provider {request.model_provider} not yet supported for mapping suggestions"}

        # Parse JSON response
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        parsed = json.loads(response_text)

        # Handle both array and object with suggestions key
        if isinstance(parsed, list):
            suggestions = parsed
        elif isinstance(parsed, dict) and "suggestions" in parsed:
            suggestions = parsed["suggestions"]
        else:
            suggestions = []

        return {"suggestions": suggestions}

    except Exception as e:
        return {"suggestions": [], "error": str(e)}
