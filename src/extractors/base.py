"""Base extractor interface for contract data extraction."""

from abc import ABC, abstractmethod
from pathlib import Path

from src.schema import ContractData


class BaseExtractor(ABC):
    """Abstract base class for document extractors.

    All extractor implementations (LLM, Landing AI, etc.) must inherit
    from this class and implement the extract method.
    """

    @abstractmethod
    def extract(self, document_path: str | Path, document_text: str | None = None) -> ContractData:
        """Extract structured contract data from a document.

        Args:
            document_path: Path to the source document
            document_text: Optional pre-extracted text content

        Returns:
            ContractData: Structured extraction result
        """
        pass

    @abstractmethod
    def extract_batch(self, document_paths: list[str | Path]) -> list[ContractData]:
        """Extract data from multiple documents.

        Args:
            document_paths: List of paths to documents

        Returns:
            List of ContractData objects
        """
        pass

    def get_name(self) -> str:
        """Return the name of this extractor."""
        return self.__class__.__name__
