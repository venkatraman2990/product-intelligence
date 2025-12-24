"""Tests for contract schema models."""

import pytest
from datetime import date

from src.schema import (
    ContractData,
    Authority,
    Terms,
    Appetite,
    ContractMetadata,
)


class TestContractMetadata:
    """Tests for ContractMetadata model."""

    def test_create_empty_metadata(self):
        """Test creating metadata with no values."""
        metadata = ContractMetadata()
        assert metadata.member_name is None
        assert metadata.contract_effective_date is None

    def test_create_full_metadata(self):
        """Test creating metadata with all values."""
        metadata = ContractMetadata(
            member_name="Test Member",
            contract_effective_date=date(2024, 1, 1),
            contract_expiration_date=date(2024, 12, 31),
            document_source="test.pdf",
        )
        assert metadata.member_name == "Test Member"
        assert metadata.contract_effective_date == date(2024, 1, 1)


class TestAuthority:
    """Tests for Authority model."""

    def test_create_authority_with_limits(self):
        """Test creating authority with limits."""
        authority = Authority(
            limits_per_risk=1000000,
            limits_aggregate=5000000,
        )
        assert authority.limits_per_risk == 1000000
        assert authority.limits_aggregate == 5000000

    def test_create_authority_with_territories(self):
        """Test creating authority with territory lists."""
        authority = Authority(
            territories_states=["CA", "TX", "FL"],
            territories_exclusions=["NY"],
        )
        assert len(authority.territories_states) == 3
        assert "CA" in authority.territories_states


class TestContractData:
    """Tests for ContractData model."""

    def test_create_contract_data(self):
        """Test creating a complete ContractData object."""
        contract = ContractData(
            metadata=ContractMetadata(member_name="Test"),
            authority=Authority(limits_per_risk=1000000),
            terms=Terms(premium_bands_min=10000, premium_bands_max=100000),
            appetite=Appetite(exclusions=["Flood", "Earthquake"]),
        )
        assert contract.metadata.member_name == "Test"
        assert contract.authority.limits_per_risk == 1000000

    def test_to_flat_dict(self):
        """Test flattening ContractData for Excel export."""
        contract = ContractData(
            metadata=ContractMetadata(member_name="Test Member"),
            authority=Authority(
                limits_per_risk=1000000,
                territories_states=["CA", "TX"],
            ),
        )
        flat = contract.to_flat_dict()

        assert flat["member_name"] == "Test Member"
        assert flat["limits_per_risk"] == 1000000
        assert flat["territories_states"] == "CA; TX"

    def test_get_flat_columns(self):
        """Test getting column names for Excel export."""
        columns = ContractData.get_flat_columns()
        assert "member_name" in columns
        assert "limits_per_risk" in columns
        assert "exclusions" in columns


class TestTerms:
    """Tests for Terms model."""

    def test_create_terms_with_premium_bands(self):
        """Test creating terms with premium bands."""
        terms = Terms(
            premium_bands_min=10000,
            premium_bands_max=500000,
        )
        assert terms.premium_bands_min == 10000
        assert terms.premium_bands_max == 500000


class TestAppetite:
    """Tests for Appetite model."""

    def test_create_appetite_with_exclusions(self):
        """Test creating appetite with exclusions."""
        appetite = Appetite(
            exclusions=["Flood", "Earthquake", "War"],
            referral_triggers=["Limits > $2M", "Coastal property"],
        )
        assert len(appetite.exclusions) == 3
        assert len(appetite.referral_triggers) == 2
