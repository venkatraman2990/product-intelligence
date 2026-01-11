"""LLM-based extractor using Claude or OpenAI for contract data extraction."""

import json
import logging
from datetime import datetime
from pathlib import Path

from src.extractors.base import BaseExtractor
from src.extractors.document_loader import DocumentLoader
from src.schema import (
    ContractData,
    Metadata,
    Territory,
    TargetMarket,
    LimitsDeductibles,
    PremiumRequirements,
    UnderwritingRequirements,
    Restrictions,
    PolicyTerms,
)

logger = logging.getLogger(__name__)


class LLMExtractor(BaseExtractor):
    """Extract contract data using LLM (Claude or OpenAI).

    Uses structured prompts to extract insurance contract fields
    and returns validated Pydantic models.
    """

    def __init__(
        self,
        provider: str = "anthropic",
        model: str | None = None,
        api_key: str | None = None,
    ):
        """Initialize the LLM extractor.

        Args:
            provider: LLM provider - "anthropic" or "openai"
            model: Model name (defaults to claude-opus-4-20250514 or gpt-4o)
            api_key: API key (or uses environment variable)
        """
        self.provider = provider.lower()
        self.document_loader = DocumentLoader()

        if self.provider == "anthropic":
            self._init_anthropic(model, api_key)
        elif self.provider == "openai":
            self._init_openai(model, api_key)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    def _init_anthropic(self, model: str | None, api_key: str | None):
        """Initialize Anthropic client."""
        try:
            import anthropic
        except ImportError:
            raise RuntimeError(
                "anthropic package required. Install with: pip install anthropic"
            )

        from config.settings import ANTHROPIC_API_KEY, LLM_MODEL

        self.client = anthropic.Anthropic(api_key=api_key or ANTHROPIC_API_KEY)
        self.model = model or LLM_MODEL
        logger.info(f"Initialized Anthropic extractor with model: {self.model}")

    def _init_openai(self, model: str | None, api_key: str | None):
        """Initialize OpenAI client."""
        try:
            import openai
        except ImportError:
            raise RuntimeError(
                "openai package required. Install with: pip install openai"
            )

        from config.settings import OPENAI_API_KEY

        self.client = openai.OpenAI(api_key=api_key or OPENAI_API_KEY)
        self.model = model or "gpt-4o"
        logger.info(f"Initialized OpenAI extractor with model: {self.model}")

    def extract(
        self, document_path: str | Path, document_text: str | None = None
    ) -> ContractData:
        """Extract structured data from a contract document.

        Args:
            document_path: Path to the document
            document_text: Optional pre-extracted text

        Returns:
            ContractData with extracted fields
        """
        path = Path(document_path)

        # Load document if text not provided
        if document_text is None:
            loaded_doc = self.document_loader.load(path)
            document_text = loaded_doc.text

        logger.info(f"Extracting from document: {path.name} ({len(document_text)} chars)")

        # Call LLM for extraction
        extraction_result = self._call_llm(document_text)

        # Parse and validate result
        contract_data = self._parse_extraction(extraction_result, path)

        return contract_data

    def extract_batch(self, document_paths: list[str | Path]) -> list[ContractData]:
        """Extract data from multiple documents.

        Args:
            document_paths: List of document paths

        Returns:
            List of ContractData objects
        """
        results = []
        for path in document_paths:
            try:
                result = self.extract(path)
                results.append(result)
                logger.info(f"Successfully extracted: {path}")
            except Exception as e:
                logger.error(f"Failed to extract {path}: {e}")
                # Create error record
                error_data = ContractData(
                    metadata=Metadata(
                        document_source=str(path),
                        extraction_timestamp=datetime.now().isoformat(),
                    ),
                    extraction_notes=[f"Extraction failed: {str(e)}"],
                )
                results.append(error_data)
        return results

    def _call_llm(self, document_text: str) -> dict:
        """Call the LLM to extract structured data.

        Args:
            document_text: Text content of the document

        Returns:
            Parsed JSON extraction result
        """
        from config.settings import (
            EXTRACTION_SYSTEM_PROMPT,
            EXTRACTION_USER_PROMPT,
            LLM_MAX_TOKENS,
        )

        # Truncate very long documents
        max_chars = 80000
        if len(document_text) > max_chars:
            document_text = document_text[:max_chars] + "\n\n[Document truncated...]"

        user_prompt = EXTRACTION_USER_PROMPT.format(document_text=document_text)

        if self.provider == "anthropic":
            response = self.client.messages.create(
                model=self.model,
                max_tokens=LLM_MAX_TOKENS,
                system=EXTRACTION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
            response_text = response.content[0].text
        else:  # openai
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=LLM_MAX_TOKENS,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            response_text = response.choices[0].message.content

        # Parse JSON from response
        return self._parse_json_response(response_text)

    def _parse_json_response(self, response_text: str) -> dict:
        """Parse JSON from LLM response, handling markdown code blocks.

        Args:
            response_text: Raw response from LLM

        Returns:
            Parsed dictionary
        """
        text = response_text.strip()

        # Remove markdown code blocks if present
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]

        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Response text: {text[:500]}...")
            return {}

    def _parse_extraction(self, extraction: dict, source_path: Path) -> ContractData:
        """Convert raw extraction dict to ContractData model.

        Args:
            extraction: Raw extraction dictionary from LLM
            source_path: Path to source document

        Returns:
            Validated ContractData object
        """
        notes = []

        # Handle both flat and nested JSON structures
        # Check for nested "metadata" key or flat structure
        meta_data = extraction.get("metadata", extraction)
        territory_data = extraction.get("territory", extraction)
        target_data = extraction.get("target_market", extraction)
        limits_data = extraction.get("limits_deductibles", extraction)
        premium_data = extraction.get("premium_requirements", extraction)
        uw_data = extraction.get("underwriting_requirements", extraction)
        restrict_data = extraction.get("restrictions", extraction)
        policy_data = extraction.get("policy_terms", extraction)

        # Parse metadata
        metadata = Metadata(
            member_name=meta_data.get("member_name") or extraction.get("member_name"),
            product_name=meta_data.get("product_name") or extraction.get("product_name"),
            product_description=meta_data.get("product_description") or extraction.get("product_description"),
            effective_date=self._parse_date(meta_data.get("effective_date") or extraction.get("effective_date")),
            expiration_date=self._parse_date(meta_data.get("expiration_date") or extraction.get("expiration_date")),
            document_source=str(source_path),
            extraction_timestamp=datetime.now().isoformat(),
            accelerant_agency=self._safe_string(meta_data.get("accelerant_agency") or extraction.get("accelerant_agency")),
            carrier=self._safe_string(meta_data.get("carrier") or extraction.get("carrier")),
            insurer_branch=self._safe_string(meta_data.get("insurer_branch") or extraction.get("insurer_branch")),
        )

        # Parse territory (use nested data or fall back to flat)
        territory = Territory(
            permitted_states=self._safe_list(territory_data.get("permitted_states") or extraction.get("permitted_states")),
            excluded_states=self._safe_list(territory_data.get("excluded_states") or extraction.get("excluded_states")),
            admitted_status=self._safe_string(territory_data.get("admitted_status") or extraction.get("admitted_status")),
        )

        # Parse target market (use nested data or fall back to flat)
        target_market = TargetMarket(
            target_classes=self._safe_list(target_data.get("target_classes") or extraction.get("target_classes")),
            eligible_classes=self._safe_list(target_data.get("eligible_classes") or extraction.get("eligible_classes")),
            excluded_classes=self._safe_list(target_data.get("excluded_classes") or extraction.get("excluded_classes")),
            target_operations=self._safe_list(target_data.get("target_operations") or extraction.get("target_operations")),
            eligible_operations=self._safe_list(target_data.get("eligible_operations") or extraction.get("eligible_operations")),
            ineligible_operations=self._safe_list(target_data.get("ineligible_operations") or extraction.get("ineligible_operations")),
        )

        # Parse limits & deductibles (use nested data or fall back to flat)
        # Handle max_limits_of_liability as string
        max_lol = limits_data.get("max_limits_of_liability") or extraction.get("max_limits_of_liability")
        if max_lol is not None and not isinstance(max_lol, str):
            max_lol = str(max_lol)

        limits_deductibles = LimitsDeductibles(
            max_policy_limit=self._safe_float(limits_data.get("max_policy_limit") or extraction.get("max_policy_limit")),
            max_location_limit=self._safe_float(limits_data.get("max_location_limit") or extraction.get("max_location_limit")),
            max_limits_of_liability=max_lol,
            deductible_options=self._safe_list(limits_data.get("deductible_options") or extraction.get("deductible_options")),
            deductible_min=self._safe_float(limits_data.get("deductible_min") or extraction.get("deductible_min")),
            deductible_max=self._safe_float(limits_data.get("deductible_max") or extraction.get("deductible_max")),
        )

        # Parse premium requirements (use nested data or fall back to flat)
        premium_requirements = PremiumRequirements(
            max_annual_premium=self._safe_float(premium_data.get("max_annual_premium") or extraction.get("max_annual_premium")),
            max_premium_per_insured=self._safe_float(premium_data.get("max_premium_per_insured") or extraction.get("max_premium_per_insured")),
            min_premium_per_insured=self._safe_float(premium_data.get("min_premium_per_insured") or extraction.get("min_premium_per_insured")),
            max_revenue_per_insured=self._safe_float(premium_data.get("max_revenue_per_insured") or extraction.get("max_revenue_per_insured")),
            max_tiv_per_insured=self._safe_float(premium_data.get("max_tiv_per_insured") or extraction.get("max_tiv_per_insured")),
            max_locations_per_insured=self._safe_int(premium_data.get("max_locations_per_insured") or extraction.get("max_locations_per_insured")),
            commission_rate=self._safe_string(premium_data.get("commission_rate") or extraction.get("commission_rate")),
            premium_cap_basis=self._safe_string(premium_data.get("premium_cap_basis") or extraction.get("premium_cap_basis")),
            minimum_earned_premium=self._safe_string(premium_data.get("minimum_earned_premium") or extraction.get("minimum_earned_premium")),
        )

        # Parse underwriting requirements (use nested data or fall back to flat)
        underwriting_requirements = UnderwritingRequirements(
            eligibility_rules=self._safe_list(uw_data.get("eligibility_rules") or extraction.get("eligibility_rules")),
            years_in_business_requirement=self._safe_string(uw_data.get("years_in_business_requirement") or extraction.get("years_in_business_requirement")),
            loss_run_requirements=self._safe_string(uw_data.get("loss_run_requirements") or extraction.get("loss_run_requirements")),
            max_historical_claims=self._safe_string(uw_data.get("max_historical_claims") or extraction.get("max_historical_claims")),
            inspection_requirements=self._safe_string(uw_data.get("inspection_requirements") or extraction.get("inspection_requirements")),
            underwriting_file_requirements=self._safe_list(uw_data.get("underwriting_file_requirements") or extraction.get("underwriting_file_requirements")),
            risk_scoring_parameters=self._safe_string(uw_data.get("risk_scoring_parameters") or extraction.get("risk_scoring_parameters")),
        )

        # Parse restrictions (use nested data or fall back to flat)
        restrictions = Restrictions(
            referral_triggers=self._safe_list(restrict_data.get("referral_triggers") or extraction.get("referral_triggers")),
            nat_cat_restrictions=self._safe_string(restrict_data.get("nat_cat_restrictions") or extraction.get("nat_cat_restrictions")),
            required_form_exclusions=self._safe_list(restrict_data.get("required_form_exclusions") or extraction.get("required_form_exclusions")),
            exclusions=self._safe_list(restrict_data.get("exclusions") or extraction.get("exclusions")),
        )

        # Parse policy terms (use nested data or fall back to flat)
        policy_terms = PolicyTerms(
            rating_basis=self._safe_string(policy_data.get("rating_basis") or extraction.get("rating_basis")),
            max_policy_period=self._safe_string(policy_data.get("max_policy_period") or extraction.get("max_policy_period")),
            cancellation_provisions=self._safe_string(policy_data.get("cancellation_provisions") or extraction.get("cancellation_provisions")),
            underwriting_year_start=self._safe_string(policy_data.get("underwriting_year_start") or extraction.get("underwriting_year_start")),
            underwriting_year_end=self._safe_string(policy_data.get("underwriting_year_end") or extraction.get("underwriting_year_end")),
        )

        # Extract citations from response
        citations = extraction.get("citations", {})
        if not isinstance(citations, dict):
            citations = {}
        # Filter out None values - some models return null for missing citations
        citations = {k: v for k, v in citations.items() if v is not None and isinstance(v, str)}

        return ContractData(
            metadata=metadata,
            territory=territory,
            target_market=target_market,
            limits_deductibles=limits_deductibles,
            premium_requirements=premium_requirements,
            underwriting_requirements=underwriting_requirements,
            restrictions=restrictions,
            policy_terms=policy_terms,
            extraction_notes=notes,
            citations=citations,
        )

    def _parse_date(self, value) -> datetime | None:
        """Parse a date string to date object."""
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        try:
            from datetime import date

            if isinstance(value, str):
                # Try common formats
                for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y", "%m-%d-%Y"]:
                    try:
                        return datetime.strptime(value, fmt).date()
                    except ValueError:
                        continue
        except Exception:
            pass
        return None

    def _safe_float(self, value) -> float | None:
        """Safely convert value to float."""
        if value is None:
            return None
        try:
            # Handle string numbers with commas or currency symbols
            if isinstance(value, str):
                value = value.replace(",", "").replace("$", "").replace("M", "000000").replace("K", "000").strip()
                # Handle "X million" format
                if "million" in value.lower():
                    value = value.lower().replace("million", "").strip()
                    return float(value) * 1000000
            return float(value)
        except (ValueError, TypeError):
            return None

    def _safe_int(self, value) -> int | None:
        """Safely convert value to int."""
        if value is None:
            return None
        try:
            if isinstance(value, str):
                value = value.replace(",", "").strip()
            return int(float(value))
        except (ValueError, TypeError):
            return None

    def _safe_list(self, value, item_type=str) -> list:
        """Safely convert value to list."""
        if value is None:
            return []
        if isinstance(value, list):
            return [str(x) if x is not None else "" for x in value]
        if isinstance(value, str):
            # Split on common delimiters
            items = [x.strip() for x in value.replace(";", ",").split(",")]
            return [x for x in items if x]
        return []

    def _safe_string(self, value) -> str | None:
        """Safely convert value to string."""
        if value is None:
            return None
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            # Join list items into a string
            return "; ".join(str(x) for x in value if x is not None)
        # Convert any other type to string
        return str(value)
