# Product Intelligence
## Product Requirements Document

**Version:** 0.2 (Draft)  
**Owner:** Venkat  
**Last Updated:** December 2024  
**Reviewers:** Mike (TBD)

---

## Executive Summary

Product Intelligence is a foundational map of all insurance products written by each member—or within specific LOBs and Verticals—across the Accelerant ecosystem. It provides internal teams, particularly insurer and reinsurer teams, with clear visibility into member authority, capabilities, risks insured by ARX, and potential aggregation risks across the portfolio.

By creating a structured intelligence data product, Accelerant gains the ability to:
- Assemble complex portfolios on demand
- Understand aggregations at a deeper level
- Automate manual workloads across underwriting, actuarial, and insurer teams
- Act faster and wiser on potential opportunities

This effort also produces a consumable dataset for upstream and downstream applications and establishes a foundational layer for future ML/AI capabilities.

---

## Problem Statement

Today, internal teams lack a unified view of key member attributes, including:
- What each member is capable of writing
- Member authority levels (limits, deductibles, geographies)
- Member profit commission terms
- Premium profiles across various dimensions (vertical, limit bands, geography)
- Standardized view of member authorities segmented by insurance product classifications (COB/LOB, Verticals)

This fragmentation creates several challenges:

| Challenge | Impact |
|-----------|--------|
| Reduced precision in portfolio design | Suboptimal risk selection and capacity allocation |
| Higher exposure to authority breaches | Compliance risk, potential claim disputes |
| Concentration risk | Undetected aggregation exposures |
| Slower decision-making | Manual processes in onboarding, portfolio construction |
| Limited opportunity detection | Inability to spot high-value opportunities or structural gaps |

As Accelerant continues to scale, the absence of a centralized intelligence layer constrains decision quality and creates knowledge silos.

---

## Expected Business Impact

### Operational Impact
- Faster, more accurate product and portfolio design
- Reduction in manual discovery and repetitive work by underwriting, actuarial, and insurer teams
- Improved consistency and governance across decisions

### Financial Impact
- Higher portfolio quality through alignment of risk selection with member strengths
- Early detection of underutilized capacity or emerging growth opportunities
- Reduced losses from authority breaches caught earlier

### Strategic Impact
- Enables an intelligent portfolio marketplace with minimal manual intervention
- Forms the backbone for AI-assisted appetite matching
- Enhances new member onboarding with clarity around swim lane conflicts and faster benchmarking
- Creates the map of what Accelerant's portfolio could be at full capacity

---

## Product Components

### Component 1: Guidelines Extraction Engine

**Objective:** Parse contracts and underwriting guidelines to extract structured intelligence while preserving contextual nuance.

**Document Types:**
- Underwriting guidelines
- Member contracts
- Appetite statements
- Endorsements and amendments

**Technology: Landing AI Agentic Document Extraction (ADE)**

Landing AI's ADE platform provides three specialized APIs that will power the extraction engine:

| API | Function | Application to Product Intelligence |
|-----|----------|-------------------------------------|
| **Parse** | Converts documents into structured Markdown with hierarchical JSON. Identifies elements (text, tables, form fields, checkboxes) with exact page and coordinate references. | Initial ingestion of UW guidelines, contracts, and amendments. Preserves document structure and element relationships. |
| **Split** | Classifies and separates parsed documents into sub-documents by type or section. | Separate multi-document packages (e.g., contract + guidelines + endorsements) into discrete components for processing. |
| **Extract** | Pulls specific data fields using schema-based extraction with document classification. | Extract structured fields (limits, deductibles, territories, exclusions) into JSON schemas for validation rules. |

**Key ADE Capabilities:**
- **Visual grounding:** Every extracted element includes document, page, and coordinate-level references—enabling audit trails and citation back to source
- **Layout-agnostic parsing:** Handles complex insurance document layouts (tables, forms, checkboxes, nested sections) without templates or training
- **Hierarchical relationships:** Understands how elements relate (e.g., a table caption belongs to a table, an exclusion applies to a specific coverage)
- **Chat with documents:** Conversational interface to query documents with visually grounded answers citing exact source locations
- **Confidence scores:** Experimental feature providing extraction confidence for QA and review workflows
- **LLM-ready output:** Markdown and JSON output formatted for downstream RAG applications

**Integration Approach:**
- API-based integration via Landing AI's REST API or Python/TypeScript libraries
- Snowflake-native option available (ADE on Snowflake) for direct integration with Accelerant Data Platform
- Zero Data Retention (ZDR) option available for sensitive document handling

**Extraction Schema Design:**
Define JSON schemas for key insurance product fields:
```
- authority.limits (per_risk, aggregate)
- authority.deductibles (min, max, by_coverage)
- authority.territories (states, regions, exclusions)
- authority.classes_of_business (eligible, excluded)
- terms.profit_commission (tiers, thresholds)
- terms.premium_bands (min, max)
- appetite.referral_triggers
- appetite.exclusions
```

**Query Interface:**
Leverage ADE's chat capability to answer questions like:
- "Can Member X write a $3M property risk in Miami?"
- "What exclusions exist across my GL portfolio?"
- "Which members have overlapping authority in coastal property?"

Responses include visual grounding—highlighting the exact document region supporting each answer—plus reasoning chains for transparency.

**Key Outputs:**
- Structured member product profiles (JSON)
- Searchable guideline repository with citations
- Validation rule schemas for bordereau processing (Component 5)
- Audit trail linking every extracted field to source document location

---

### Component 2: Transaction Data Integration

**Objective:** Enrich extracted guideline data with actual performance metrics from Snowflake to enable performance-aware portfolio decisions.

**Data Integration:**
- Map extracted insurance products to corresponding transaction records
- Associate key metrics: written premium, earned premium, claims (paid/incurred), exposure counts, loss ratios
- Enable time-series analysis of product performance against underwriting authority
- Support RORAC calculations at the product level

**Intelligence Queries Enabled:**
- "What's the historical loss ratio for Member X's GL book in the Southeast?"
- "Show me premium volume by limit band for commercial property across all members"
- "Which products are underperforming their projected loss ratio?"

**Key Outputs:**
- Performance-enriched product profiles
- Loss ratio trending by product characteristics
- Premium volume by authority utilization
- Projected vs. actual loss ratio comparisons

---

### Component 3: Dynamic Portfolio Construction Tool

**Objective:** Provide Risk Capital partners with a dynamic view of Accelerant's portfolio and enable capacity allocation modeling.

**User Persona:** Risk Capital Partner

**Core Capabilities:**
- Display all insurance products aggregated by characteristics (not individual members):
  - Property, General Liability, Professional Lines, other verticals/LOBs
- Filter and segment portfolio by geography, limit bands, industry vertical, loss ratio performance, aggregation risk factors
- Select portfolio segments for capacity allocation
- Model "what-if" scenarios with projected premium, exposure, and historical loss ratio

**Sample Queries:**
- "Which members can write X class in Y geography up to $Z limit?"
- "What's our aggregate exposure to coastal property across all members?"
- "Show me authority gaps where no member can write a specific risk profile"

**Key Outputs:**
- Portfolio composition dashboards
- Capacity allocation recommendations
- Concentration and aggregation risk reports
- Authority gap analysis

---

### Component 4: Member Similarity & Onboarding Intelligence

**Objective:** Accelerate and de-risk member onboarding by comparing prospective members against the existing portfolio.

**User Personas:** Underwriters, Member Success, Risk Team

**Input:** New member's draft guidelines + proposed authority structure

**Output - Similarity Report:**

| Member | Similarity | Key Overlap(s) |
|--------|------------|----------------|
| Member A | 94% | Same COBs, similar limits, overlapping SE US geography. **SWIM LANE CONFLICT:** 89% overlap in Commercial Property, SE US, $1-5M limits |
| Member B | 87% | Similar appetite philosophy, different geography, does not have exclusions for X, Y, Z |
| Member C | 65% | Same vertical, lower limits |

**Critical Requirement:** Raw similarity scores are insufficient—underwriters need to understand *why* two members are similar. The system must provide an explanation layer that surfaces the specific factors driving similarity.

**Technical Approach:**
- Multi-modal embeddings combining text (guidelines) and structured attributes (limits, deductibles, geographies)
- Weighted composite similarity scoring with configurable weights
- Interpretable output layer explaining similarity drivers
- Integration with portfolio data for concentration analysis

**Key Outputs:**
- Similarity report for new member applications
- Swim lane conflict alerts with specific overlap details
- Onboarding risk assessment summary
- Benchmarking against comparable members

---

### Component 5: Bordereau Validation & Authority Breach Detection

**Objective:** Validate incoming bordereau transaction data against member authority to identify policies written outside permitted guidelines.

**User Personas:** Compliance, Underwriting Operations, Member Success

**Validation Checks:**
- **Territory:** Was the policy written in an approved geography?
- **Limits:** Do policy limits fall within authorized bands?
- **Deductibles:** Are deductibles within permitted ranges?
- **Class of Business:** Is the risk class within scope?
- **Eligibility:** Does the insured meet guideline eligibility criteria?
- **Referral triggers:** Should this risk have been referred?

**Breach Report Output:**
- Specific policies falling outside guidelines
- Nature of breach (which authority element was violated)
- Severity classification (minor deviation vs. material breach)
- Trend analysis (one-off vs. pattern of breaches)
- Citation to specific guideline section violated

**Integration with ADP:**
- Rules-based guidance to flag feasibility, authority constraints, or compliance considerations
- Workflow integration to surface intelligence at the point of decision

**Key Outputs:**
- Breach report by member and time period
- Breach summary dashboard (volume, severity, trends)
- Exception request queue for remediation
- Compliance audit trail

---

## Data Model

| Domain | Key Attributes |
|--------|----------------|
| **Member** | ID, name, verticals, onboarding date, performance history, status |
| **Product** | COB/LOB classification, eligible geographies, risk types, coverage forms |
| **Authority** | Limits (per-risk, aggregate), deductibles, premium bands, nat cat restrictions |
| **Terms** | Profit commission, min/max premiums, eligible operations |
| **Appetite** | Preferred classes, referral triggers, exclusions, risk tolerances |

---

## Technical Architecture

### Recommended: Hybrid Architecture

| Storage Layer | Contents |
|---------------|----------|
| **Document Store** | Original UW guidelines (PDF/Word → text), member contracts, appetite statements, endorsements and amendments |
| **Vector Index** | Chunked embeddings of guidelines, semantic search across all member docs, similarity matching on rich text (not lossy extractions) |
| **Lightweight Structured Layer** | Member metadata (name, vertical, status), key numeric fields (max limits, premium bands), classification tags (COBs, geographies) |
| **Snowflake Integration** | Premium, claims, exposure transactions mapped to products |

**Note:** Landing AI offers ADE on Snowflake, enabling document parsing and extraction directly within Snowflake. This could simplify the integration between Component 1 (extraction) and Component 2 (transaction data), keeping extracted product intelligence and performance data in a unified environment within ADP.

### Alternative: Knowledge Graph (Neo4j)

Model relationships explicitly: `(Member)-[WRITES]->(Product)-[HAS]->(Authority)-[RESTRICTED_BY]->(Exclusion)`

**Advantages:** Insurance products are fundamentally relational; graph captures this naturally. Traversal queries are intuitive.

**Tradeoff:** Requires more upfront modeling and extraction work.

### Alternative: RAG-Native (Documents as Source of Truth)

Query documents directly at runtime using LLMs without extraction.

**Advantages:** No extraction errors, handles nuance naturally, always current, provides citations.

**Tradeoff:** Slower queries, higher compute cost, harder to do portfolio-wide aggregations.

---

## Implementation Roadmap

### Phase 1: Manual Extraction + Structured Storage
- Start with 5-10 representative member contracts
- Manually extract key fields into structured format
- Validate data model assumptions
- Build initial query interface

### Phase 2: Semi-Automated Extraction
- Use LLMs to draft extractions from new documents
- Human review and correction workflow
- Build training data for future automation
- Deploy Component 5 (Bordereau Validation) with manual rules

### Phase 3: Full Automation + ML Layer
- Automated ingestion pipeline via Landing AI
- Appetite matching algorithms
- Portfolio optimization suggestions
- Similarity scoring for onboarding (Component 4)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Guideline extraction accuracy | >95% for structured fields |
| Time to onboard new member product | Reduced by 50% |
| Authority breach detection rate | >99% of material breaches caught |
| Risk Capital partner adoption | X active users within 6 months |
| Query response time (RAG interface) | <3 seconds |
| Manual effort reduction (UW/Actuarial) | 30% reduction in discovery work |

---

## Open Questions

1. What is the refresh cadence for Snowflake transaction data integration?
2. How should swim lane conflicts be surfaced—blocking vs. advisory?
3. What constitutes a "material" vs. "minor" authority breach?
4. How do we handle guideline amendments and version control?
5. Should the portfolio construction tool show projected loss ratios? What's the methodology?
6. Integration points with ADP—what rules exist today?

---

## Reference Documents

- Portfolio construction demo / Product menu construction (SharePoint)
- Guidelines extraction - Original GPT output (SharePoint)

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **COB/LOB** | Class of Business / Line of Business |
| **RORAC** | Return on Risk-Adjusted Capital |
| **Swim Lane Conflict** | Overlap in coverage authority between members that could create competition or concentration |
| **Aggregation Risk** | Concentration of exposure in correlated risks |
| **Referral Trigger** | Condition requiring underwriter review before binding |
| **ADP** | Accelerant Data Platform |
| **ARX** | Accelerant Risk Exchange |
| **Product Intelligence** | Foundational intelligence layer for Accelerant's insurance products |
| **Landing AI ADE** | Agentic Document Extraction—API platform for parsing, splitting, and extracting data from complex documents with visual grounding |
| **Visual Grounding** | Feature that links extracted data to exact page and coordinate locations in source documents |
| **ZDR** | Zero Data Retention—Landing AI security option that prevents document storage |
