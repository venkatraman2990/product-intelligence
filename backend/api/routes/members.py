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
    ContractProductLink,
    ProductExtraction,
    Authority,
    LineOfBusiness,
    ClassOfBusiness,
    Product,
    SubProduct,
)
from backend.models.contract import Contract
from backend.models.extraction import Extraction
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
    # New contract-product linking schemas
    ProductInfo,
    ContractProductLinkCreate,
    ContractProductLinkResponse,
    ContractProductLinksResponse,
    ProductSuggestion,
    SuggestProductsRequest,
    SuggestProductsResponse,
    ProductExtractionRequest,
    ProductExtractionResponse,
    BatchAnalyzeRequest,
    BatchAnalyzeResponse,
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


# =============================================================================
# CONTRACT-PRODUCT LINKING ENDPOINTS (NEW)
# =============================================================================

def _build_product_info(gwp: GWPBreakdown) -> ProductInfo:
    """Helper to build ProductInfo from GWPBreakdown with related dimensions."""
    return ProductInfo(
        id=gwp.id,
        lob={"code": gwp.line_of_business.lob_id, "name": gwp.line_of_business.name},
        cob={"code": gwp.class_of_business.cob_id, "name": gwp.class_of_business.name},
        product={"code": gwp.product.product_id, "name": gwp.product.name},
        sub_product={"code": gwp.sub_product.sub_product_id, "name": gwp.sub_product.name},
        mpp={"code": gwp.member_product_program.mpp_id, "name": gwp.member_product_program.name},
        total_gwp=str(gwp.total_gwp),
        loss_ratio=str(gwp.loss_ratio) if gwp.loss_ratio else None,
    )


@router.post("/contract-links", response_model=ContractProductLinksResponse)
def create_contract_product_links(
    data: ContractProductLinkCreate,
    db: Session = Depends(get_db),
):
    """Link a contract (via extraction) to one or more product combinations."""
    # Verify extraction exists
    extraction = db.query(Extraction).filter(Extraction.id == data.extraction_id).first()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    created_links = []
    for gwp_id in data.gwp_breakdown_ids:
        # Verify GWP breakdown exists
        gwp = db.query(GWPBreakdown).filter(GWPBreakdown.id == gwp_id).first()
        if not gwp:
            continue  # Skip invalid IDs

        # Check if link already exists
        existing = db.query(ContractProductLink).filter(
            ContractProductLink.extraction_id == data.extraction_id,
            ContractProductLink.gwp_breakdown_id == gwp_id,
        ).first()

        if existing:
            # Include existing link in response
            created_links.append(ContractProductLinkResponse(
                id=existing.id,
                extraction_id=existing.extraction_id,
                gwp_breakdown_id=existing.gwp_breakdown_id,
                link_reason=existing.link_reason,
                created_at=existing.created_at,
                updated_at=existing.updated_at,
                product_info=_build_product_info(gwp),
                has_extraction=len(existing.product_extractions) > 0,
                extraction_status=existing.product_extractions[0].status if existing.product_extractions else None,
            ))
            continue

        # Create new link
        link = ContractProductLink(
            extraction_id=data.extraction_id,
            gwp_breakdown_id=gwp_id,
            link_reason=data.link_reason,
        )
        db.add(link)
        db.flush()  # Get the ID

        created_links.append(ContractProductLinkResponse(
            id=link.id,
            extraction_id=link.extraction_id,
            gwp_breakdown_id=link.gwp_breakdown_id,
            link_reason=link.link_reason,
            created_at=link.created_at,
            updated_at=link.updated_at,
            product_info=_build_product_info(gwp),
            has_extraction=False,
            extraction_status=None,
        ))

    db.commit()

    return ContractProductLinksResponse(
        links=created_links,
        total=len(created_links),
    )


@router.get("/contract-links/extraction/{extraction_id}", response_model=ContractProductLinksResponse)
def get_contract_product_links(
    extraction_id: str,
    db: Session = Depends(get_db),
):
    """Get all product combinations linked to a contract extraction."""
    links = db.query(ContractProductLink).filter(
        ContractProductLink.extraction_id == extraction_id
    ).all()

    response_links = []
    for link in links:
        gwp = db.query(GWPBreakdown).filter(GWPBreakdown.id == link.gwp_breakdown_id).first()
        if gwp:
            response_links.append(ContractProductLinkResponse(
                id=link.id,
                extraction_id=link.extraction_id,
                gwp_breakdown_id=link.gwp_breakdown_id,
                link_reason=link.link_reason,
                created_at=link.created_at,
                updated_at=link.updated_at,
                product_info=_build_product_info(gwp),
                has_extraction=len(link.product_extractions) > 0,
                extraction_status=link.product_extractions[0].status if link.product_extractions else None,
            ))

    return ContractProductLinksResponse(
        links=response_links,
        total=len(response_links),
    )


@router.delete("/contract-links/{link_id}")
def delete_contract_product_link(
    link_id: str,
    db: Session = Depends(get_db),
):
    """Remove a contract-product link."""
    link = db.query(ContractProductLink).filter(ContractProductLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Contract-product link not found")

    db.delete(link)
    db.commit()

    return {"message": "Contract-product link removed successfully"}


@router.post("/contract-links/suggest", response_model=SuggestProductsResponse)
def suggest_products_for_contract(
    request: SuggestProductsRequest,
    db: Session = Depends(get_db),
):
    """Use AI to suggest which product combinations a contract should be linked to."""
    # Get the extraction with its data
    extraction = db.query(Extraction).filter(Extraction.id == request.extraction_id).first()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    # Get member's products
    member = db.query(Member).filter(Member.id == request.member_id).first()
    if not member:
        member = db.query(Member).filter(Member.member_id == request.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Get all GWP breakdowns for this member
    gwp_rows = db.query(GWPBreakdown).filter(GWPBreakdown.member_id == member.id).all()

    # Format extracted data for AI
    extracted_data = extraction.extracted_data or {}
    extracted_text = json.dumps(extracted_data, indent=2, default=str)[:3000]  # Limit size

    # Format product combinations for AI
    products_text = "\n".join([
        f"- ID: {gwp.id} | {gwp.line_of_business.name} > {gwp.class_of_business.name} > {gwp.product.name} > {gwp.sub_product.name} > {gwp.member_product_program.name} (GWP: ${gwp.total_gwp})"
        for gwp in gwp_rows[:50]  # Limit to 50 products
    ])

    system_prompt = """You are an expert insurance underwriter assistant. Your task is to determine which product combinations a contract applies to.

A contract may apply to one or more product combinations (LOB > COB > Product > Sub-Product > MPP).

Analyze the contract's extracted data and determine which products it covers based on:
1. Line of Business and Class of Business alignment with contract type
2. Coverage descriptions matching product names
3. Policy limits and terms that indicate specific product applicability
4. Territory and jurisdiction matching
5. Any explicit product references in the contract

Return a JSON array of suggested products. For each suggestion include:
- gwp_breakdown_id: The ID of the product combination
- confidence: A score from 0 to 1 (0.8+ strong match, 0.5-0.8 moderate, below 0.5 weak)
- reason: Brief explanation of why this contract applies to this product

Only suggest products where there's clear evidence the contract applies to them."""

    user_prompt = f"""Analyze this contract and suggest which product combinations it should be linked to.

## Extracted Contract Data:
{extracted_text}

## Available Product Combinations for this Member:
{products_text}

Return a JSON array of product suggestions. Example format:
[
  {{"gwp_breakdown_id": "abc123", "confidence": 0.9, "reason": "Contract covers General Liability which matches this LOB"}},
  {{"gwp_breakdown_id": "def456", "confidence": 0.75, "reason": "Property coverage terms align with this product"}}
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
            return SuggestProductsResponse(
                extraction_id=request.extraction_id,
                suggestions=[],
            )

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
            raw_suggestions = parsed
        elif isinstance(parsed, dict) and "suggestions" in parsed:
            raw_suggestions = parsed["suggestions"]
        else:
            raw_suggestions = []

        # Build ProductSuggestion objects with full product info
        suggestions = []
        for s in raw_suggestions:
            gwp_id = s.get("gwp_breakdown_id")
            gwp = db.query(GWPBreakdown).filter(GWPBreakdown.id == gwp_id).first()
            if gwp:
                suggestions.append(ProductSuggestion(
                    gwp_breakdown_id=gwp_id,
                    product_info=_build_product_info(gwp),
                    confidence=float(s.get("confidence", 0.5)),
                    reason=s.get("reason", ""),
                ))

        return SuggestProductsResponse(
            extraction_id=request.extraction_id,
            suggestions=suggestions,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {str(e)}")


# =============================================================================
# PRODUCT EXTRACTION (AI ANALYSIS) ENDPOINTS
# =============================================================================

@router.post("/product-extractions/analyze", response_model=ProductExtractionResponse)
def analyze_product_extraction(
    request: ProductExtractionRequest,
    db: Session = Depends(get_db),
):
    """Trigger AI analysis for a contract-product link to extract product-specific fields."""
    # Get the contract-product link
    link = db.query(ContractProductLink).filter(ContractProductLink.id == request.contract_link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Contract-product link not found")

    # Get the extraction data
    extraction = db.query(Extraction).filter(Extraction.id == link.extraction_id).first()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    # Get the product info
    gwp = db.query(GWPBreakdown).filter(GWPBreakdown.id == link.gwp_breakdown_id).first()
    if not gwp:
        raise HTTPException(status_code=404, detail="Product combination not found")

    # Get the contract for original text
    contract = db.query(Contract).filter(Contract.id == extraction.contract_id).first()

    # Check if analysis already exists
    existing = db.query(ProductExtraction).filter(
        ProductExtraction.contract_link_id == link.id
    ).first()

    # Handle force re-analysis: delete existing extraction and authority
    if request.force and existing:
        # Delete existing authority first (foreign key constraint)
        existing_authority = db.query(Authority).filter(
            Authority.product_extraction_id == existing.id
        ).first()
        if existing_authority:
            db.delete(existing_authority)

        # Delete existing extraction
        db.delete(existing)
        db.commit()
        existing = None  # Reset so we create fresh

    if existing and existing.status == "completed":
        # Auto-create Authority if missing (for extractions completed before this feature)
        existing_authority = db.query(Authority).filter(
            Authority.product_extraction_id == existing.id
        ).first()

        if not existing_authority:
            member = gwp.member
            authority = Authority(
                product_extraction_id=existing.id,
                contract_link_id=link.id,
                member_id=member.id,
                gwp_breakdown_id=gwp.id,
                lob_name=gwp.line_of_business.name,
                cob_name=gwp.class_of_business.name,
                product_name=gwp.product.name,
                sub_product_name=gwp.sub_product.name,
                mpp_name=gwp.member_product_program.name,
                contract_id=contract.id if contract else None,
                contract_name=contract.filename if contract else "Unknown",
                extracted_data=existing.extracted_data or {},
                analysis_summary=existing.analysis_summary,
            )
            db.add(authority)
            db.commit()

        # Return existing completed analysis
        return ProductExtractionResponse(
            id=existing.id,
            contract_link_id=existing.contract_link_id,
            model_provider=existing.model_provider,
            model_name=existing.model_name,
            extracted_data=existing.extracted_data or {},
            analysis_summary=existing.analysis_summary,
            confidence_score=existing.confidence_score,
            status=existing.status,
            error_message=existing.error_message,
            created_at=existing.created_at,
            completed_at=existing.completed_at,
        )

    # Create or update extraction record
    if existing:
        product_extraction = existing
        product_extraction.status = "processing"
        product_extraction.model_provider = request.model_provider
    else:
        product_extraction = ProductExtraction(
            contract_link_id=link.id,
            model_provider=request.model_provider,
            status="processing",
        )
        db.add(product_extraction)
    db.flush()

    # Build product context
    product_context = f"""Product Combination:
- Line of Business: {gwp.line_of_business.name} ({gwp.line_of_business.lob_id})
- Class of Business: {gwp.class_of_business.name} ({gwp.class_of_business.cob_id})
- Product: {gwp.product.name} ({gwp.product.product_id})
- Sub-Product: {gwp.sub_product.name} ({gwp.sub_product.sub_product_id})
- Member Product Program: {gwp.member_product_program.name} ({gwp.member_product_program.mpp_id})
- Total GWP: ${gwp.total_gwp}"""

    # Format extracted data
    extracted_data = extraction.extracted_data or {}
    extracted_text = json.dumps(extracted_data, indent=2, default=str)

    # Get contract text if available
    contract_text = ""
    if contract and contract.extracted_text:
        contract_text = contract.extracted_text[:5000]  # Limit size

    # Count fields for explicit instruction
    field_count = len(extracted_data)
    field_names = list(extracted_data.keys())

    system_prompt = f"""You are an expert insurance contract analyst. Your task is to enrich extracted contract data with citations and relevance scores for a specific product combination.

CRITICAL REQUIREMENT: The input contains exactly {field_count} fields. Your response MUST contain exactly {field_count} fields in extracted_data. Do NOT omit ANY fields.

The fields you MUST include are: {', '.join(field_names)}

For EACH of the {field_count} fields:
1. Copy the original value EXACTLY as provided
2. Add a citation (exact text snippet from the contract) - use "No direct citation found" if none exists
3. Add relevance_score (0-1) for this specific product combination
4. Add brief reasoning

Return a JSON object with:
- extracted_data: Object with ALL {field_count} fields, each having {{value, citation, relevance_score, reasoning}}
- analysis_summary: Brief explanation
- confidence_score: Overall confidence (0-1)

WARNING: Responses with fewer than {field_count} fields will be rejected. Include ALL fields regardless of relevance."""

    user_prompt = f"""{product_context}

## Extracted Contract Data ({field_count} fields - YOU MUST INCLUDE ALL {field_count}):
{extracted_text}

## Original Contract Text (for citations):
{contract_text if contract_text else "Not available"}

TASK: Enrich ALL {field_count} fields with citations and relevance scores.

Required output format:
{{
  "extracted_data": {{
    "field_name": {{
      "value": "COPY THE EXACT VALUE FROM INPUT",
      "citation": "exact quote from contract or 'No direct citation found'",
      "relevance_score": 0.0 to 1.0,
      "reasoning": "brief explanation"
    }}
    // REPEAT FOR ALL {field_count} FIELDS
  }},
  "analysis_summary": "brief summary",
  "confidence_score": 0.85
}}

MANDATORY: Your extracted_data object MUST have exactly {field_count} keys: {', '.join(field_names[:10])}{'...' if len(field_names) > 10 else ''}

Return ONLY the JSON object."""

    try:
        from datetime import datetime

        if request.model_provider == "anthropic":
            import anthropic
            from config.settings import ANTHROPIC_API_KEY

            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=16384,  # Increased for large field sets
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            response_text = response.content[0].text
            product_extraction.model_name = "claude-sonnet-4-20250514"

        elif request.model_provider == "openai":
            import openai
            from config.settings import OPENAI_API_KEY

            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o",
                max_tokens=16384,  # Increased for large field sets
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            response_text = response.choices[0].message.content
            product_extraction.model_name = "gpt-4o"

        else:
            product_extraction.status = "failed"
            product_extraction.error_message = f"Unsupported provider: {request.model_provider}"
            db.commit()
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {request.model_provider}")

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

        # Update extraction record
        product_extraction.extracted_data = parsed.get("extracted_data", {})
        product_extraction.analysis_summary = parsed.get("analysis_summary", "")
        product_extraction.confidence_score = float(parsed.get("confidence_score", 0.5))
        product_extraction.status = "completed"
        product_extraction.completed_at = datetime.utcnow()

        db.commit()
        db.refresh(product_extraction)

        # Auto-create Authority record
        existing_authority = db.query(Authority).filter(
            Authority.product_extraction_id == product_extraction.id
        ).first()

        if not existing_authority:
            # Get member info from GWP breakdown
            member = gwp.member

            authority = Authority(
                product_extraction_id=product_extraction.id,
                contract_link_id=link.id,
                member_id=member.id,
                gwp_breakdown_id=gwp.id,
                lob_name=gwp.line_of_business.name,
                cob_name=gwp.class_of_business.name,
                product_name=gwp.product.name,
                sub_product_name=gwp.sub_product.name,
                mpp_name=gwp.member_product_program.name,
                contract_id=contract.id if contract else None,
                contract_name=contract.filename if contract else "Unknown",
                extracted_data=product_extraction.extracted_data or {},
                analysis_summary=product_extraction.analysis_summary,
            )
            db.add(authority)
            db.commit()

        return ProductExtractionResponse(
            id=product_extraction.id,
            contract_link_id=product_extraction.contract_link_id,
            model_provider=product_extraction.model_provider,
            model_name=product_extraction.model_name,
            extracted_data=product_extraction.extracted_data or {},
            analysis_summary=product_extraction.analysis_summary,
            confidence_score=product_extraction.confidence_score,
            status=product_extraction.status,
            error_message=product_extraction.error_message,
            created_at=product_extraction.created_at,
            completed_at=product_extraction.completed_at,
        )

    except json.JSONDecodeError as e:
        product_extraction.status = "failed"
        product_extraction.error_message = f"Failed to parse AI response: {str(e)}"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        product_extraction.status = "failed"
        product_extraction.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@router.get("/product-extractions/{link_id}", response_model=ProductExtractionResponse)
def get_product_extraction(
    link_id: str,
    db: Session = Depends(get_db),
):
    """Get the product-specific extraction for a contract-product link."""
    extraction = db.query(ProductExtraction).filter(
        ProductExtraction.contract_link_id == link_id
    ).first()

    if not extraction:
        raise HTTPException(status_code=404, detail="Product extraction not found")

    return ProductExtractionResponse(
        id=extraction.id,
        contract_link_id=extraction.contract_link_id,
        model_provider=extraction.model_provider,
        model_name=extraction.model_name,
        extracted_data=extraction.extracted_data or {},
        analysis_summary=extraction.analysis_summary,
        confidence_score=extraction.confidence_score,
        status=extraction.status,
        error_message=extraction.error_message,
        created_at=extraction.created_at,
        completed_at=extraction.completed_at,
    )


@router.post("/product-extractions/batch-analyze", response_model=BatchAnalyzeResponse)
def batch_analyze_products(
    request: BatchAnalyzeRequest,
    db: Session = Depends(get_db),
):
    """Trigger AI analysis for all products linked to a contract."""
    # Get all links for this extraction
    links = db.query(ContractProductLink).filter(
        ContractProductLink.extraction_id == request.extraction_id
    ).all()

    if not links:
        raise HTTPException(status_code=404, detail="No product links found for this extraction")

    # Queue analysis for each link
    analyzed_count = 0
    for link in links:
        # Check if already analyzed
        existing = db.query(ProductExtraction).filter(
            ProductExtraction.contract_link_id == link.id,
            ProductExtraction.status == "completed"
        ).first()

        if not existing:
            # Create pending extraction
            product_extraction = ProductExtraction(
                contract_link_id=link.id,
                model_provider=request.model_provider,
                status="pending",
            )
            db.add(product_extraction)
            analyzed_count += 1

    db.commit()

    return BatchAnalyzeResponse(
        extraction_id=request.extraction_id,
        links_analyzed=analyzed_count,
        status="queued" if analyzed_count > 0 else "completed",
    )
