"""Portfolio API schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# =============================================================================
# PORTFOLIO ITEM SCHEMAS
# =============================================================================

class PortfolioItemCreate(BaseModel):
    """Create a portfolio item."""
    authority_id: str
    allocation_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class PortfolioItemUpdate(BaseModel):
    """Update a portfolio item."""
    allocation_pct: Decimal = Field(ge=0, le=100)


class AuthorityProductInfo(BaseModel):
    """Authority info for portfolio display."""
    id: str
    lob_name: str
    cob_name: str
    product_name: str
    sub_product_name: str
    mpp_name: str
    contract_name: str
    # From GWP breakdown
    total_gwp: Optional[Decimal] = None
    loss_ratio: Optional[Decimal] = None
    # From extracted data
    extracted_data: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True


class PortfolioItemResponse(BaseModel):
    """Portfolio item response with authority details."""
    id: str
    portfolio_id: str
    authority_id: str
    allocation_pct: Decimal
    created_at: datetime
    # Nested authority info
    authority: AuthorityProductInfo

    class Config:
        from_attributes = True


# =============================================================================
# PORTFOLIO SCHEMAS
# =============================================================================

class PortfolioCreate(BaseModel):
    """Create a portfolio."""
    name: str
    description: Optional[str] = None
    items: List[PortfolioItemCreate] = Field(default_factory=list)


class PortfolioUpdate(BaseModel):
    """Update a portfolio."""
    name: Optional[str] = None
    description: Optional[str] = None
    items: Optional[List[PortfolioItemCreate]] = None


class PortfolioSummary(BaseModel):
    """Computed portfolio summary metrics."""
    total_premium: Decimal = Decimal("0")
    max_annual_premium: Decimal = Decimal("0")
    avg_loss_ratio: Optional[Decimal] = None
    avg_limit: Optional[Decimal] = None
    growth_potential_pct: Optional[Decimal] = None
    total_allocation: Decimal = Decimal("0")


class PortfolioResponse(BaseModel):
    """Full portfolio response with items and summary."""
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Items
    items: List[PortfolioItemResponse] = Field(default_factory=list)
    # Computed summary
    summary: PortfolioSummary = Field(default_factory=PortfolioSummary)

    class Config:
        from_attributes = True


class PortfolioListItem(BaseModel):
    """Portfolio item for list view."""
    id: str
    name: str
    description: Optional[str] = None
    item_count: int = 0
    total_premium: Decimal = Decimal("0")
    avg_loss_ratio: Optional[Decimal] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PortfolioListResponse(BaseModel):
    """Paginated portfolio list response."""
    portfolios: List[PortfolioListItem]
    total: int


# =============================================================================
# INSURANCE PRODUCTS SCHEMAS (for product listing page)
# =============================================================================

class InsuranceProduct(BaseModel):
    """Insurance product derived from Authority record."""
    id: str  # authority_id
    # Product combination
    product_name: str  # Concatenated: Product - Sub Product - MPP
    lob_name: str
    cob_name: str
    full_product_name: str
    sub_product_name: str
    mpp_name: str
    # Metrics
    premium_volume: Optional[Decimal] = None  # from GWP
    loss_ratio: Optional[Decimal] = None
    # Contract info
    contract_name: str
    member_id: str
    # Extracted data for guidelines
    extracted_data: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True


class InsuranceProductListResponse(BaseModel):
    """List of insurance products."""
    products: List[InsuranceProduct]
    total: int
    # Filter options
    lob_options: List[str] = Field(default_factory=list)
    cob_options: List[str] = Field(default_factory=list)
