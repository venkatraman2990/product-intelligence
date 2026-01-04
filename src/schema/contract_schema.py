"""Pydantic models for insurance contract/guidelines data extraction.

Based on Product Menu Reqs v1.xlsx field requirements.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class Metadata(BaseModel):
    """Metadata about the document and extraction."""

    member_name: Optional[str] = Field(
        None, description="Name of the member/MGA/company"
    )
    product_name: Optional[str] = Field(
        None, description="Marketing name of the product/program"
    )
    product_description: Optional[str] = Field(
        None, description="Brief description of what the product covers"
    )
    effective_date: Optional[date] = Field(
        None, description="Guidelines effective date"
    )
    document_source: Optional[str] = Field(
        None, description="Source document path"
    )
    extraction_timestamp: Optional[str] = Field(
        None, description="When extraction was performed"
    )


class Territory(BaseModel):
    """Territory and eligibility information."""

    permitted_states: list[str] = Field(
        default_factory=list,
        description="List of US states where coverage is available"
    )
    excluded_states: list[str] = Field(
        default_factory=list,
        description="List of US states explicitly excluded"
    )
    admitted_status: Optional[str] = Field(
        None, description="Admitted, Non-Admitted, or Both"
    )


class TargetMarket(BaseModel):
    """Target market and class information."""

    target_classes: list[str] = Field(
        default_factory=list,
        description="List of target/preferred classes of business"
    )
    eligible_classes: list[str] = Field(
        default_factory=list,
        description="List of all eligible classes of business"
    )
    excluded_classes: list[str] = Field(
        default_factory=list,
        description="List of excluded/ineligible classes"
    )
    target_operations: list[str] = Field(
        default_factory=list,
        description="List of target operations/industries"
    )
    eligible_operations: list[str] = Field(
        default_factory=list,
        description="List of eligible operations"
    )
    ineligible_operations: list[str] = Field(
        default_factory=list,
        description="List of ineligible/excluded operations"
    )


class LimitsDeductibles(BaseModel):
    """Limits and deductibles information."""

    max_policy_limit: Optional[float] = Field(
        None, description="Maximum policy limit"
    )
    max_location_limit: Optional[float] = Field(
        None, description="Maximum per-location limit"
    )
    max_limits_of_liability: Optional[str] = Field(
        None, description="Maximum limits of liability"
    )
    deductible_options: list[str] = Field(
        default_factory=list,
        description="List of available deductible options/ranges"
    )
    deductible_min: Optional[float] = Field(
        None, description="Minimum deductible"
    )
    deductible_max: Optional[float] = Field(
        None, description="Maximum deductible"
    )


class PremiumRequirements(BaseModel):
    """Premium and insured requirements."""

    max_annual_premium: Optional[float] = Field(
        None, description="Maximum annual premium limit"
    )
    max_premium_per_insured: Optional[float] = Field(
        None, description="Maximum premium per insured"
    )
    min_premium_per_insured: Optional[float] = Field(
        None, description="Minimum premium per insured"
    )
    max_revenue_per_insured: Optional[float] = Field(
        None, description="Maximum revenue/receipts per insured"
    )
    max_tiv_per_insured: Optional[float] = Field(
        None, description="Maximum Total Insured Value per insured"
    )
    max_locations_per_insured: Optional[int] = Field(
        None, description="Maximum number of locations per insured"
    )


class UnderwritingRequirements(BaseModel):
    """Underwriting requirements and rules."""

    eligibility_rules: list[str] = Field(
        default_factory=list,
        description="List of eligibility requirements/rules"
    )
    years_in_business_requirement: Optional[str] = Field(
        None, description="Minimum years in business required"
    )
    loss_run_requirements: Optional[str] = Field(
        None, description="Loss run requirements"
    )
    max_historical_claims: Optional[str] = Field(
        None, description="Maximum number of historical claims allowed"
    )
    inspection_requirements: Optional[str] = Field(
        None, description="Inspection requirements"
    )
    underwriting_file_requirements: list[str] = Field(
        default_factory=list,
        description="List of required underwriting documents"
    )
    risk_scoring_parameters: Optional[str] = Field(
        None, description="Risk scoring criteria"
    )


class Restrictions(BaseModel):
    """Restrictions and referral triggers."""

    referral_triggers: list[str] = Field(
        default_factory=list,
        description="List of conditions requiring referral"
    )
    nat_cat_restrictions: Optional[str] = Field(
        None, description="Natural catastrophe restrictions"
    )
    required_form_exclusions: list[str] = Field(
        default_factory=list,
        description="Required form exclusions"
    )
    exclusions: list[str] = Field(
        default_factory=list,
        description="General exclusions list"
    )


class PolicyTerms(BaseModel):
    """Policy terms and conditions."""

    rating_basis: Optional[str] = Field(
        None, description="Rating basis (e.g., revenue, payroll)"
    )
    max_policy_period: Optional[str] = Field(
        None, description="Maximum policy period"
    )
    cancellation_provisions: Optional[str] = Field(
        None, description="Policy cancellation provisions"
    )


class ContractData(BaseModel):
    """Complete extracted contract/guidelines data."""

    metadata: Metadata = Field(
        default_factory=Metadata,
        description="Document and extraction metadata"
    )
    territory: Territory = Field(
        default_factory=Territory,
        description="Territory and eligibility"
    )
    target_market: TargetMarket = Field(
        default_factory=TargetMarket,
        description="Target market and classes"
    )
    limits_deductibles: LimitsDeductibles = Field(
        default_factory=LimitsDeductibles,
        description="Limits and deductibles"
    )
    premium_requirements: PremiumRequirements = Field(
        default_factory=PremiumRequirements,
        description="Premium and insured requirements"
    )
    underwriting_requirements: UnderwritingRequirements = Field(
        default_factory=UnderwritingRequirements,
        description="Underwriting requirements"
    )
    restrictions: Restrictions = Field(
        default_factory=Restrictions,
        description="Restrictions and referrals"
    )
    policy_terms: PolicyTerms = Field(
        default_factory=PolicyTerms,
        description="Policy terms"
    )
    extraction_notes: list[str] = Field(
        default_factory=list,
        description="Notes or warnings from extraction"
    )
    citations: dict[str, str | None] = Field(
        default_factory=dict,
        description="Source text citations for each extracted field"
    )

    def to_flat_dict(self) -> dict:
        """Flatten nested structure for Excel export (single row)."""
        flat = {}

        # Metadata fields
        flat["member_name"] = self.metadata.member_name
        flat["product_name"] = self.metadata.product_name
        flat["product_description"] = self.metadata.product_description
        flat["effective_date"] = (
            self.metadata.effective_date.isoformat()
            if self.metadata.effective_date else None
        )
        flat["document_source"] = self.metadata.document_source
        flat["extraction_timestamp"] = self.metadata.extraction_timestamp

        # Territory fields
        flat["permitted_states"] = (
            "; ".join(self.territory.permitted_states)
            if self.territory.permitted_states else None
        )
        flat["excluded_states"] = (
            "; ".join(self.territory.excluded_states)
            if self.territory.excluded_states else None
        )
        flat["admitted_status"] = self.territory.admitted_status

        # Target Market fields
        flat["target_classes"] = (
            "; ".join(self.target_market.target_classes)
            if self.target_market.target_classes else None
        )
        flat["eligible_classes"] = (
            "; ".join(self.target_market.eligible_classes)
            if self.target_market.eligible_classes else None
        )
        flat["excluded_classes"] = (
            "; ".join(self.target_market.excluded_classes)
            if self.target_market.excluded_classes else None
        )
        flat["target_operations"] = (
            "; ".join(self.target_market.target_operations)
            if self.target_market.target_operations else None
        )
        flat["eligible_operations"] = (
            "; ".join(self.target_market.eligible_operations)
            if self.target_market.eligible_operations else None
        )
        flat["ineligible_operations"] = (
            "; ".join(self.target_market.ineligible_operations)
            if self.target_market.ineligible_operations else None
        )

        # Limits & Deductibles fields
        flat["max_policy_limit"] = self.limits_deductibles.max_policy_limit
        flat["max_location_limit"] = self.limits_deductibles.max_location_limit
        flat["max_limits_of_liability"] = self.limits_deductibles.max_limits_of_liability
        flat["deductible_options"] = (
            "; ".join(self.limits_deductibles.deductible_options)
            if self.limits_deductibles.deductible_options else None
        )
        flat["deductible_min"] = self.limits_deductibles.deductible_min
        flat["deductible_max"] = self.limits_deductibles.deductible_max

        # Premium Requirements fields
        flat["max_annual_premium"] = self.premium_requirements.max_annual_premium
        flat["max_premium_per_insured"] = self.premium_requirements.max_premium_per_insured
        flat["min_premium_per_insured"] = self.premium_requirements.min_premium_per_insured
        flat["max_revenue_per_insured"] = self.premium_requirements.max_revenue_per_insured
        flat["max_tiv_per_insured"] = self.premium_requirements.max_tiv_per_insured
        flat["max_locations_per_insured"] = self.premium_requirements.max_locations_per_insured

        # Underwriting Requirements fields
        flat["eligibility_rules"] = (
            "; ".join(self.underwriting_requirements.eligibility_rules)
            if self.underwriting_requirements.eligibility_rules else None
        )
        flat["years_in_business_requirement"] = self.underwriting_requirements.years_in_business_requirement
        flat["loss_run_requirements"] = self.underwriting_requirements.loss_run_requirements
        flat["max_historical_claims"] = self.underwriting_requirements.max_historical_claims
        flat["inspection_requirements"] = self.underwriting_requirements.inspection_requirements
        flat["underwriting_file_requirements"] = (
            "; ".join(self.underwriting_requirements.underwriting_file_requirements)
            if self.underwriting_requirements.underwriting_file_requirements else None
        )
        flat["risk_scoring_parameters"] = self.underwriting_requirements.risk_scoring_parameters

        # Restrictions fields
        flat["referral_triggers"] = (
            "; ".join(self.restrictions.referral_triggers)
            if self.restrictions.referral_triggers else None
        )
        flat["nat_cat_restrictions"] = self.restrictions.nat_cat_restrictions
        flat["required_form_exclusions"] = (
            "; ".join(self.restrictions.required_form_exclusions)
            if self.restrictions.required_form_exclusions else None
        )
        flat["exclusions"] = (
            "; ".join(self.restrictions.exclusions)
            if self.restrictions.exclusions else None
        )

        # Policy Terms fields
        flat["rating_basis"] = self.policy_terms.rating_basis
        flat["max_policy_period"] = self.policy_terms.max_policy_period
        flat["cancellation_provisions"] = self.policy_terms.cancellation_provisions

        # Notes
        flat["extraction_notes"] = (
            "; ".join(self.extraction_notes)
            if self.extraction_notes else None
        )

        # Citations (store as separate dict for frontend access)
        flat["_citations"] = self.citations

        return flat

    @classmethod
    def get_flat_columns(cls) -> list[str]:
        """Get ordered list of column names for Excel export."""
        return [
            # Metadata
            "member_name",
            "product_name",
            "product_description",
            "effective_date",
            "document_source",
            "extraction_timestamp",
            # Territory
            "permitted_states",
            "excluded_states",
            "admitted_status",
            # Target Market
            "target_classes",
            "eligible_classes",
            "excluded_classes",
            "target_operations",
            "eligible_operations",
            "ineligible_operations",
            # Limits & Deductibles
            "max_policy_limit",
            "max_location_limit",
            "max_limits_of_liability",
            "deductible_options",
            "deductible_min",
            "deductible_max",
            # Premium Requirements
            "max_annual_premium",
            "max_premium_per_insured",
            "min_premium_per_insured",
            "max_revenue_per_insured",
            "max_tiv_per_insured",
            "max_locations_per_insured",
            # Underwriting Requirements
            "eligibility_rules",
            "years_in_business_requirement",
            "loss_run_requirements",
            "max_historical_claims",
            "inspection_requirements",
            "underwriting_file_requirements",
            "risk_scoring_parameters",
            # Restrictions
            "referral_triggers",
            "nat_cat_restrictions",
            "required_form_exclusions",
            "exclusions",
            # Policy Terms
            "rating_basis",
            "max_policy_period",
            "cancellation_provisions",
            # Notes
            "extraction_notes",
        ]


# Keep old imports working
Authority = LimitsDeductibles
Terms = PolicyTerms
Appetite = Restrictions
ContractMetadata = Metadata
