"""The certificate status of an elevator, calculated from its last inspection (ELEV-54)."""

from datetime import date

import pytest

from api.elevators.certificate import certificate_status
from api.elevators.models import CertificateStatus
from api.inspections.models import InspectionResult

TODAY = date(2026, 11, 21)


@pytest.mark.parametrize(
    ("result", "valid_until", "expected"),
    [
        (None, None, CertificateStatus.NOT_INSPECTED),
        (InspectionResult.FAILED, None, CertificateStatus.FAILED),
        (InspectionResult.APPROVED, None, CertificateStatus.NOT_INSPECTED),
        (InspectionResult.APPROVED, date(2026, 11, 20), CertificateStatus.OVERDUE),
        (InspectionResult.APPROVED, date(2026, 11, 21), CertificateStatus.DUE_SOON),
        (InspectionResult.APPROVED, date(2027, 1, 20), CertificateStatus.DUE_SOON),
        (InspectionResult.APPROVED, date(2027, 1, 21), CertificateStatus.VALID),
    ],
)
def test_certificate_status(result, valid_until, expected):
    assert certificate_status(result, valid_until, TODAY) == expected
