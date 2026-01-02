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
    loss_ratio: Optional[Decimal] = None

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
    loss_ratio: Optional[Decimal] = None  # e.g., 0.64 = 64%
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


# =============================================================================
# CONTRACT-PRODUCT LINK SCHEMAS (NEW)
# =============================================================================

class ProductInfo(BaseModel):
    """Product hierarchy information for display."""
    id: str
    lob: dict  # {code, name}
    cob: dict  # {code, name}
    product: dict  # {code, name}
    sub_product: dict  # {code, name}
    mpp: dict  # {code, name}
    total_gwp: str
    loss_ratio: Optional[str] = None  # e.g., "0.64" for 64%


class ContractProductLinkCreate(BaseModel):
    """Create contract-product link(s)."""
    extraction_id: str
    gwp_breakdown_ids: list[str]  # Can link to multiple products at once
    link_reason: Optional[str] = None


class ContractProductLinkResponse(BaseModel):
    """Contract-product link response."""
    id: str
    extraction_id: str
    gwp_breakdown_id: str
    link_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Product info for display
    product_info: Optional[ProductInfo] = None

    # Analysis status
    has_extraction: bool = False
    extraction_status: Optional[str] = None

    class Config:
        from_attributes = True


class ContractProductLinksResponse(BaseModel):
    """List of contract-product links."""
    links: list[ContractProductLinkResponse]
    total: int


class ProductSuggestion(BaseModel):
    """AI-suggested product for a contract."""
    gwp_breakdown_id: str
    product_info: ProductInfo
    confidence: float
    reason: str


class SuggestProductsRequest(BaseModel):
    """Request AI suggestion for products."""
    extraction_id: str
    member_id: str
    model_provider: str = "anthropic"


class SuggestProductsResponse(BaseModel):
    """Response with AI-suggested products for a contract."""
    extraction_id: str
    suggestions: list[ProductSuggestion]


# =============================================================================
# PRODUCT EXTRACTION SCHEMAS (AI Analysis)
# =============================================================================

class ExtractedFieldData(BaseModel):
    """Single extracted field with value and citation."""
    value: Optional[str] = None
    citation: Optional[str] = None
    relevance_score: Optional[float] = None
    reasoning: Optional[str] = None


class ProductExtractionRequest(BaseModel):
    """Request AI analysis for a contract-product link."""
    contract_link_id: str
    model_provider: str = "anthropic"
    force: bool = False  # Force re-analysis even if completed extraction exists


class ProductExtractionResponse(BaseModel):
    """Product-specific extraction response."""
    id: str
    contract_link_id: str
    model_provider: str
    model_name: Optional[str] = None

    # Product-specific extracted data
    # Format: {field_path: {value, citation, relevance_score, reasoning}}
    extracted_data: dict = Field(default_factory=dict)

    # AI reasoning output
    analysis_summary: Optional[str] = None
    confidence_score: Optional[float] = None

    # Status
    status: str
    error_message: Optional[str] = None

    # Timestamps
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatchAnalyzeRequest(BaseModel):
    """Request batch analysis for all linked products of a contract."""
    extraction_id: str
    model_provider: str = "anthropic"


class BatchAnalyzeResponse(BaseModel):
    """Response for batch analysis request."""
    extraction_id: str
    links_analyzed: int
    status: str  # queued, processing, completed


# =============================================================================
# AUTHORITY SCHEMAS
# =============================================================================

class AuthorityBase(BaseModel):
    """Base authority fields."""
    extracted_data: dict = Field(default_factory=dict)
    analysis_summary: Optional[str] = None


class AuthorityUpdate(BaseModel):
    """Update authority extracted data."""
    extracted_data: Optional[dict] = None
    analysis_summary: Optional[str] = None


class AuthorityResponse(BaseModel):
    """Full authority response."""
    id: str

    # Source tracking
    product_extraction_id: str
    contract_link_id: str

    # Product combination
    member_id: str
    gwp_breakdown_id: str
    lob_name: str
    cob_name: str
    product_name: str
    sub_product_name: str
    mpp_name: str

    # Contract info
    contract_id: Optional[str] = None
    contract_name: str

    # Extracted data
    extracted_data: dict = Field(default_factory=dict)
    analysis_summary: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuthorityListItem(BaseModel):
    """Authority item for list view."""
    id: str
    member_id: str
    contract_id: Optional[str] = None
    contract_name: str
    lob_name: str
    cob_name: str
    product_name: str
    sub_product_name: str
    mpp_name: str
    field_count: int  # Number of extracted fields
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuthorityListResponse(BaseModel):
    """Paginated list of authorities."""
    authorities: list[AuthorityListItem]
    total: int
    skip: int
    limit: int


# =============================================================================
# SYSTEM PROMPT SCHEMAS
# =============================================================================

class SystemPromptBase(BaseModel):
    """Base system prompt fields."""
    prompt_key: str
    display_name: str
    description: Optional[str] = None
    prompt_content: str


class SystemPromptCreate(SystemPromptBase):
    """Create a system prompt."""
    pass


class SystemPromptUpdate(BaseModel):
    """Update a system prompt."""
    prompt_content: str


class SystemPromptResponse(SystemPromptBase):
    """System prompt response."""
    id: str
    is_custom: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SystemPromptListResponse(BaseModel):
    """List of system prompts."""
    prompts: list[SystemPromptResponse]
    total: int


# Needed for forward reference in GWPTreeNode
GWPTreeNode.model_rebuild()
