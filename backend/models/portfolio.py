"""Portfolio models for the Portfolio Builder feature."""

import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from backend.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Portfolio(Base):
    """User-created portfolio combining multiple insurance products."""

    __tablename__ = "portfolios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Cached summary metrics (updated on save)
    total_premium = Column(Numeric(15, 2), default=Decimal("0"))
    max_annual_premium = Column(Numeric(15, 2), default=Decimal("0"))
    avg_loss_ratio = Column(Numeric(5, 4), nullable=True)
    avg_limit = Column(Numeric(15, 2), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship(
        "PortfolioItem",
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="PortfolioItem.created_at"
    )

    def __repr__(self):
        return f"<Portfolio id={self.id} name={self.name}>"


class PortfolioItem(Base):
    """Individual product/authority in a portfolio."""

    __tablename__ = "portfolio_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    portfolio_id = Column(String(36), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    authority_id = Column(String(36), ForeignKey("authorities.id", ondelete="CASCADE"), nullable=False, index=True)

    # User-defined allocation percentage (0-100)
    allocation_pct = Column(Numeric(5, 2), nullable=False, default=Decimal("0"))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    portfolio = relationship("Portfolio", back_populates="items")
    authority = relationship("Authority")

    def __repr__(self):
        return f"<PortfolioItem id={self.id} portfolio={self.portfolio_id} allocation={self.allocation_pct}%>"
