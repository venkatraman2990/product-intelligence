"""Configuration settings for Product Intelligence"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
INPUT_DIR = DATA_DIR / "input"
OUTPUT_DIR = DATA_DIR / "output"

# API Keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LANDING_AI_API_KEY = os.getenv("LANDING_AI_API_KEY")

# Default extractor backend
DEFAULT_EXTRACTOR = os.getenv("DEFAULT_EXTRACTOR", "llm")

# LLM Settings
LLM_MODEL = "claude-opus-4-20250514"  # Claude Opus 4 for high-quality extraction
LLM_MAX_TOKENS = 8192

# Extraction prompt templates
EXTRACTION_SYSTEM_PROMPT = """You are an expert insurance underwriting guidelines analyst. Your task is to extract structured data from insurance underwriting guidelines, contracts, and related documents.

Extract information accurately and completely. If a field is not found in the document, return null for that field. Do not make assumptions or infer values that are not explicitly stated.

For list fields, extract all relevant items mentioned in the document.
For numeric fields, extract the value without currency symbols or commas.
For state lists, use standard 2-letter state abbreviations (e.g., CA, TX, FL).

Return the extracted data as valid JSON matching the provided schema."""

EXTRACTION_USER_PROMPT = """Please extract the following structured data from this insurance underwriting guidelines document:

## Document Content:
{document_text}

## Required Fields:
Extract the following information and return as JSON:

1. **Metadata**:
   - member_name: Name of the member/MGA/company (look for company name in header or title)
   - product_name: Marketing name of the product/program
   - product_description: Brief description of what the product covers
   - effective_date: Guidelines effective date (YYYY-MM-DD format)

2. **Territory & Eligibility**:
   - permitted_states: List of US states where coverage is available (use 2-letter codes)
   - excluded_states: List of US states explicitly excluded
   - admitted_status: "Admitted", "Non-Admitted", or "Both"

3. **Target Market**:
   - target_classes: List of target/preferred classes of business
   - eligible_classes: List of all eligible classes of business
   - excluded_classes: List of excluded/ineligible classes
   - target_operations: List of target operations/industries
   - eligible_operations: List of eligible operations
   - ineligible_operations: List of ineligible/excluded operations

4. **Limits & Deductibles**:
   - max_policy_limit: Maximum policy limit (number)
   - max_location_limit: Maximum per-location limit (number)
   - max_limits_of_liability: Maximum limits of liability (number or description)
   - deductible_options: List of available deductible options/ranges
   - deductible_min: Minimum deductible (number)
   - deductible_max: Maximum deductible (number)

5. **Premium & Insured Requirements**:
   - max_annual_premium: Maximum annual premium limit (number)
   - max_premium_per_insured: Maximum premium per insured (number)
   - min_premium_per_insured: Minimum premium per insured (number)
   - max_revenue_per_insured: Maximum revenue/receipts per insured (number)
   - max_tiv_per_insured: Maximum Total Insured Value per insured (number)
   - max_locations_per_insured: Maximum number of locations per insured (number)

6. **Underwriting Requirements**:
   - eligibility_rules: List of eligibility requirements/rules
   - years_in_business_requirement: Minimum years in business required
   - loss_run_requirements: Loss run requirements (years, format)
   - max_historical_claims: Maximum number of historical claims allowed
   - inspection_requirements: Inspection requirements
   - underwriting_file_requirements: List of required underwriting documents
   - risk_scoring_parameters: Risk scoring criteria if mentioned

7. **Restrictions & Referrals**:
   - referral_triggers: List of conditions requiring referral to underwriter
   - nat_cat_restrictions: Natural catastrophe restrictions (wind, earthquake, flood, etc.)
   - required_form_exclusions: Required form exclusions
   - exclusions: General exclusions list

8. **Policy Terms**:
   - rating_basis: Rating basis (e.g., revenue, payroll, square footage)
   - max_policy_period: Maximum policy period
   - cancellation_provisions: Policy cancellation provisions

Return ONLY valid JSON with these fields. Use null for fields not found in the document. For lists, return empty array [] if no items found."""

# Snowflake settings (Phase 2)
SNOWFLAKE_ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT")
SNOWFLAKE_USER = os.getenv("SNOWFLAKE_USER")
SNOWFLAKE_PASSWORD = os.getenv("SNOWFLAKE_PASSWORD")
SNOWFLAKE_DATABASE = os.getenv("SNOWFLAKE_DATABASE")
SNOWFLAKE_SCHEMA = os.getenv("SNOWFLAKE_SCHEMA", "product_intelligence")
SNOWFLAKE_WAREHOUSE = os.getenv("SNOWFLAKE_WAREHOUSE")
