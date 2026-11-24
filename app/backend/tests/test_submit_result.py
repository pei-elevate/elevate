"""Submit Inspection Results: the inspection company records the verdict and the PDF (ELEV-56)."""

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from api.accounts.models import InspectionCompany, MaintenanceCompany, Owner, User, UserRole
from api.elevators.models import Elevator, EquipmentType
from api.inspections.models import (
    FailedInspectionStatus,
    InspectionRequest,
    InspectionResult,
    RequestStatus,
    RequestType,
)

COMPANY_A = {"X-User-Id": "inspection-a"}
COMPANY_B = {"X-User-Id": "inspection-b"}
NO_COMPANY = {"X-User-Id": "inspection-none"}
MAINTENANCE = {"X-User-Id": "maintenance"}

PDF = b"%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"
APPROVED = {"result": "approved", "performed_date": "2026-11-19", "valid_until": "2028-11-19"}
FAILED = {
    "result": "failed",
    "performed_date": "2026-11-19",
    "correction_deadline": "2027-01-19",
    "nonconformities": "Porta de patamar sem encravamento.",
}


@dataclass
class Requests:
    awaiting: InspectionRequest
    scheduled: InspectionRequest
    completed: InspectionRequest
    other: InspectionRequest


@pytest.fixture(autouse=True)
def reports_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """The PDFs go to a temporary folder instead of the Docker volume."""
    from api.config import settings

    monkeypatch.setattr(settings, "reports_dir", tmp_path / "reports")
    return tmp_path / "reports"


@pytest.fixture
def requests(db: Session) -> Requests:
    a = InspectionCompany(name="Inspeave, Lda.", contract_start=date(2026, 1, 1))
    b = InspectionCompany(name="Outra Inspeção, S.A.", contract_start=date(2025, 1, 1))
    owner = Owner(name="Condomínio Gravito 18", nif="900000001", email="owner@ex.pt")
    maintenance = MaintenanceCompany(name="Elevar, Lda.")
    db.add_all([a, b, owner, maintenance])
    db.flush()

    def user(external_id: str, role: UserRole, **company: int) -> User:
        return User(
            external_id=external_id,
            name=external_id,
            email=f"{external_id}@ex.pt",
            role=role,
            **company,
        )

    db.add_all(
        [
            user("inspection-a", UserRole.INSPECTION, inspection_company_id=a.id),
            user("inspection-b", UserRole.INSPECTION, inspection_company_id=b.id),
            user("inspection-none", UserRole.INSPECTION),
            user("maintenance", UserRole.MAINTENANCE, maintenance_company_id=maintenance.id),
        ]
    )
    elevator = Elevator(
        internal_reference="01.05.0154",
        owner_id=owner.id,
        maintenance_company_id=maintenance.id,
        address="Av. Dr. Lourenço Peixinho 85",
        postal_code="3800-000",
        parish="Glória e Vera Cruz",
        service_date=date(2020, 1, 1),
    )
    db.add(elevator)
    db.flush()

    def request(
        number: str, company: InspectionCompany, status: RequestStatus
    ) -> InspectionRequest:
        return InspectionRequest(
            process_number=number,
            elevator_id=elevator.id,
            inspection_company_id=company.id,
            type=RequestType.PERIODIC,
            equipment_type=EquipmentType.ELEVATOR,
            status=status,
            submitted_at=datetime(2026, 10, 1),
            scheduled_at=None
            if status == RequestStatus.AWAITING_SCHEDULING
            else datetime(2026, 11, 19, 10),
        )

    requests = Requests(
        awaiting=request("2026/0377", a, RequestStatus.AWAITING_SCHEDULING),
        scheduled=request("2026/0341", a, RequestStatus.SCHEDULED),
        completed=request("2025/0118", a, RequestStatus.COMPLETED),
        other=request("2026/0400", b, RequestStatus.SCHEDULED),
    )
    db.add_all([requests.awaiting, requests.scheduled, requests.completed, requests.other])
    db.flush()
    return requests


def submit(
    client: TestClient,
    request: InspectionRequest,
    fields: dict,
    headers: dict = COMPANY_A,
    report: bytes | None = PDF,
    filename: str = "relatorio.pdf",
):
    files = {"report": (filename, report, "application/pdf")} if report is not None else None
    return client.post(
        f"/api/inspections/requests/{request.id}/result",
        data=fields,
        files=files,
        headers=headers,
    )


def assert_still_scheduled(db: Session, request: InspectionRequest, reports_dir: Path):
    db.refresh(request)
    assert request.status == RequestStatus.SCHEDULED
    assert request.inspection is None
    assert not reports_dir.exists() or not any(reports_dir.iterdir())


def test_submits_an_approved_inspection(
    client: TestClient, db: Session, requests: Requests, reports_dir: Path
):
    response = submit(client, requests.scheduled, APPROVED)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["inspection"] == {
        "performed_date": "2026-11-19",
        "result": "approved",
        "valid_until": "2028-11-19",
        "correction_deadline": None,
    }
    db.refresh(requests.scheduled)
    inspection = requests.scheduled.inspection
    assert inspection is not None
    assert inspection.result == InspectionResult.APPROVED
    assert inspection.failed_status is None
    assert (reports_dir / inspection.report_file).read_bytes() == PDF


def test_a_failed_inspection_requires_action(client: TestClient, db: Session, requests: Requests):
    response = submit(client, requests.scheduled, FAILED)

    assert response.status_code == 200
    assert response.json()["inspection"]["correction_deadline"] == "2027-01-19"
    db.refresh(requests.scheduled)
    inspection = requests.scheduled.inspection
    assert inspection is not None
    assert inspection.result == InspectionResult.FAILED
    assert inspection.failed_status == FailedInspectionStatus.ACTION_REQUIRED
    assert inspection.nonconformities == "Porta de patamar sem encravamento."
    assert inspection.valid_until is None


def test_the_stored_name_is_not_the_uploaded_one(
    client: TestClient, db: Session, requests: Requests
):
    submit(client, requests.scheduled, APPROVED, filename="../../etc/passwd.pdf")

    db.refresh(requests.scheduled)
    assert requests.scheduled.inspection is not None
    name = requests.scheduled.inspection.report_file
    assert "/" not in name and ".." not in name and name.endswith(".pdf")


@pytest.mark.parametrize(
    "headers",
    [COMPANY_B, NO_COMPANY],
    ids=["another company", "user without company"],
)
def test_another_companys_request_is_not_found(
    client: TestClient, db: Session, requests: Requests, reports_dir: Path, headers: dict
):
    response = submit(client, requests.scheduled, APPROVED, headers=headers)

    assert response.status_code == 404
    assert_still_scheduled(db, requests.scheduled, reports_dir)


def test_a_missing_request_is_not_found(client: TestClient, requests: Requests):
    response = client.post(
        "/api/inspections/requests/999999/result",
        data=APPROVED,
        files={"report": ("r.pdf", PDF, "application/pdf")},
        headers=COMPANY_A,
    )

    assert response.status_code == 404


@pytest.mark.parametrize("which", ["awaiting", "completed"])
def test_only_a_scheduled_request_takes_a_result(
    client: TestClient, requests: Requests, reports_dir: Path, which: str
):
    response = submit(client, getattr(requests, which), APPROVED)

    assert response.status_code == 409
    assert not reports_dir.exists() or not any(reports_dir.iterdir())


def test_only_the_inspection_company_submits(client: TestClient, requests: Requests):
    response = submit(client, requests.scheduled, APPROVED, headers=MAINTENANCE)

    assert response.status_code == 403


@pytest.mark.parametrize(
    "fields",
    [
        {**APPROVED, "performed_date": "2099-01-01", "valid_until": "2100-01-01"},
        {**APPROVED, "valid_until": ""},
        {**APPROVED, "valid_until": "2026-11-19"},
        {**FAILED, "nonconformities": "  "},
        {**FAILED, "correction_deadline": ""},
        {**FAILED, "correction_deadline": "2026-11-18"},
        {**APPROVED, "result": "maybe"},
    ],
    ids=[
        "performed in the future",
        "approved without validity",
        "validity not after the inspection",
        "failed without nonconformities",
        "failed without deadline",
        "deadline before the inspection",
        "unknown result",
    ],
)
def test_an_invalid_result_is_refused(
    client: TestClient, db: Session, requests: Requests, reports_dir: Path, fields: dict
):
    response = submit(client, requests.scheduled, fields)

    assert response.status_code == 422
    assert_still_scheduled(db, requests.scheduled, reports_dir)


@pytest.mark.parametrize(
    ("report", "filename"),
    [
        (None, "relatorio.pdf"),
        (b"", "relatorio.pdf"),
        (b"just some text", "relatorio.pdf"),
        (PDF, "relatorio.docx"),
        (PDF + b"0" * (10 * 1024 * 1024), "relatorio.pdf"),
    ],
    ids=["missing", "empty", "not a pdf", "wrong extension", "over 10 MB"],
)
def test_an_invalid_report_is_refused(
    client: TestClient,
    db: Session,
    requests: Requests,
    reports_dir: Path,
    report: bytes | None,
    filename: str,
):
    response = submit(client, requests.scheduled, APPROVED, report=report, filename=filename)

    assert response.status_code == 422
    assert_still_scheduled(db, requests.scheduled, reports_dir)


def test_the_history_shows_the_result(client: TestClient, requests: Requests):
    submit(client, requests.scheduled, APPROVED)

    listed = client.get("/api/inspections/assigned", headers=COMPANY_A).json()
    done = next(r for r in listed if r["process_number"] == "2026/0341")
    assert done["status"] == "completed"
    assert done["inspection"]["result"] == "approved"
