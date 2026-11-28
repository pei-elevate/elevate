"""View Assigned Inspections: the inspection company lists its requests (SCRUM-51)."""

from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from api.accounts.models import InspectionCompany, MaintenanceCompany, Owner, User, UserRole
from api.elevators.models import Elevator, EquipmentType
from api.inspections.models import (
    Inspection,
    InspectionRequest,
    InspectionResult,
    RequestStatus,
    RequestType,
)

URL = "/api/inspections/assigned"
COMPANY_A = {"X-User-Id": "inspection-a"}
COMPANY_B = {"X-User-Id": "inspection-b"}


@pytest.fixture
def companies(db: Session) -> list[InspectionCompany]:
    companies = [
        InspectionCompany(name="Inspeave, Lda.", contract_start=date(2026, 1, 1)),
        InspectionCompany(name="Outra Inspeção, S.A.", contract_start=date(2025, 1, 1)),
    ]
    db.add_all(companies)
    db.flush()
    db.add_all(
        [
            User(
                external_id=external_id,
                name=external_id,
                email=f"{external_id}@ex.pt",
                role=UserRole.INSPECTION,
                inspection_company_id=company.id,
            )
            for external_id, company in zip(
                ["inspection-a", "inspection-b"], companies, strict=True
            )
        ]
    )
    db.flush()
    return companies


@pytest.fixture
def elevators(db: Session) -> list[Elevator]:
    owner = Owner(name="Condomínio Gravito 18", nif="900000001", email="owner@ex.pt")
    maintenance = MaintenanceCompany(name="Elevar, Lda.", phone="234000000", email="ema@ex.pt")
    db.add_all([owner, maintenance])
    db.flush()
    elevators = [
        Elevator(
            internal_reference=reference,
            owner_id=owner.id,
            maintenance_company_id=maintenance.id,
            address=address,
            postal_code="3810-000",
            parish="Glória e Vera Cruz",
            service_date=date(2020, 1, 1),
        )
        for reference, address in [
            ("01.05.0203", "Rua do Gravito 18"),
            ("01.05.0154", "Avenida Lourenço Peixinho 50"),
            ("01.05.0112", "Rua de Viseu 30"),
        ]
    ]
    db.add_all(elevators)
    db.flush()
    return elevators


def make_request(
    db: Session,
    number: str,
    elevator: Elevator,
    company: InspectionCompany,
    status: RequestStatus = RequestStatus.AWAITING_SCHEDULING,
    submitted_at: datetime = datetime(2026, 10, 1),
    scheduled_at: datetime | None = None,
) -> InspectionRequest:
    request = InspectionRequest(
        process_number=number,
        elevator_id=elevator.id,
        inspection_company_id=company.id,
        type=RequestType.PERIODIC,
        equipment_type=EquipmentType.ELEVATOR,
        status=status,
        submitted_at=submitted_at,
        scheduled_at=scheduled_at,
    )
    db.add(request)
    db.flush()
    return request


@pytest.fixture
def requests(
    db: Session, companies: list[InspectionCompany], elevators: list[Elevator]
) -> list[InspectionRequest]:
    a, b = companies
    awaiting, scheduled, completed = elevators
    requests = [
        make_request(
            db,
            "2026/0341",
            scheduled,
            a,
            RequestStatus.SCHEDULED,
            datetime(2026, 10, 2),
            datetime(2026, 11, 19, 10, 0),
        ),
        make_request(db, "2026/0377", awaiting, a, submitted_at=datetime(2026, 10, 8)),
        make_request(
            db,
            "2025/0118",
            completed,
            a,
            RequestStatus.COMPLETED,
            datetime(2025, 1, 14),
            datetime(2025, 3, 3, 10, 0),
        ),
        make_request(db, "2026/0400", awaiting, b),
    ]
    db.add(
        Inspection(
            request_id=requests[2].id,
            performed_date=date(2025, 3, 3),
            result=InspectionResult.APPROVED,
            valid_until=date(2027, 3, 3),
            report_file="relatorio-2025-0118.pdf",
        )
    )
    db.flush()
    return requests


def numbers(response) -> list[str]:
    assert response.status_code == 200
    return [r["process_number"] for r in response.json()]


def test_requires_a_user(client: TestClient, requests):
    assert client.get(URL).status_code == 401
    assert client.get(URL, headers={"X-User-Id": "unknown"}).status_code == 401


@pytest.mark.parametrize("role", [r for r in UserRole if r != UserRole.INSPECTION])
def test_only_the_inspection_company_sees_it(client: TestClient, db: Session, requests, role):
    db.add(User(external_id="other", name="other", email="other@ex.pt", role=role))
    db.flush()

    assert client.get(URL, headers={"X-User-Id": "other"}).status_code == 403


def test_a_company_only_sees_its_own_requests(client: TestClient, requests):
    assert numbers(client.get(URL, headers=COMPANY_A)) == ["2026/0377", "2026/0341", "2025/0118"]
    assert numbers(client.get(URL, headers=COMPANY_B)) == ["2026/0400"]


def test_lists_awaiting_scheduling_first_then_oldest_first(
    client: TestClient, db: Session, companies, elevators, requests
):
    make_request(db, "2026/0369", elevators[0], companies[0], submitted_at=datetime(2026, 10, 7))

    assert numbers(client.get(URL, headers=COMPANY_A)) == [
        "2026/0369",
        "2026/0377",
        "2026/0341",
        "2025/0118",
    ]


def test_returns_the_elevator_and_the_contact_but_not_the_owner(client: TestClient, requests):
    scheduled = client.get(URL, headers=COMPANY_A).json()[1]

    assert scheduled["status"] == "scheduled"
    assert scheduled["type"] == "periodic"
    assert scheduled["submitted_at"] == "2026-10-02T00:00:00"
    assert scheduled["scheduled_at"] == "2026-11-19T10:00:00"
    assert scheduled["inspection"] is None
    assert scheduled["elevator"] == {
        "internal_reference": "01.05.0154",
        "dge_number": None,
        "address": "Avenida Lourenço Peixinho 50",
        "postal_code": "3810-000",
        "parish": "Glória e Vera Cruz",
        "building": None,
        "maintenance_company": {"name": "Elevar, Lda.", "phone": "234000000", "email": "ema@ex.pt"},
    }
    assert "owner" not in str(scheduled)


def test_a_completed_request_has_its_result(client: TestClient, requests):
    completed = client.get(URL, headers=COMPANY_A).json()[2]

    assert completed["inspection"] == {
        "performed_date": "2025-03-03",
        "result": "approved",
        "valid_until": "2027-03-03",
        "correction_deadline": None,
    }


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        ("awaiting_scheduling", ["2026/0377"]),
        ("scheduled", ["2026/0341"]),
        ("completed", ["2025/0118"]),
    ],
)
def test_filters_by_status(client: TestClient, requests, status, expected):
    assert numbers(client.get(URL, headers=COMPANY_A, params={"status": status})) == expected


def test_rejects_an_unknown_status(client: TestClient, requests):
    response = client.get(URL, headers=COMPANY_A, params={"status": "lost"})

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("2026/03", ["2026/0377", "2026/0341"]),  # Process number
        ("01.05.0112", ["2025/0118"]),  # Internal reference
        ("lourenço", ["2026/0341"]),  # Address, any case
        ("  viseu ", ["2025/0118"]),  # Spaces around are ignored
        ("2026/0400", []),  # Another company's request
        ("%", []),  # Searched for, not a wildcard
    ],
)
def test_searches_by_text(client: TestClient, requests, text, expected):
    assert numbers(client.get(URL, headers=COMPANY_A, params={"q": text})) == expected


def test_empty_list(client: TestClient, companies):
    assert numbers(client.get(URL, headers=COMPANY_A)) == []


def test_a_user_without_a_company_sees_nothing(client: TestClient, db: Session, requests):
    db.add(User(external_id="new", name="new", email="new@ex.pt", role=UserRole.INSPECTION))
    db.flush()

    assert numbers(client.get(URL, headers={"X-User-Id": "new"})) == []
