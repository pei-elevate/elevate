"""The certificate status of an elevator, calculated from its last completed inspection."""

from datetime import date, timedelta

from api.elevators.models import CertificateStatus
from api.inspections.models import InspectionResult

# Same deadline as the automatic inspection reminder.
DUE_SOON_DAYS = 60


def certificate_status(
    result: InspectionResult | None, valid_until: date | None, today: date
) -> CertificateStatus:
    """The status given by the result and validity of the last completed inspection.

    A failed inspection stays failed (even when resolved) until an approved re-inspection.
    """
    if result == InspectionResult.FAILED:
        return CertificateStatus.FAILED
    if valid_until is None:
        return CertificateStatus.NOT_INSPECTED
    if valid_until < today:
        return CertificateStatus.OVERDUE
    if valid_until <= today + timedelta(days=DUE_SOON_DAYS):
        return CertificateStatus.DUE_SOON
    return CertificateStatus.VALID
