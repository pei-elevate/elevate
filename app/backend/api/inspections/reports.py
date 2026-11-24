"""The PDF reports of the inspections, kept as files in settings.reports_dir.

The database keeps only the stored name. The name is random, never the uploaded one, so a
file name sent by a user cannot point outside the folder or overwrite another report.
"""

from pathlib import Path
from uuid import uuid4

from api.config import settings

MAX_BYTES = 10 * 1024 * 1024


class InvalidReport(Exception):
    """Missing, empty, not a PDF, or larger than 10 MB."""


def check(content: bytes, filename: str | None) -> None:
    if (
        not content
        or len(content) > MAX_BYTES
        or not (filename or "").lower().endswith(".pdf")
        or not content.startswith(b"%PDF")
    ):
        raise InvalidReport


def save(content: bytes) -> str:
    """Write the report and return its stored name."""
    name = f"{uuid4().hex}.pdf"
    settings.reports_dir.mkdir(parents=True, exist_ok=True)
    path(name).write_bytes(content)
    return name


def path(name: str) -> Path:
    return settings.reports_dir / name


def delete(name: str) -> None:
    path(name).unlink(missing_ok=True)


def clear() -> None:
    """Remove every report, when the sample data replaces all inspections."""
    for report in settings.reports_dir.glob("*.pdf"):
        report.unlink()
