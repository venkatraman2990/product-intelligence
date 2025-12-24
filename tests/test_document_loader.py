"""Tests for document loader."""

import pytest
from pathlib import Path

from src.extractors.document_loader import DocumentLoader


class TestDocumentLoader:
    """Tests for DocumentLoader class."""

    def test_supported_extensions(self):
        """Test that supported extensions are defined."""
        assert ".pdf" in DocumentLoader.SUPPORTED_EXTENSIONS
        assert ".docx" in DocumentLoader.SUPPORTED_EXTENSIONS

    def test_is_supported_pdf(self):
        """Test PDF file detection."""
        assert DocumentLoader.is_supported("contract.pdf")
        assert DocumentLoader.is_supported("Contract.PDF")

    def test_is_supported_word(self):
        """Test Word file detection."""
        assert DocumentLoader.is_supported("contract.docx")
        assert DocumentLoader.is_supported("contract.doc")

    def test_is_not_supported(self):
        """Test unsupported file detection."""
        assert not DocumentLoader.is_supported("contract.txt")
        assert not DocumentLoader.is_supported("contract.csv")
        assert not DocumentLoader.is_supported("contract.xlsx")

    def test_file_not_found(self):
        """Test error handling for missing files."""
        loader = DocumentLoader()
        with pytest.raises(FileNotFoundError):
            loader.load("nonexistent_file.pdf")

    def test_unsupported_file_type(self):
        """Test error handling for unsupported file types."""
        loader = DocumentLoader()
        # Create a temp txt file
        temp_file = Path("test_temp.txt")
        temp_file.write_text("test content")
        try:
            with pytest.raises(ValueError):
                loader.load(temp_file)
        finally:
            temp_file.unlink()
