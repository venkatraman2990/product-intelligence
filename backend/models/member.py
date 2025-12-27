"""Member and GWP ORM models."""

import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Boolean, Date, Text, Float, UniqueConstraint
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from backend.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


# =============================================================================
# DIMENSION TABLES
# =============================================================================

class Member(Base):
    """Insurance member."""

    __tablename__ = "members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    member_id = Column(String(20), unique=True, nullable=False, index=True)  # PTY-XXXXXX
    name = Column(String(255), nullable=False, index=True)

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    gwp_breakdowns = relationship("GWPBreakdown", back_populates="member", cascade="all, delete-orphan")
    member_contracts = relationship("MemberContract", back_populates="member", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Member {self.member_id}: {self.name}>"


class LineOfBusiness(Base):
    """Line of Business dimension."""

    __tablename__ = "line_of_business"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    lob_id = Column(String(20), unique=True, nullable=False, index=True)  # LOB-XXXXXX
    name = Column(String(255), nullable=False)

    # Relationships
    gwp_breakdowns = relationship("GWPBreakdown", back_populates="line_of_business")

    def __repr__(self):
        return f"<LineOfBusiness {self.lob_id}: {self.name}>"


class ClassOfBusiness(Base):
    """Class of Business dimension."""

    __tablename__ = "class_of_business"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    cob_id = Column(String(20), unique=True, nullable=False, index=True)  # COB-XXXXXX
    name = Column(String(255), nullable=False)

    # Relationships
    gwp_breakdowns = relationship("GWPBreakdown", back_populates="class_of_business")

    def __repr__(self):
        return f"<ClassOfBusiness {self.cob_id}: {self.name}>"


class Product(Base):
    """Product dimension."""

    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(20), unique=True, nullable=False, index=True)  # PRO-XXXXXX
    name = Column(String(255), nullable=False)

    # Relationships
    gwp_breakdowns = relationship("GWPBreakdown", back_populates="product")

    def __repr__(self):
        return f"<Product {self.product_id}: {self.name}>"


class SubProduct(Base):
    """Sub Product dimension."""

    __tablename__ = "sub_products"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sub_product_id = Column(String(20), unique=True, nullable=False, index=True)  # SUP-XXXXXX
    name = Column(String(255), nullable=False)

    # Relationships
    gwp_breakdowns = relationship("GWPBreakdown", back_populates="sub_product")

    def __repr__(self):
        return f"<SubProduct {self.sub_product_id}: {self.name}>"


class MemberProductProgram(Base):
    """Member Product Program dimension."""

    __tablename__ = "member_product_programs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    mpp_id = Column(String(20), unique=True, nullable=False, index=True)  # MPP-XXXXXX
    name = Column(String(255), nullable=False)

    # Relationships
    gwp_breakdowns = relationship("GWPBreakdown", back_populates="member_product_program")

    def __repr__(self):
        return f"<MemberProductProgram {self.mpp_id}: {self.name}>"


# =============================================================================
# FACT TABLE
# =============================================================================

class GWPBreakdown(Base):
    """GWP breakdown fact table - links members to product hierarchy with GWP amounts."""

    __tablename__ = "gwp_breakdown"

    id = Column(String(36), primary_key=True, default=generate_uuid)

    # Foreign keys to dimensions
    member_id = Column(String(36), ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    lob_id = Column(String(36), ForeignKey("line_of_business.id"), nullable=False, index=True)
    cob_id = Column(String(36), ForeignKey("class_of_business.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False, index=True)
    sub_product_id = Column(String(36), ForeignKey("sub_products.id"), nullable=False, index=True)
    mpp_id = Column(String(36), ForeignKey("member_product_programs.id"), nullable=False, index=True)

    # GWP amount
    total_gwp = Column(Numeric(15, 2), nullable=False, default=0)

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    member = relationship("Member", back_populates="gwp_breakdowns")
    line_of_business = relationship("LineOfBusiness", back_populates="gwp_breakdowns")
    class_of_business = relationship("ClassOfBusiness", back_populates="gwp_breakdowns")
    product = relationship("Product", back_populates="gwp_breakdowns")
    sub_product = relationship("SubProduct", back_populates="gwp_breakdowns")
    member_product_program = relationship("MemberProductProgram", back_populates="gwp_breakdowns")
    term_mappings = relationship("ContractTermMapping", back_populates="gwp_breakdown", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<GWPBreakdown member={self.member_id} gwp={self.total_gwp}>"


# =============================================================================
# CONTRACT LINKING TABLES
# =============================================================================

class MemberContract(Base):
    """Links contracts to members with version tracking."""

    __tablename__ = "member_contracts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    member_id = Column(String(36), ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Version tracking
    version_number = Column(String(10), nullable=False, default="v1")  # v1, v2, v3, etc.
    is_current = Column(Boolean, default=True, index=True)
    effective_date = Column(Date)

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    member = relationship("Member", back_populates="member_contracts")
    contract = relationship("Contract", backref="member_contracts")

    def __repr__(self):
        return f"<MemberContract member={self.member_id} contract={self.contract_id} {self.version_number}>"


class ContractTermMapping(Base):
    """Maps extracted contract terms to GWP breakdown rows.

    DEPRECATED: Use ContractProductLink instead for contract-level mapping.
    Kept for backward compatibility during migration.
    """

    __tablename__ = "contract_term_mappings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    extraction_id = Column(String(36), ForeignKey("extractions.id", ondelete="CASCADE"), nullable=False, index=True)
    gwp_breakdown_id = Column(String(36), ForeignKey("gwp_breakdown.id", ondelete="CASCADE"), nullable=False, index=True)

    # Which field from the extraction this mapping is for
    field_path = Column(String(255), nullable=False)  # e.g., "limits.per_occurrence"

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    extraction = relationship("Extraction", backref="term_mappings")
    gwp_breakdown = relationship("GWPBreakdown", back_populates="term_mappings")

    def __repr__(self):
        return f"<ContractTermMapping {self.field_path} -> gwp={self.gwp_breakdown_id}>"


# =============================================================================
# CONTRACT-PRODUCT LINKING (NEW)
# =============================================================================

class ContractProductLink(Base):
    """Links contracts (via extractions) to product combinations (GWPBreakdown).

    This replaces field-level mapping with contract-level mapping.
    One contract can link to multiple products, and one product can be linked
    to multiple contracts (many-to-many relationship).
    """

    __tablename__ = "contract_product_links"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    extraction_id = Column(String(36), ForeignKey("extractions.id", ondelete="CASCADE"), nullable=False, index=True)
    gwp_breakdown_id = Column(String(36), ForeignKey("gwp_breakdown.id", ondelete="CASCADE"), nullable=False, index=True)

    # Optional metadata about the link
    link_reason = Column(Text)  # Why this contract applies to this product

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint: one link per extraction-product combination
    __table_args__ = (
        UniqueConstraint('extraction_id', 'gwp_breakdown_id', name='uq_extraction_product'),
    )

    # Relationships
    extraction = relationship("Extraction", backref="product_links")
    gwp_breakdown = relationship("GWPBreakdown", backref="contract_links")
    product_extractions = relationship("ProductExtraction", back_populates="contract_link", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ContractProductLink extraction={self.extraction_id} -> product={self.gwp_breakdown_id}>"


class ProductExtraction(Base):
    """Stores AI-analyzed, product-specific extracted data for a contract-product link.

    After a contract is linked to a product, AI analyzes the contract to determine
    which fields/values specifically apply to that product combination.
    """

    __tablename__ = "product_extractions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    contract_link_id = Column(String(36), ForeignKey("contract_product_links.id", ondelete="CASCADE"), nullable=False, index=True)

    # AI analysis configuration
    model_provider = Column(String(50), nullable=False)  # anthropic, openai, etc.
    model_name = Column(String(100))

    # Product-specific extracted data
    # Format: {field_path: {value: ..., citation: ..., relevance_score: ...}}
    extracted_data = Column(JSON, default=dict)

    # AI reasoning output
    analysis_summary = Column(Text)  # AI's explanation of how fields apply to this product
    confidence_score = Column(Float)

    # Status tracking
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    error_message = Column(Text)

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    # Relationships
    contract_link = relationship("ContractProductLink", back_populates="product_extractions")

    def __repr__(self):
        return f"<ProductExtraction link={self.contract_link_id} status={self.status}>"


class Authority(Base):
    """Editable authority record created from product extractions.

    Auto-created when AI product extraction completes. Contains denormalized
    product combination and contract info for easy querying, plus editable
    extracted data with citations.
    """

    __tablename__ = "authorities"

    id = Column(String(36), primary_key=True, default=generate_uuid)

    # Source tracking
    product_extraction_id = Column(String(36), ForeignKey("product_extractions.id"), unique=True, index=True)
    contract_link_id = Column(String(36), ForeignKey("contract_product_links.id"), index=True)

    # Product combination (denormalized for easy querying)
    member_id = Column(String(36), ForeignKey("members.id"), index=True)
    gwp_breakdown_id = Column(String(36), ForeignKey("gwp_breakdown.id"), index=True)
    lob_name = Column(String(255))
    cob_name = Column(String(255))
    product_name = Column(String(255))
    sub_product_name = Column(String(255))
    mpp_name = Column(String(255))

    # Contract info
    contract_id = Column(String(36), ForeignKey("contracts.id"), index=True)
    contract_name = Column(String(255))

    # Extracted data (editable JSON copy)
    # Format: {field_path: {value: ..., citation: ..., relevance_score: ..., reasoning: ...}}
    extracted_data = Column(JSON, default=dict)
    analysis_summary = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product_extraction = relationship("ProductExtraction")
    member = relationship("Member")
    contract_link = relationship("ContractProductLink")
    gwp_breakdown = relationship("GWPBreakdown")

    def __repr__(self):
        return f"<Authority id={self.id} member={self.member_id} product={self.product_name}>"


class SystemPrompt(Base):
    """Customizable system prompts for AI operations.

    Stores custom prompt overrides. If a prompt is not in the database,
    the application falls back to default prompts defined in code.
    """

    __tablename__ = "system_prompts"

    id = Column(String(36), primary_key=True, default=generate_uuid)

    # Unique key identifying this prompt
    # e.g., "contract_extraction_system", "product_extraction_system"
    prompt_key = Column(String(100), unique=True, nullable=False, index=True)

    # Human-readable name for display
    display_name = Column(String(255), nullable=False)

    # Description of what this prompt does
    description = Column(Text)

    # The actual prompt content (can be very long)
    prompt_content = Column(Text, nullable=False)

    # Track if this is a custom override or default
    is_custom = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SystemPrompt key={self.prompt_key}>"
