"""System Prompts API routes."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.models.member import SystemPrompt
from backend.schemas.member import (
    SystemPromptResponse,
    SystemPromptListResponse,
    SystemPromptUpdate,
)

router = APIRouter()

# =============================================================================
# DEFAULT PROMPTS DEFINITIONS
# =============================================================================

DEFAULT_PROMPTS = {
    "contract_extraction_system": {
        "display_name": "Contract Extraction - System",
        "description": "System prompt for extracting structured data from insurance contracts and guidelines.",
        "prompt_content": """You are an expert insurance underwriting guidelines analyst. Your task is to extract structured data from insurance underwriting guidelines, contracts, and related documents.

Extract information accurately and completely. If a field is not found in the document, return null for that field. Do not make assumptions or infer values that are not explicitly stated.

For list fields, extract all relevant items mentioned in the document.
For numeric fields, extract the value without currency symbols or commas.
For state lists, use standard 2-letter state abbreviations (e.g., CA, TX, FL).

Return the extracted data as valid JSON matching the provided schema.""",
    },
    "contract_extraction_user": {
        "display_name": "Contract Extraction - User",
        "description": "User prompt template for contract extraction. Uses {document_text} placeholder.",
        "prompt_content": """Please extract the following structured data from this insurance underwriting guidelines document.

IMPORTANT: For each field you extract, you MUST also provide the exact source text from the document where you found this information. This is critical for audit and verification purposes.

## Document Content:
{document_text}

## Required Fields:
Extract the following information and return as JSON. For EACH field, provide both the extracted value AND the source citation.

The JSON format should be:
{{
  "field_name": <extracted value>,
  "citations": {{
    "field_name": "exact text snippet from document where this value was found"
  }}
}}

### Fields to Extract:

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

Return ONLY valid JSON. Use null for fields not found in the document. For lists, return empty array [] if no items found.
The "citations" object should contain the exact text snippets from the document for each extracted field. Keep citations concise (under 200 characters) but include enough context to locate the source.""",
    },
    "term_mapping_system": {
        "display_name": "Term Mapping - System",
        "description": "System prompt for suggesting field-to-product mappings.",
        "prompt_content": """You are an expert insurance underwriter assistant. Your task is to suggest mappings between extracted contract fields and product combinations.

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

Only suggest mappings where there's a clear logical connection. Don't force mappings for unrelated fields.""",
    },
    "product_suggestion_system": {
        "display_name": "Product Suggestion - System",
        "description": "System prompt for suggesting which products a contract applies to.",
        "prompt_content": """You are an expert insurance underwriter assistant. Your task is to determine which product combinations a contract applies to.

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

Only suggest products where there's clear evidence the contract applies to them.""",
    },
    "product_extraction_system": {
        "display_name": "Product Extraction - System",
        "description": "System prompt for AI analysis of contract-product links. Uses {field_count} and {field_names} placeholders.",
        "prompt_content": """You are an expert insurance contract analyst. Your task is to enrich extracted contract data with citations and relevance scores for a specific product combination.

CRITICAL REQUIREMENT: The input contains exactly {field_count} fields. Your response MUST contain exactly {field_count} fields in extracted_data. Do NOT omit ANY fields.

The fields you MUST include are: {field_names}

For EACH of the {field_count} fields:
1. Copy the original value EXACTLY as provided
2. Add a citation (exact text snippet from the contract) - use "No direct citation found" if none exists
3. Add relevance_score (0-1) for this specific product combination
4. Add brief reasoning

Return a JSON object with:
- extracted_data: Object with ALL {field_count} fields, each having {{value, citation, relevance_score, reasoning}}
- analysis_summary: Brief explanation
- confidence_score: Overall confidence (0-1)

WARNING: Responses with fewer than {field_count} fields will be rejected. Include ALL fields regardless of relevance.""",
    },
}


def get_prompt_content(db: Session, prompt_key: str) -> str:
    """Get prompt content - custom if exists, otherwise default."""
    custom = db.query(SystemPrompt).filter(SystemPrompt.prompt_key == prompt_key).first()
    if custom:
        return custom.prompt_content
    if prompt_key in DEFAULT_PROMPTS:
        return DEFAULT_PROMPTS[prompt_key]["prompt_content"]
    raise ValueError(f"Unknown prompt key: {prompt_key}")


# =============================================================================
# API ENDPOINTS
# =============================================================================

@router.get("/", response_model=SystemPromptListResponse)
def list_prompts(db: Session = Depends(get_db)):
    """List all system prompts (custom + defaults)."""
    # Get all custom prompts from DB
    custom_prompts = {p.prompt_key: p for p in db.query(SystemPrompt).all()}

    prompts = []

    # Build response with defaults + any custom overrides
    for key, default_data in DEFAULT_PROMPTS.items():
        if key in custom_prompts:
            # Custom override exists
            custom = custom_prompts[key]
            prompts.append(SystemPromptResponse(
                id=custom.id,
                prompt_key=custom.prompt_key,
                display_name=custom.display_name or default_data["display_name"],
                description=custom.description or default_data["description"],
                prompt_content=custom.prompt_content,
                is_custom=True,
                created_at=custom.created_at,
                updated_at=custom.updated_at,
            ))
        else:
            # Use default
            prompts.append(SystemPromptResponse(
                id=f"default-{key}",
                prompt_key=key,
                display_name=default_data["display_name"],
                description=default_data["description"],
                prompt_content=default_data["prompt_content"],
                is_custom=False,
                created_at=datetime.utcnow(),
                updated_at=None,
            ))

    return SystemPromptListResponse(prompts=prompts, total=len(prompts))


@router.get("/{prompt_key}", response_model=SystemPromptResponse)
def get_prompt(prompt_key: str, db: Session = Depends(get_db)):
    """Get a specific system prompt."""
    # Check for custom override
    custom = db.query(SystemPrompt).filter(SystemPrompt.prompt_key == prompt_key).first()

    if custom:
        default_data = DEFAULT_PROMPTS.get(prompt_key, {})
        return SystemPromptResponse(
            id=custom.id,
            prompt_key=custom.prompt_key,
            display_name=custom.display_name or default_data.get("display_name", prompt_key),
            description=custom.description or default_data.get("description"),
            prompt_content=custom.prompt_content,
            is_custom=True,
            created_at=custom.created_at,
            updated_at=custom.updated_at,
        )

    # Use default
    if prompt_key in DEFAULT_PROMPTS:
        default_data = DEFAULT_PROMPTS[prompt_key]
        return SystemPromptResponse(
            id=f"default-{prompt_key}",
            prompt_key=prompt_key,
            display_name=default_data["display_name"],
            description=default_data["description"],
            prompt_content=default_data["prompt_content"],
            is_custom=False,
            created_at=datetime.utcnow(),
            updated_at=None,
        )

    raise HTTPException(status_code=404, detail=f"Prompt not found: {prompt_key}")


@router.put("/{prompt_key}", response_model=SystemPromptResponse)
def update_prompt(prompt_key: str, update: SystemPromptUpdate, db: Session = Depends(get_db)):
    """Update or create a custom prompt override."""
    if prompt_key not in DEFAULT_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown prompt key: {prompt_key}")

    default_data = DEFAULT_PROMPTS[prompt_key]

    # Check for existing custom prompt
    custom = db.query(SystemPrompt).filter(SystemPrompt.prompt_key == prompt_key).first()

    if custom:
        # Update existing
        custom.prompt_content = update.prompt_content
        custom.updated_at = datetime.utcnow()
    else:
        # Create new custom override
        custom = SystemPrompt(
            prompt_key=prompt_key,
            display_name=default_data["display_name"],
            description=default_data["description"],
            prompt_content=update.prompt_content,
            is_custom=True,
        )
        db.add(custom)

    db.commit()
    db.refresh(custom)

    return SystemPromptResponse(
        id=custom.id,
        prompt_key=custom.prompt_key,
        display_name=custom.display_name or default_data["display_name"],
        description=custom.description or default_data["description"],
        prompt_content=custom.prompt_content,
        is_custom=True,
        created_at=custom.created_at,
        updated_at=custom.updated_at,
    )


@router.post("/{prompt_key}/reset", response_model=SystemPromptResponse)
def reset_prompt(prompt_key: str, db: Session = Depends(get_db)):
    """Reset a prompt to its default value by deleting the custom override."""
    if prompt_key not in DEFAULT_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown prompt key: {prompt_key}")

    # Delete custom override if exists
    custom = db.query(SystemPrompt).filter(SystemPrompt.prompt_key == prompt_key).first()
    if custom:
        db.delete(custom)
        db.commit()

    # Return default
    default_data = DEFAULT_PROMPTS[prompt_key]
    return SystemPromptResponse(
        id=f"default-{prompt_key}",
        prompt_key=prompt_key,
        display_name=default_data["display_name"],
        description=default_data["description"],
        prompt_content=default_data["prompt_content"],
        is_custom=False,
        created_at=datetime.utcnow(),
        updated_at=None,
    )


@router.get("/{prompt_key}/default")
def get_default_prompt(prompt_key: str):
    """Get the default prompt content for comparison."""
    if prompt_key not in DEFAULT_PROMPTS:
        raise HTTPException(status_code=404, detail=f"Unknown prompt key: {prompt_key}")

    return {
        "prompt_key": prompt_key,
        "default_content": DEFAULT_PROMPTS[prompt_key]["prompt_content"],
    }
