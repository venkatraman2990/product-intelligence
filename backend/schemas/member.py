"""Member API schemas."""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


# =============================================================================
# DIMENSION SCHEMAS
# =============================================================================

class LineOfBusinessResponse(BaseModel):
    """Line of Business response."""
    id: str
    lob_id: str
    name: str

    class Config:
        from_attributes = True


class ClassOfBusinessResponse(BaseModel):
    """Class of Business response."""
    id: str
    cob_id: str
    name: str

    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    """Product response."""
    id: str
    product_id: str
    name: str

    class Config:
        from_attributes = True


class SubProductResponse(BaseModel):
    """Sub Product response."""
    id: str
    sub_product_id: str
    name: str

    class Config:
        from_attributes = True


class MemberProductProgramResponse(BaseModel):
    """Member Product Program response."""
    id: str
    mpp_id: str
    name: str

    class Config:
        from_attributes = True


# =============================================================================
# GWP BREAKDOWN SCHEMAS
# =============================================================================

class GWPBreakdownResponse(BaseModel):
    """Single GWP breakdown row."""
    id: str
    total_gwp: Decimal

    # Dimension info
    line_of_business: LineOfBusinessResponse
    class_of_business: ClassOfBusinessResponse
    product: ProductResponse
    sub_product: SubProductResponse
    member_product_program: MemberProductProgramResponse

    class Config:
        from_attributes = True


class GWPTreeNode(BaseModel):
    """Node in the GWP hierarchy tree."""
    id: str
    code: str  # The ID code (LOB-XXXXXX, etc.)
    name: str
    level: str  # 'lob', 'cob', 'product', 'sub_product', 'mpp'
    total_gwp: Decimal
    children: list["GWPTreeNode"] = Field(default_factory=list)
    gwp_breakdown_ids: list[str] = Field(default_factory=list)  # For leaf nodes


class GWPTreeResponse(BaseModel):
    """Complete GWP tree for a member."""
    member_id: str
    member_name: str
    total_gwp: Decimal
    tree: list[GWPTreeNode]


# =============================================================================
# MEMBER SCHEMAS
# =============================================================================

class MemberBase(BaseModel):
    """Base member fields."""
    member_id: str  # PTY-XXXXXX
    name: str


class MemberCreate(MemberBase):
    """Schema for member creation."""
    pass


class MemberResponse(MemberBase):
    """Basic member response."""
    id: str
    created_at: datetime
    updated_at: datetime

    # Summary stats (computed)
    total_gwp: Optional[Decimal] = None
    gwp_row_count: int = 0
    contract_count: int = 0

    class Config:
        from_attributes = True


class MemberListItem(BaseModel):
    """Member item for list view."""
    id: str
    member_id: str
    name: str
    total_gwp: Decimal = Decimal("0")
    gwp_row_count: int = 0
    contract_count: int = 0

    class Config:
        from_attributes = True


class MemberListResponse(BaseModel):
    """Paginated member list response."""
    members: list[MemberListItem]
    total: int
    skip: int
    limit: int


class MemberDetail(BaseModel):
    """Detailed member information."""
    id: str
    member_id: str
    name: str
    created_at: datetime
    updated_at: datetime

    # Summary stats
    total_gwp: Decimal = Decimal("0")
    gwp_row_count: int = 0

    # Full GWP breakdown
    gwp_breakdowns: list[GWPBreakdownResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


# =============================================================================
# MEMBER CONTRACT SCHEMAS
# =============================================================================

class MemberContractCreate(BaseModel):
    """Create a member-contract link."""
    contract_id: str
    version_number: Optional[str] = "v1"
    effective_date: Optional[date] = None


class MemberContractResponse(BaseModel):
    """Member contract link response."""
    id: str
    member_id: str
    contract_id: str
    version_number: str
    is_current: bool
    effective_date: Optional[date] = None
    created_at: datetime

    # Contract info (joined)
    contract_filename: Optional[str] = None
    contract_file_type: Optional[str] = None

    class Config:
        from_attributes = True


class MemberContractListResponse(BaseModel):
    """List of contracts for a member."""
    contracts: list[MemberContractResponse]
    total: int


class ContractVersionCreate(BaseModel):
    """Create a new version of a member contract."""
    contract_id: str  # The new contract document
    effective_date: Optional[date] = None
    change_description: Optional[str] = None


class ContractVersionHistory(BaseModel):
    """Contract version with consolidated fields."""
    version_number: str
    contract_id: str
    effective_date: Optional[date] = None
    created_at: datetime
    is_current: bool
    extraction_id: Optional[str] = None
    extracted_fields: dict = Field(default_factory=dict)


class ConsolidatedContractView(BaseModel):
    """Consolidated view of contract fields across versions."""
    member_id: str
    member_name: str
    versions: list[ContractVersionHistory]
    consolidated_fields: dict = Field(default_factory=dict)  # Merged fields from all versions


# =============================================================================
# IMPORT SCHEMAS
# =============================================================================

class ImportRequest(BaseModel):
    """Request to import members from Excel."""
    file_path: str


class ImportResponse(BaseModel):
    """Response after importing members."""
    members_imported: int
    gwp_rows_imported: int
    dimension_counts: dict = Field(default_factory=dict)
    message: str = "Import completed successfully"


# =============================================================================
# TERM MAPPING SCHEMAS
# =============================================================================

class TermMappingCreate(BaseModel):
    """Create a term mapping."""
    extraction_id: str
    gwp_breakdown_id: str
    field_path: str


class TermMappingResponse(BaseModel):
    """Term mapping response."""
    id: str
    extraction_id: str
    gwp_breakdown_id: str
    field_path: str
    created_at: datetime

    class Config:
        from_attributes = True


class TermMappingSuggestion(BaseModel):
    """AI-suggested term mapping."""
    field_path: str
    field_value: str
    suggested_gwp_ids: list[str]
    confidence: float
    match_reason: str


class TermMappingSuggestRequest(BaseModel):
    """Request for term mapping suggestions."""
    extraction_id: str
    auto_approve: bool = False


class TermMappingSuggestResponse(BaseModel):
    """Response with term mapping suggestions."""
    extraction_id: str
    suggestions: list[TermMappingSuggestion]
    auto_approved: bool = False
    mappings_created: int = 0


# Needed for forward reference in GWPTreeNode
GWPTreeNode.model_rebuild()
