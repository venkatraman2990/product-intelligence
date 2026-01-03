"""Portfolio management endpoints."""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from backend.api.deps import get_db
from backend.models.portfolio import Portfolio, PortfolioItem
from backend.models.member import Authority, GWPBreakdown
from backend.schemas.portfolio import (
    PortfolioCreate,
    PortfolioUpdate,
    PortfolioResponse,
    PortfolioListItem,
    PortfolioListResponse,
    PortfolioItemCreate,
    PortfolioItemResponse,
    PortfolioItemUpdate,
    PortfolioSummary,
    AuthorityProductInfo,
    InsuranceProduct,
    InsuranceProductListResponse,
)

router = APIRouter()


def compute_portfolio_summary(items: list, db: Session) -> PortfolioSummary:
    """Compute portfolio summary metrics from items."""
    if not items:
        return PortfolioSummary()

    total_premium = Decimal("0")
    max_annual_premium = Decimal("0")
    total_allocation = Decimal("0")
    weighted_loss_ratio_sum = Decimal("0")
    weighted_limit_sum = Decimal("0")
    loss_ratio_weight = Decimal("0")
    limit_weight = Decimal("0")

    for item in items:
        allocation = item.allocation_pct or Decimal("0")
        total_allocation += allocation

        authority = item.authority
        if not authority:
            continue

        # Get GWP data
        gwp = authority.gwp_breakdown
        if gwp:
            premium = gwp.total_gwp or Decimal("0")
            total_premium += premium * allocation / Decimal("100")

            if gwp.loss_ratio is not None:
                weighted_loss_ratio_sum += gwp.loss_ratio * allocation
                loss_ratio_weight += allocation

        # Get extracted data
        extracted = authority.extracted_data or {}

        # Max annual premium from extracted data
        max_premium_field = extracted.get("max_annual_premium", {})
        if isinstance(max_premium_field, dict):
            max_premium_val = max_premium_field.get("value")
        else:
            max_premium_val = max_premium_field

        if max_premium_val:
            try:
                max_premium = Decimal(str(max_premium_val).replace(",", "").replace("$", ""))
                max_annual_premium += max_premium * allocation / Decimal("100")
            except (ValueError, TypeError):
                pass

        # Max liability limit from extracted data
        max_limit_field = extracted.get("max_limits_of_liability", {})
        if isinstance(max_limit_field, dict):
            max_limit_val = max_limit_field.get("value")
        else:
            max_limit_val = max_limit_field

        if max_limit_val:
            try:
                max_limit = Decimal(str(max_limit_val).replace(",", "").replace("$", ""))
                weighted_limit_sum += max_limit * allocation
                limit_weight += allocation
            except (ValueError, TypeError):
                pass

    # Calculate weighted averages
    avg_loss_ratio = None
    if loss_ratio_weight > 0:
        avg_loss_ratio = weighted_loss_ratio_sum / loss_ratio_weight

    avg_limit = None
    if limit_weight > 0:
        avg_limit = weighted_limit_sum / limit_weight

    # Calculate growth potential
    growth_potential_pct = None
    if max_annual_premium > 0:
        growth_potential_pct = ((max_annual_premium - total_premium) / max_annual_premium) * Decimal("100")

    return PortfolioSummary(
        total_premium=total_premium,
        max_annual_premium=max_annual_premium,
        avg_loss_ratio=avg_loss_ratio,
        avg_limit=avg_limit,
        growth_potential_pct=growth_potential_pct,
        total_allocation=total_allocation,
    )


def authority_to_product_info(authority: Authority) -> AuthorityProductInfo:
    """Convert Authority to AuthorityProductInfo."""
    gwp = authority.gwp_breakdown
    return AuthorityProductInfo(
        id=authority.id,
        lob_name=authority.lob_name or "",
        cob_name=authority.cob_name or "",
        product_name=authority.product_name or "",
        sub_product_name=authority.sub_product_name or "",
        mpp_name=authority.mpp_name or "",
        contract_name=authority.contract_name or "",
        total_gwp=gwp.total_gwp if gwp else None,
        loss_ratio=gwp.loss_ratio if gwp else None,
        extracted_data=authority.extracted_data or {},
    )


def portfolio_item_to_response(item: PortfolioItem) -> PortfolioItemResponse:
    """Convert PortfolioItem to response."""
    return PortfolioItemResponse(
        id=item.id,
        portfolio_id=item.portfolio_id,
        authority_id=item.authority_id,
        allocation_pct=item.allocation_pct,
        created_at=item.created_at,
        authority=authority_to_product_info(item.authority),
    )


# =============================================================================
# INSURANCE PRODUCTS ENDPOINT (for product selection)
# Must be defined BEFORE /{portfolio_id} to avoid route conflicts
# =============================================================================

@router.get("/products/list", response_model=InsuranceProductListResponse)
async def list_insurance_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    lob: Optional[str] = None,
    cob: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List insurance products (from Authority records) for portfolio selection."""
    query = (
        db.query(Authority)
        .options(joinedload(Authority.gwp_breakdown))
    )

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Authority.product_name.ilike(search_filter)) |
            (Authority.sub_product_name.ilike(search_filter)) |
            (Authority.mpp_name.ilike(search_filter)) |
            (Authority.lob_name.ilike(search_filter)) |
            (Authority.cob_name.ilike(search_filter))
        )

    if lob:
        query = query.filter(Authority.lob_name == lob)

    if cob:
        query = query.filter(Authority.cob_name == cob)

    total = query.count()
    authorities = query.order_by(Authority.lob_name, Authority.cob_name, Authority.product_name).offset(skip).limit(limit).all()

    # Get filter options
    lob_options = [r[0] for r in db.query(Authority.lob_name).distinct().all() if r[0]]
    cob_options = [r[0] for r in db.query(Authority.cob_name).distinct().all() if r[0]]

    products = []
    for auth in authorities:
        gwp = auth.gwp_breakdown
        # Create concatenated product name
        parts = [p for p in [auth.product_name, auth.sub_product_name, auth.mpp_name] if p]
        full_product_name = " - ".join(parts) if parts else "Unknown Product"

        products.append(InsuranceProduct(
            id=auth.id,
            product_name=full_product_name,
            lob_name=auth.lob_name or "",
            cob_name=auth.cob_name or "",
            full_product_name=auth.product_name or "",
            sub_product_name=auth.sub_product_name or "",
            mpp_name=auth.mpp_name or "",
            premium_volume=gwp.total_gwp if gwp else None,
            loss_ratio=gwp.loss_ratio if gwp else None,
            contract_name=auth.contract_name or "",
            member_id=auth.member_id or "",
            extracted_data=auth.extracted_data or {},
        ))

    return InsuranceProductListResponse(
        products=products,
        total=total,
        lob_options=sorted(lob_options),
        cob_options=sorted(cob_options),
    )


# =============================================================================
# PORTFOLIO CRUD ENDPOINTS
# =============================================================================

@router.get("", response_model=PortfolioListResponse)
async def list_portfolios(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all portfolios."""
    query = db.query(Portfolio)

    if search:
        query = query.filter(Portfolio.name.ilike(f"%{search}%"))

    total = query.count()
    portfolios = query.order_by(Portfolio.updated_at.desc()).offset(skip).limit(limit).all()

    items = []
    for p in portfolios:
        # Get item count
        item_count = db.query(PortfolioItem).filter(PortfolioItem.portfolio_id == p.id).count()

        items.append(PortfolioListItem(
            id=p.id,
            name=p.name,
            description=p.description,
            item_count=item_count,
            total_premium=p.total_premium or Decimal("0"),
            avg_loss_ratio=p.avg_loss_ratio,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ))

    return PortfolioListResponse(portfolios=items, total=total)


@router.post("", response_model=PortfolioResponse)
async def create_portfolio(
    data: PortfolioCreate,
    db: Session = Depends(get_db),
):
    """Create a new portfolio."""
    portfolio = Portfolio(
        name=data.name,
        description=data.description,
    )
    db.add(portfolio)
    db.flush()  # Get the ID

    # Add items
    for item_data in data.items:
        # Verify authority exists
        authority = db.query(Authority).filter(Authority.id == item_data.authority_id).first()
        if not authority:
            raise HTTPException(status_code=404, detail=f"Authority {item_data.authority_id} not found")

        item = PortfolioItem(
            portfolio_id=portfolio.id,
            authority_id=item_data.authority_id,
            allocation_pct=item_data.allocation_pct,
        )
        db.add(item)

    db.commit()
    db.refresh(portfolio)

    # Load items with relationships
    items = (
        db.query(PortfolioItem)
        .filter(PortfolioItem.portfolio_id == portfolio.id)
        .options(joinedload(PortfolioItem.authority).joinedload(Authority.gwp_breakdown))
        .all()
    )

    summary = compute_portfolio_summary(items, db)

    # Update cached summary
    portfolio.total_premium = summary.total_premium
    portfolio.max_annual_premium = summary.max_annual_premium
    portfolio.avg_loss_ratio = summary.avg_loss_ratio
    portfolio.avg_limit = summary.avg_limit
    db.commit()

    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
        items=[portfolio_item_to_response(i) for i in items],
        summary=summary,
    )


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(
    portfolio_id: str,
    db: Session = Depends(get_db),
):
    """Get a portfolio by ID."""
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    # Load items with relationships
    items = (
        db.query(PortfolioItem)
        .filter(PortfolioItem.portfolio_id == portfolio_id)
        .options(joinedload(PortfolioItem.authority).joinedload(Authority.gwp_breakdown))
        .all()
    )

    summary = compute_portfolio_summary(items, db)

    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
        items=[portfolio_item_to_response(i) for i in items],
        summary=summary,
    )


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: str,
    data: PortfolioUpdate,
    db: Session = Depends(get_db),
):
    """Update a portfolio."""
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    if data.name is not None:
        portfolio.name = data.name
    if data.description is not None:
        portfolio.description = data.description

    # If items are provided, replace all items
    if data.items is not None:
        # Delete existing items
        db.query(PortfolioItem).filter(PortfolioItem.portfolio_id == portfolio_id).delete()

        # Add new items
        for item_data in data.items:
            authority = db.query(Authority).filter(Authority.id == item_data.authority_id).first()
            if not authority:
                raise HTTPException(status_code=404, detail=f"Authority {item_data.authority_id} not found")

            item = PortfolioItem(
                portfolio_id=portfolio.id,
                authority_id=item_data.authority_id,
                allocation_pct=item_data.allocation_pct,
            )
            db.add(item)

    db.commit()
    db.refresh(portfolio)

    # Load items with relationships
    items = (
        db.query(PortfolioItem)
        .filter(PortfolioItem.portfolio_id == portfolio_id)
        .options(joinedload(PortfolioItem.authority).joinedload(Authority.gwp_breakdown))
        .all()
    )

    summary = compute_portfolio_summary(items, db)

    # Update cached summary
    portfolio.total_premium = summary.total_premium
    portfolio.max_annual_premium = summary.max_annual_premium
    portfolio.avg_loss_ratio = summary.avg_loss_ratio
    portfolio.avg_limit = summary.avg_limit
    db.commit()

    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
        items=[portfolio_item_to_response(i) for i in items],
        summary=summary,
    )


@router.delete("/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str,
    db: Session = Depends(get_db),
):
    """Delete a portfolio."""
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    db.delete(portfolio)
    db.commit()

    return {"message": "Portfolio deleted"}


# =============================================================================
# PORTFOLIO ITEM ENDPOINTS
# =============================================================================

@router.post("/{portfolio_id}/items", response_model=PortfolioItemResponse)
async def add_portfolio_item(
    portfolio_id: str,
    data: PortfolioItemCreate,
    db: Session = Depends(get_db),
):
    """Add an item to a portfolio."""
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    authority = db.query(Authority).filter(Authority.id == data.authority_id).first()
    if not authority:
        raise HTTPException(status_code=404, detail="Authority not found")

    # Check if already exists
    existing = (
        db.query(PortfolioItem)
        .filter(PortfolioItem.portfolio_id == portfolio_id, PortfolioItem.authority_id == data.authority_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Item already exists in portfolio")

    item = PortfolioItem(
        portfolio_id=portfolio_id,
        authority_id=data.authority_id,
        allocation_pct=data.allocation_pct,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Load authority with GWP
    item.authority = (
        db.query(Authority)
        .filter(Authority.id == item.authority_id)
        .options(joinedload(Authority.gwp_breakdown))
        .first()
    )

    return portfolio_item_to_response(item)


@router.put("/{portfolio_id}/items/{item_id}", response_model=PortfolioItemResponse)
async def update_portfolio_item(
    portfolio_id: str,
    item_id: str,
    data: PortfolioItemUpdate,
    db: Session = Depends(get_db),
):
    """Update a portfolio item's allocation."""
    item = (
        db.query(PortfolioItem)
        .filter(PortfolioItem.id == item_id, PortfolioItem.portfolio_id == portfolio_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Portfolio item not found")

    item.allocation_pct = data.allocation_pct
    db.commit()
    db.refresh(item)

    # Load authority with GWP
    item.authority = (
        db.query(Authority)
        .filter(Authority.id == item.authority_id)
        .options(joinedload(Authority.gwp_breakdown))
        .first()
    )

    return portfolio_item_to_response(item)


@router.delete("/{portfolio_id}/items/{item_id}")
async def remove_portfolio_item(
    portfolio_id: str,
    item_id: str,
    db: Session = Depends(get_db),
):
    """Remove an item from a portfolio."""
    item = (
        db.query(PortfolioItem)
        .filter(PortfolioItem.id == item_id, PortfolioItem.portfolio_id == portfolio_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Portfolio item not found")

    db.delete(item)
    db.commit()

    return {"message": "Item removed"}
