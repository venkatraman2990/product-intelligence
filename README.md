# Product Intelligence

A foundational intelligence layer for Accelerant's insurance products, providing a unified view of member capabilities, authority levels, and portfolio composition.

## Overview

Product Intelligence solves the critical problem of fragmented member data across contracts, underwriting guidelines, and transaction systems. By creating a continuously updated intelligence layer, the system enables better onboarding decisions, risk management, and portfolio analysis across the Accelerant Risk Exchange (ARX).

## The Problem

Insurance operations at Accelerant involve complex data scattered across multiple sources:

- **Contracts & Guidelines** — Underwriting rules buried in PDFs with nuanced conditional logic
- **Transaction Systems** — Bordereau submissions, policy records, and claims data in Snowflake
- **Member Profiles** — Authority levels, COB/LOB specializations, and capacity limits

Traditional structured approaches lose the nuance in underwriting guidelines. Rigid schemas can't capture conditional logic like *"up to $2M for frame construction, but only $500K if within 1,000 feet of brush"*.

## Solution Architecture

Product Intelligence uses a hybrid approach combining:

| Layer | Purpose |
|-------|---------|
| **Document Store** | Preserves original guideline context and audit trails |
| **Vector Index** | Enables semantic search across member guidelines |
| **Structured Layer** | Lightweight schema for portfolio aggregation and analytics |
| **RAG Engine** | Queries that combine semantic understanding with structured filters |

### Multi-Modal Embeddings

Member similarity matching combines multiple embedding types:

- **Text embeddings** for guideline semantics
- **Structured embeddings** for limits, deductibles, and geographies
- **Composite scores** with interpretable weights for underwriter transparency

## Core Components

### 1. Guidelines Extraction

Leverages Landing AI's Agentic Document Extraction (ADE) API for:

- Document parsing and intelligent splitting
- Structured data extraction with **visual grounding** (links extracted data to exact document locations)
- Preservation of conditional logic and context

### 2. Transaction Data Integration

Connects to Accelerant's Snowflake infrastructure within the Accelerant Data Platform (ADP):

- Real-time sync with bordereau submissions
- Policy and claims data aggregation
- Historical performance metrics

### 3. Dynamic Portfolio Construction

Build and analyze portfolios with:

- Aggregation risk assessment
- Vertical and swim lane conflict detection
- RORAC (Return on Risk-Adjusted Capital) calculations

### 4. Member Similarity Matching

Support new member onboarding by finding comparable existing members:

- Multi-dimensional similarity scoring
- Interpretable explanations for underwriters
- COB/LOB alignment analysis

### 5. Bordereau Validation

Automated authority breach detection:

- Real-time validation against extracted guidelines
- Limit and coverage compliance checks
- Exception flagging and reporting

## Getting Started

### Prerequisites

- Python 3.10+
- Access to Accelerant's Snowflake instance
- Landing AI API credentials

### Installation

```bash
git clone https://github.com/accelerant/product-intelligence.git
cd product-intelligence
pip install -r requirements.txt
```

### Configuration

Create a `.env` file with your credentials:

```env
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=your_database

LANDING_AI_API_KEY=your_api_key
```

### Quick Start

```python
from product_intelligence import MemberIntelligence

# Initialize the intelligence layer
intel = MemberIntelligence()

# Extract guidelines from a contract
guidelines = intel.extract_guidelines("path/to/contract.pdf")

# Find similar members for onboarding
similar = intel.find_similar_members(
    cob="General Liability",
    geography="Southeast US",
    limit=5
)

# Validate a bordereau submission
validation = intel.validate_bordereau(
    member_id="MBR-001",
    submission_path="path/to/bordereau.xlsx"
)
```

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Manual extraction with ADE integration | 🟡 In Progress |
| **Phase 2** | Transaction data pipeline & portfolio tools | ⚪ Planned |
| **Phase 3** | Similarity matching & onboarding support | ⚪ Planned |
| **Phase 4** | Automated validation & breach detection | ⚪ Planned |
| **Phase 5** | Full ML automation & continuous learning | ⚪ Future |

## Key Concepts

| Term | Definition |
|------|------------|
| **COB/LOB** | Class of Business / Line of Business — insurance product categories |
| **RORAC** | Return on Risk-Adjusted Capital — profitability metric |
| **Bordereau** | Detailed listing of insurance policies or claims submitted by members |
| **Swim Lane** | Defined authority boundaries for underwriting specific risk types |
| **ADP** | Accelerant Data Platform — central data infrastructure |
| **ARX** | Accelerant Risk Exchange — the member network and marketplace |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

Proprietary — Accelerant Insurance. All rights reserved.

---

**Questions?** Reach out to the Product Intelligence team or open an issue.
