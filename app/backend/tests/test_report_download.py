"""Downloading the PDF report of an inspection (ELEV-56), and the sample reports of the seed."""

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.accounts.models import InspectionCompany, MaintenanceCompany, Owner, User, UserRole
from api.elevators.models import Elevator, EquipmentType, RegistrationStatus
from api.inspections.models import (
    Inspection,
    InspectionRequest,
    InspectionResult,
    RequestStatus,
    RequestType,
)

PDF = b"%PDF-1.4\n%%EOF\n"


def headers(external_id: str) -> dict:
    return {"X-User-Id": external_id}


@dataclass
class Data:
    completed: InspectionRequest
    scheduled: InspectionRequest
    lost_file: InspectionRequest
    elevator: Elevator


@pytest.fixture(autouse=True)
def reports_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    from api.config import settings

    folder = tmp_path / "reports"
    folder.mkdir()
    monkeypatch.setattr(settings, "reports_dir", folder)
    return folder


@pytest.fixture
def data(db: Session, reports_dir: Path) -> Data:
    inspeave = InspectionCompany(name="Inspeave, Lda.", contract_start=date(2026, 1, 1))
    other_inspection = InspectionCompany(name="Outra, S.A.", contract_start=date(2025, 1, 1))
    owner = Owner(name="Condomínio Gravito 18", nif="900000001", email="owner@ex.pt")
    other_owner = Owner(name="Condomínio Viseu 30", nif="900000002", email="other@ex.pt")
    elevar = MaintenanceCompany(name="Elevar, Lda.")
    ascende = MaintenanceCompany(name="Ascende, Lda.")
    db.add_all([inspeave, other_inspection, owner, other_owner, elevar, ascende])
    db.flush()

    def user(external_id: str, role: UserRole, **link: int) -> User:
        return User(
            external_id=external_id,
            name=external_id,
            email=f"{external_id}@ex.pt",
            role=role,
            **link,
        )

    db.add_all(
        [
            user("owner", UserRole.OWNER, owner_id=owner.id),
            user("other-owner", UserRole.OWNER, owner_id=other_owner.id),
            user("maintenance", UserRole.MAINTENANCE, maintenance_company_id=elevar.id),
            user("other-maintenance", UserRole.MAINTENANCE, maintenance_company_id=ascende.id),
            user("manager", UserRole.MUNICIPAL_MANAGER),
            user("inspection", UserRole.INSPECTION, inspection_company_id=inspeave.id),
            user(
                "other-inspection",
                UserRole.INSPECTION,
                inspection_company_id=other_inspection.id,
            ),
            user("urban-planning", UserRole.URBAN_PLANNING),
        ]
    )
    elevator = Elevator(
        internal_reference="01.05.0154",
        owner_id=owner.id,
        maintenance_company_id=elevar.id,
        address="Av. Dr. Lourenço Peixinho 85",
        postal_code="3800-000",
        parish="Glória e Vera Cruz",
        service_date=date(2020, 1, 1),
        registration_status=RegistrationStatus.APPROVED,
    )
    db.add(elevator)
    db.flush()

    def request(number: str, status: RequestStatus) -> InspectionRequest:
        return InspectionRequest(
            process_number=number,
            elevator_id=elevator.id,
            inspection_company_id=inspeave.id,
            type=RequestType.PERIODIC,
            equipment_type=EquipmentType.ELEVATOR,
            status=status,
            submitted_at=datetime(2026, 10, 1),
            scheduled_at=datetime(2026, 11, 19, 10),
        )

    completed = request("2026/0341", RequestStatus.COMPLETED)
    scheduled = request("2026/0342", RequestStatus.SCHEDULED)
    lost_file = request("2024/0388", RequestStatus.COMPLETED)
    db.add_all([completed, scheduled, lost_file])
    db.flush()
    db.add_all(
        [
            Inspection(
                request_id=completed.id,
                performed_date=date(2026, 11, 19),
                result=InspectionResult.APPROVED,
                valid_until=date(2028, 11, 19),
                report_file="stored.pdf",
            ),
            Inspection(
                request_id=lost_file.id,
                performed_date=date(2024, 6, 20),
                result=InspectionResult.APPROVED,
                valid_until=date(2026, 6, 20),
                report_file="gone.pdf",
            ),
        ]
    )
    db.flush()
    (reports_dir / "stored.pdf").write_bytes(PDF)
    return Data(completed, scheduled, lost_file, elevator)


def download(client: TestClient, request: InspectionRequest, user: str):
    return client.get(f"/api/inspections/requests/{request.id}/report", headers=headers(user))


@pytest.mark.parametrize("user", ["owner", "maintenance", "manager", "inspection"])
def test_whoever_sees_the_history_downloads_the_report(client: TestClient, data: Data, user: str):
    response = download(client, data.completed, user)

    assert response.status_code == 200
    assert response.content == PDF
    assert response.headers["content-type"] == "application/pdf"
    assert 'filename="relatorio-2026-0341.pdf"' in response.headers["content-disposition"]


@pytest.mark.parametrize("user", ["other-owner", "other-maintenance", "other-inspection"])
def test_someone_elses_report_is_not_found(client: TestClient, data: Data, user: str):
    assert download(client, data.completed, user).status_code == 404


def test_urban_planning_cannot_download(client: TestClient, data: Data):
    assert download(client, data.completed, "urban-planning").status_code == 403


def test_a_request_without_result_has_no_report(client: TestClient, data: Data):
    assert download(client, data.scheduled, "manager").status_code == 404


def test_a_missing_file_is_not_found(client: TestClient, data: Data):
    assert download(client, data.lost_file, "manager").status_code == 404


def test_a_missing_request_is_not_found(client: TestClient, data: Data):
    response = client.get("/api/inspections/requests/999999/report", headers=headers("manager"))

    assert response.status_code == 404


def test_the_history_gives_the_request_to_download(client: TestClient, data: Data):
    history = client.get(
        f"/api/elevators/{data.elevator.id}/inspections", headers=headers("owner")
    ).json()

    assert {h["process_number"]: h["request_id"] for h in history} == {
        "2026/0341": data.completed.id,
        "2024/0388": data.lost_file.id,
    }


def test_the_seed_writes_a_pdf_for_every_sample_report(db: Session, reports_dir: Path):
    from api.seed import seed

    (reports_dir / "left-over.pdf").write_bytes(PDF)
    seed(db)

    names = db.scalars(select(Inspection.report_file)).all()
    assert names
    for name in names:
        assert (reports_dir / name).read_bytes().startswith(b"%PDF")
    # Reports of the data the seed replaced are removed with it.
    assert not (reports_dir / "left-over.pdf").exists()


@pytest.mark.parametrize("name", ["../x.pdf", "a/b.pdf", "/etc/passwd", "", ".", ".."])
def test_a_report_name_never_leaves_the_folder(reports_dir: Path, name: str):
    from api.inspections import reports

    with pytest.raises(ValueError):
        reports.path(name)


def test_a_plain_report_name_stays_in_the_folder(reports_dir: Path):
    from api.inspections import reports

    assert reports.path("relatorio.pdf") == reports_dir / "relatorio.pdf"
