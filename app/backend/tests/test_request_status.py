"""Check Request / Inspection Status: the maintenance company and the municipal manager follow
the inspection requests (ELEV-55)."""

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

URL = "/api/inspections/requests"
MAINTENANCE_A = {"X-User-Id": "maintenance-a"}
MAINTENANCE_B = {"X-User-Id": "maintenance-b"}
MANAGER = {"X-User-Id": "manager"}


@pytest.fixture
def maintenance_companies(db: Session) -> list[MaintenanceCompany]:
    companies = [
        MaintenanceCompany(name="Elevar, Lda.", phone="234000000", email="ema@ex.pt"),
        MaintenanceCompany(name="Ascensores Ria, Lda."),
    ]
    db.add_all(companies)
    db.flush()
    db.add_all(
        [
            User(
                external_id=external_id,
                name=external_id,
                email=f"{external_id}@ex.pt",
                role=UserRole.MAINTENANCE,
                maintenance_company_id=company.id,
            )
            for external_id, company in zip(
                ["maintenance-a", "maintenance-b"], companies, strict=True
            )
        ]
        + [
            User(
                external_id="manager",
                name="manager",
                email="manager@ex.pt",
                role=UserRole.MUNICIPAL_MANAGER,
            )
        ]
    )
    db.flush()
    return companies


@pytest.fixture
def inspection_company(db: Session) -> InspectionCompany:
    company = InspectionCompany(
        name="Inspeave, Lda.",
        phone="234111111",
        email="geral@inspeave.pt",
        contract_start=date(2026, 1, 1),
    )
    db.add(company)
    db.flush()
    return company


@pytest.fixture
def elevators(db: Session, maintenance_companies: list[MaintenanceCompany]) -> list[Elevator]:
    owner = Owner(name="Condomínio Gravito 18", nif="900000001", email="owner@ex.pt")
    db.add(owner)
    db.flush()
    a, b = maintenance_companies
    elevators = [
        Elevator(
            internal_reference=reference,
            owner_id=owner.id,
            maintenance_company_id=company.id,
            address=address,
            postal_code="3810-000",
            parish="Glória e Vera Cruz",
            service_date=date(2020, 1, 1),
        )
        for reference, address, company in [
            ("01.05.0203", "Rua do Gravito 18", a),
            ("01.05.0154", "Avenida Lourenço Peixinho 50", a),
            ("01.05.0112", "Rua de Viseu 30", b),
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
    db: Session, inspection_company: InspectionCompany, elevators: list[Elevator]
) -> list[InspectionRequest]:
    gravito, peixinho, viseu = elevators
    company = inspection_company
    requests = [
        make_request(
            db,
            "2026/0341",
            peixinho,
            company,
            RequestStatus.SCHEDULED,
            datetime(2026, 10, 2),
            datetime(2026, 11, 19, 10, 0),
        ),
        make_request(db, "2026/0377", gravito, company, submitted_at=datetime(2026, 10, 8)),
        make_request(
            db,
            "2025/0118",
            gravito,
            company,
            RequestStatus.COMPLETED,
            datetime(2025, 1, 14),
            datetime(2025, 3, 3, 10, 0),
        ),
        # The other maintenance company's elevator.
        make_request(db, "2026/0400", viseu, company, submitted_at=datetime(2026, 10, 5)),
    ]
    db.add(
        Inspection(
            request_id=requests[2].id,
            performed_date=date(2025, 3, 3),
            result=InspectionResult.FAILED,
            correction_deadline=date(2025, 4, 2),
            nonconformities="Iluminação da cabina insuficiente.",
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


@pytest.mark.parametrize("role", [UserRole.OWNER, UserRole.URBAN_PLANNING, UserRole.INSPECTION])
def test_other_profiles_may_not_see_it(client: TestClient, db: Session, requests, role):
    db.add(User(external_id="other", name="other", email="other@ex.pt", role=role))
    db.flush()

    assert client.get(URL, headers={"X-User-Id": "other"}).status_code == 403


def test_a_maintenance_company_only_sees_its_elevators(client: TestClient, requests):
    assert numbers(client.get(URL, headers=MAINTENANCE_A)) == [
        "2026/0377",
        "2026/0341",
        "2025/0118",
    ]
    assert numbers(client.get(URL, headers=MAINTENANCE_B)) == ["2026/0400"]


def test_the_municipal_manager_sees_every_request(client: TestClient, requests):
    assert numbers(client.get(URL, headers=MANAGER)) == [
        "2026/0400",
        "2026/0377",
        "2026/0341",
        "2025/0118",
    ]


def test_returns_where_the_request_stands_and_who_handles_it(client: TestClient, requests):
    scheduled = client.get(URL, headers=MAINTENANCE_A).json()[1]

    assert scheduled["status"] == "scheduled"
    assert scheduled["type"] == "periodic"
    assert scheduled["submitted_at"] == "2026-10-02T00:00:00"
    assert scheduled["scheduled_at"] == "2026-11-19T10:00:00"
    assert scheduled["inspection"] is None
    assert scheduled["inspection_company"] == {
        "name": "Inspeave, Lda.",
        "phone": "234111111",
        "email": "geral@inspeave.pt",
    }
    assert scheduled["elevator"]["internal_reference"] == "01.05.0154"
    assert scheduled["elevator"]["address"] == "Avenida Lourenço Peixinho 50"
    assert scheduled["elevator"]["maintenance_company"]["name"] == "Elevar, Lda."
    assert isinstance(scheduled["elevator"]["id"], int)
    assert "owner" not in str(scheduled)


def test_a_completed_request_has_its_result(client: TestClient, requests):
    completed = client.get(URL, headers=MAINTENANCE_A).json()[2]

    assert completed["status"] == "completed"
    assert completed["inspection"] == {
        "performed_date": "2025-03-03",
        "result": "failed",
        "valid_until": None,
        "correction_deadline": "2025-04-02",
    }


@pytest.mark.parametrize(
    ("headers", "status", "expected"),
    [
        (MAINTENANCE_A, "awaiting_scheduling", ["2026/0377"]),
        (MAINTENANCE_A, "scheduled", ["2026/0341"]),
        (MAINTENANCE_A, "completed", ["2025/0118"]),
        (MANAGER, "awaiting_scheduling", ["2026/0400", "2026/0377"]),
    ],
)
def test_filters_by_status(client: TestClient, requests, headers, status, expected):
    assert numbers(client.get(URL, headers=headers, params={"status": status})) == expected


def test_rejects_an_unknown_status(client: TestClient, requests):
    assert client.get(URL, headers=MANAGER, params={"status": "lost"}).status_code == 422


@pytest.mark.parametrize(
    ("headers", "text", "expected"),
    [
        (MAINTENANCE_A, "2026/03", ["2026/0377", "2026/0341"]),  # Process number
        (MAINTENANCE_A, "01.05.0203", ["2026/0377", "2025/0118"]),  # Internal reference
        (MAINTENANCE_A, " lourenço ", ["2026/0341"]),  # Address, any case, spaces ignored
        (MAINTENANCE_A, "viseu", []),  # Another maintenance company's elevator
        (MANAGER, "viseu", ["2026/0400"]),
        (MANAGER, "_", []),  # Searched for, not a wildcard
    ],
)
def test_searches_by_text(client: TestClient, requests, headers, text, expected):
    assert numbers(client.get(URL, headers=headers, params={"q": text})) == expected


def test_empty_list(client: TestClient, maintenance_companies):
    assert numbers(client.get(URL, headers=MAINTENANCE_A)) == []
    assert numbers(client.get(URL, headers=MANAGER)) == []


def test_a_maintenance_user_without_a_company_sees_nothing(
    client: TestClient, db: Session, requests
):
    db.add(User(external_id="new", name="new", email="new@ex.pt", role=UserRole.MAINTENANCE))
    db.flush()

    assert numbers(client.get(URL, headers={"X-User-Id": "new"})) == []


def test_the_service_gives_other_profiles_nothing(db: Session, requests):
    from api.inspections import service

    owner = User(external_id="o", name="o", email="o@ex.pt", role=UserRole.OWNER)

    assert service.list_requests(db, owner) == []
