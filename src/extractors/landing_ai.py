"""Landing AI ADE (Agentic Document Extraction) extractor.

Uses Landing AI's Parse, Split, and Extract APIs for document processing.
Reference: https://landing.ai/products/agentic-document-extraction
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

from src.extractors.base import BaseExtractor
from src.schema import ContractData, Authority, Terms, Appetite, ContractMetadata

logger = logging.getLogger(__name__)


class LandingAIExtractor(BaseExtractor):
    """Extract contract data using Landing AI's ADE platform.

    Landing AI ADE provides three specialized APIs:
    - Parse: Converts documents to structured Markdown/JSON
    - Split: Separates multi-document packages
    - Extract: Pulls specific fields using schema-based extraction
    """

    BASE_URL = "https://api.landing.ai/v1"  # Placeholder - update with actual endpoint

    def __init__(self, api_key: str | None = None):
        """Initialize Landing AI extractor.

        Args:
            api_key: Landing AI API key (or uses LANDING_AI_API_KEY env var)
        """
        from config.settings import LANDING_AI_API_KEY

        self.api_key = api_key or LANDING_AI_API_KEY

        if not self.api_key:
            logger.warning(
                "Landing AI API key not configured. "
                "Set LANDING_AI_API_KEY environment variable."
            )

        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        })

        # Define extraction schema for insurance contracts
        self.extraction_schema = self._build_extraction_schema()

    def _build_extraction_schema(self) -> dict:
        """Build the JSON schema for Landing AI Extract API.

        Based on PRD extraction requirements.
        """
        return {
            "type": "object",
            "properties": {
                "metadata": {
                    "type": "object",
                    "properties": {
                        "member_name": {"type": "string"},
                        "contract_effective_date": {"type": "string", "format": "date"},
                        "contract_expiration_date": {"type": "string", "format": "date"},
                    },
                },
                "authority": {
                    "type": "object",
                    "properties": {
                        "limits": {
                            "type": "object",
                            "properties": {
                                "per_risk": {"type": "number"},
                                "aggregate": {"type": "number"},
                            },
                        },
                        "deductibles": {
                            "type": "object",
                            "properties": {
                                "min": {"type": "number"},
                                "max": {"type": "number"},
                                "by_coverage": {"type": "object"},
                            },
                        },
                        "territories": {
                            "type": "object",
                            "properties": {
                                "states": {"type": "array", "items": {"type": "string"}},
                                "regions": {"type": "array", "items": {"type": "string"}},
                                "exclusions": {"type": "array", "items": {"type": "string"}},
                            },
                        },
                        "classes_of_business": {
                            "type": "object",
                            "properties": {
                                "eligible": {"type": "array", "items": {"type": "string"}},
                                "excluded": {"type": "array", "items": {"type": "string"}},
                            },
                        },
                    },
                },
                "terms": {
                    "type": "object",
                    "properties": {
                        "profit_commission": {
                            "type": "object",
                            "properties": {
                                "tiers": {"type": "array"},
                                "thresholds": {"type": "array", "items": {"type": "number"}},
                            },
                        },
                        "premium_bands": {
                            "type": "object",
                            "properties": {
                                "min": {"type": "number"},
                                "max": {"type": "number"},
                            },
                        },
                    },
                },
                "appetite": {
                    "type": "object",
                    "properties": {
                        "referral_triggers": {"type": "array", "items": {"type": "string"}},
                        "exclusions": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
        }

    def extract(
        self, document_path: str | Path, document_text: str | None = None
    ) -> ContractData:
        """Extract structured data using Landing AI ADE.

        Args:
            document_path: Path to the document
            document_text: Ignored - Landing AI processes files directly

        Returns:
            ContractData with extracted fields
        """
        path = Path(document_path)

        if not self.api_key:
            raise RuntimeError(
                "Landing AI API key not configured. "
                "Falling back to LLM extractor is recommended."
            )

        logger.info(f"Extracting with Landing AI: {path.name}")

        try:
            # Step 1: Parse document
            parsed_result = self._parse_document(path)

            # Step 2: Extract structured fields
            extraction_result = self._extract_fields(parsed_result)

            # Step 3: Convert to ContractData
            return self._convert_to_contract_data(extraction_result, path)

        except Exception as e:
            logger.error(f"Landing AI extraction failed: {e}")
            raise

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
            except Exception as e:
                logger.error(f"Failed to extract {path}: {e}")
                error_data = ContractData(
                    metadata=ContractMetadata(
                        document_source=str(path),
                        extraction_timestamp=datetime.now().isoformat(),
                    ),
                    extraction_notes=[f"Landing AI extraction failed: {str(e)}"],
                )
                results.append(error_data)
        return results

    def _parse_document(self, file_path: Path) -> dict:
        """Parse document using Landing AI Parse API.

        Args:
            file_path: Path to the document file

        Returns:
            Parsed document structure with text and layout info
        """
        # NOTE: This is a placeholder implementation
        # Replace with actual Landing AI API calls when SDK/API is available

        endpoint = f"{self.BASE_URL}/documents/parse"

        with open(file_path, "rb") as f:
            files = {"file": (file_path.name, f)}
            response = self.session.post(
                endpoint,
                files=files,
                headers={"Content-Type": None},  # Let requests set multipart
            )

        if response.status_code != 200:
            raise RuntimeError(f"Parse API failed: {response.status_code} - {response.text}")

        return response.json()

    def _extract_fields(self, parsed_document: dict) -> dict:
        """Extract structured fields using Landing AI Extract API.

        Args:
            parsed_document: Output from Parse API

        Returns:
            Extracted fields matching the schema
        """
        endpoint = f"{self.BASE_URL}/documents/extract"

        payload = {
            "document": parsed_document,
            "schema": self.extraction_schema,
        }

        response = self.session.post(endpoint, json=payload)

        if response.status_code != 200:
            raise RuntimeError(f"Extract API failed: {response.status_code} - {response.text}")

        return response.json()

    def _convert_to_contract_data(
        self, extraction: dict, source_path: Path
    ) -> ContractData:
        """Convert Landing AI extraction to ContractData model.

        Args:
            extraction: Raw extraction from Landing AI
            source_path: Path to source document

        Returns:
            Validated ContractData object
        """
        # Extract nested structures
        metadata_raw = extraction.get("metadata", {})
        authority_raw = extraction.get("authority", {})
        terms_raw = extraction.get("terms", {})
        appetite_raw = extraction.get("appetite", {})

        # Build metadata
        metadata = ContractMetadata(
            member_name=metadata_raw.get("member_name"),
            contract_effective_date=self._parse_date(
                metadata_raw.get("contract_effective_date")
            ),
            contract_expiration_date=self._parse_date(
                metadata_raw.get("contract_expiration_date")
            ),
            document_source=str(source_path),
            extraction_timestamp=datetime.now().isoformat(),
            extraction_confidence=extraction.get("confidence"),
        )

        # Build authority
        limits = authority_raw.get("limits", {})
        deductibles = authority_raw.get("deductibles", {})
        territories = authority_raw.get("territories", {})
        cob = authority_raw.get("classes_of_business", {})

        authority = Authority(
            limits_per_risk=limits.get("per_risk"),
            limits_aggregate=limits.get("aggregate"),
            deductibles_min=deductibles.get("min"),
            deductibles_max=deductibles.get("max"),
            deductibles_by_coverage=deductibles.get("by_coverage", {}),
            territories_states=territories.get("states", []),
            territories_regions=territories.get("regions", []),
            territories_exclusions=territories.get("exclusions", []),
            classes_of_business_eligible=cob.get("eligible", []),
            classes_of_business_excluded=cob.get("excluded", []),
        )

        # Build terms
        profit_commission = terms_raw.get("profit_commission", {})
        premium_bands = terms_raw.get("premium_bands", {})

        terms = Terms(
            profit_commission_thresholds=profit_commission.get("thresholds", []),
            premium_bands_min=premium_bands.get("min"),
            premium_bands_max=premium_bands.get("max"),
        )

        # Build appetite
        appetite = Appetite(
            referral_triggers=appetite_raw.get("referral_triggers", []),
            exclusions=appetite_raw.get("exclusions", []),
        )

        # Include visual grounding references if available
        notes = []
        if "grounding" in extraction:
            notes.append(f"Visual grounding available: {len(extraction['grounding'])} references")

        return ContractData(
            metadata=metadata,
            authority=authority,
            terms=terms,
            appetite=appetite,
            extraction_notes=notes,
        )

    def _parse_date(self, value) -> datetime | None:
        """Parse date string to date object."""
        if not value:
            return None
        try:
            from datetime import datetime

            if isinstance(value, str):
                for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"]:
                    try:
                        return datetime.strptime(value, fmt).date()
                    except ValueError:
                        continue
        except Exception:
            pass
        return None


# Factory function to create appropriate extractor
def get_extractor(backend: str = "llm", **kwargs) -> BaseExtractor:
    """Factory function to create the appropriate extractor.

    Args:
        backend: "llm" or "landing_ai"
        **kwargs: Additional arguments passed to extractor

    Returns:
        BaseExtractor instance
    """
    from config.settings import DEFAULT_EXTRACTOR

    backend = backend or DEFAULT_EXTRACTOR

    if backend == "landing_ai":
        return LandingAIExtractor(**kwargs)
    else:
        from src.extractors.llm_extractor import LLMExtractor
        return LLMExtractor(**kwargs)
