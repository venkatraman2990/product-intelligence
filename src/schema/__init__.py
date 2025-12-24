"""Schema package - Pydantic models for contract data"""

from .contract_schema import (
    ContractData,
    Metadata,
    Territory,
    TargetMarket,
    LimitsDeductibles,
    PremiumRequirements,
    UnderwritingRequirements,
    Restrictions,
    PolicyTerms,
    # Legacy aliases
    Authority,
    Terms,
    Appetite,
    ContractMetadata,
)

__all__ = [
    "ContractData",
    "Metadata",
    "Territory",
    "TargetMarket",
    "LimitsDeductibles",
    "PremiumRequirements",
    "UnderwritingRequirements",
    "Restrictions",
    "PolicyTerms",
    "Authority",
    "Terms",
    "Appetite",
    "ContractMetadata",
]
