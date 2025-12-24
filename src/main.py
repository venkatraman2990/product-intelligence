"""Product Intelligence - Contract Extraction CLI.

Command-line interface for extracting structured data from insurance contracts.
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

import click
from rich.console import Console
from rich.logging import RichHandler
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

# Setup rich console with UTF-8 support for Windows
console = Console(force_terminal=True, legacy_windows=False)


def setup_logging(verbose: bool = False):
    """Configure logging with rich handler."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(console=console, rich_tracebacks=True)],
    )


@click.group()
@click.option("-v", "--verbose", is_flag=True, help="Enable verbose logging")
@click.pass_context
def cli(ctx, verbose):
    """Product Intelligence - Insurance Contract Extraction Tool.

    Extract structured data from PDF and Word insurance contracts
    and export to Excel for analysis.
    """
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose
    setup_logging(verbose)


@cli.command()
@click.option(
    "-i", "--input",
    "input_path",
    required=True,
    type=click.Path(exists=True),
    help="Input file or directory containing contracts",
)
@click.option(
    "-o", "--output",
    "output_path",
    type=click.Path(),
    help="Output Excel file path (default: output/extractions_<timestamp>.xlsx)",
)
@click.option(
    "-b", "--backend",
    type=click.Choice(["llm", "landing_ai"]),
    default="llm",
    help="Extraction backend to use",
)
@click.option(
    "--provider",
    type=click.Choice(["anthropic", "openai"]),
    default="anthropic",
    help="LLM provider (when using llm backend)",
)
@click.pass_context
def extract(ctx, input_path, output_path, backend, provider):
    """Extract structured data from contract documents.

    Examples:

        # Extract from single file
        python -m src.main extract -i contract.pdf -o results.xlsx

        # Extract from folder
        python -m src.main extract -i ./contracts/ -o all_contracts.xlsx

        # Use OpenAI instead of Claude
        python -m src.main extract -i contract.pdf --provider openai
    """
    from src.extractors import get_extractor, DocumentLoader
    from src.exporters import ExcelExporter

    input_path = Path(input_path)

    # Determine output path
    if output_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = Path("data/output") / f"extractions_{timestamp}.xlsx"
    else:
        output_path = Path(output_path)

    # Collect documents to process
    if input_path.is_file():
        documents = [input_path]
    else:
        documents = []
        for ext in DocumentLoader.SUPPORTED_EXTENSIONS:
            documents.extend(input_path.glob(f"*{ext}"))
            documents.extend(input_path.glob(f"**/*{ext}"))
        documents = list(set(documents))  # Remove duplicates

    if not documents:
        console.print("[red]No supported documents found![/red]")
        console.print(f"Supported formats: {DocumentLoader.SUPPORTED_EXTENSIONS}")
        sys.exit(1)

    print(f"\nProduct Intelligence - Contract Extractor")
    print(f"Found {len(documents)} document(s) to process\n")

    # Initialize extractor
    print(f"Using backend: {backend}")
    if backend == "llm":
        print(f"LLM provider: {provider}")
        extractor = get_extractor(backend, provider=provider)
    else:
        extractor = get_extractor(backend)

    # Process documents
    results = []
    for i, doc_path in enumerate(documents, 1):
        print(f"[{i}/{len(documents)}] Processing: {doc_path.name}")
        try:
            result = extractor.extract(doc_path)
            results.append(result)
            print(f"  -> OK")
        except Exception as e:
            print(f"  -> FAILED: {e}")
            # Create error record
            from src.schema import ContractData, ContractMetadata
            error_result = ContractData(
                metadata=ContractMetadata(
                    document_source=str(doc_path),
                    extraction_timestamp=datetime.now().isoformat(),
                ),
                extraction_notes=[f"Error: {str(e)}"],
            )
            results.append(error_result)

    # Export to Excel
    if results:
        print(f"\nExporting to: {output_path}")
        exporter = ExcelExporter()
        exporter.export(results, output_path)
        print(f"Successfully exported {len(results)} record(s)\n")

        # Show summary
        _show_summary_simple(results)
    else:
        print("No results to export")


@cli.command()
@click.option(
    "-i", "--input",
    "input_path",
    required=True,
    type=click.Path(exists=True),
    help="Input file to analyze",
)
def info(input_path):
    """Show information about a document without extracting.

    Useful for checking if a document can be processed.
    """
    from src.extractors import DocumentLoader

    input_path = Path(input_path)
    loader = DocumentLoader()

    console.print(f"\n[bold]Document Info: {input_path.name}[/bold]\n")

    try:
        doc = loader.load(input_path)

        table = Table(show_header=False)
        table.add_column("Property", style="cyan")
        table.add_column("Value")

        table.add_row("Path", str(doc.path))
        table.add_row("Type", doc.document_type.upper())
        table.add_row("Pages", str(doc.page_count))
        table.add_row("Characters", f"{len(doc.text):,}")

        for key, value in doc.metadata.items():
            if value:
                table.add_row(f"Metadata: {key}", str(value))

        console.print(table)
        console.print(f"\n[dim]Preview (first 500 chars):[/dim]")
        console.print(doc.text[:500] + "..." if len(doc.text) > 500 else doc.text)

    except Exception as e:
        console.print(f"[red]Error loading document: {e}[/red]")
        sys.exit(1)


@cli.command()
def version():
    """Show version information."""
    from src import __version__

    console.print(f"\n[bold]Product Intelligence[/bold]")
    console.print(f"Version: {__version__}")
    console.print("Contract Extraction System for Insurance Documents\n")


def _show_summary_simple(results):
    """Display extraction summary (plain text)."""
    print("=" * 70)
    print("EXTRACTION SUMMARY")
    print("=" * 70)

    for result in results:
        # Determine status
        if result.extraction_notes and any("Error" in n for n in result.extraction_notes):
            status = "ERROR"
        elif result.metadata.member_name or result.metadata.product_name:
            status = "OK"
        else:
            status = "PARTIAL"

        # Format values
        member = result.metadata.member_name or "Unknown"
        product = result.metadata.product_name or "N/A"
        doc_name = Path(result.metadata.document_source or "").name or "Unknown"
        limits = f"${result.limits_deductibles.max_policy_limit:,.0f}" if result.limits_deductibles.max_policy_limit else "N/A"
        states_list = result.territory.permitted_states if result.territory.permitted_states else []
        states = ", ".join(states_list[:3]) if states_list else "N/A"
        if len(states_list) > 3:
            states += f" (+{len(states_list) - 3})"

        print(f"\n{doc_name}")
        print(f"  Member: {member}")
        print(f"  Product: {product}")
        print(f"  Max Policy Limit: {limits}")
        print(f"  States: {states}")
        print(f"  Status: {status}")

    print("=" * 70)


if __name__ == "__main__":
    cli()
