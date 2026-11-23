"""Schedule Inspections: the inspection company sets the date of a request (ELEV-52)."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from api.accounts.models import InspectionCompany, MaintenanceCompany, Owner, User, UserRole
from api.elevators.models import Elevator, EquipmentType
from api.inspections.models import InspectionRequest, RequestStatus, RequestType

COMPANY_A = {"X-User-Id": "inspection-a"}
COMPANY_B = {"X-User-Id": "inspection-b"}
NO_COMPANY = {"X-User-Id": "inspection-none"}
MAINTENANCE = {"X-User-Id": "maintenance"}
MANAGER = {"X-User-Id": "manager"}

FUTURE = "2030-12-02T10:00"
PAST = "2020-01-01T10:00"
LISBON = ZoneInfo("Europe/Lisbon")


def url(request: InspectionRequest) -> str:
    return f"/api/inspections/requests/{request.id}/schedule"


@dataclass
class Requests:
    awaiting: InspectionRequest
    scheduled: InspectionRequest
    completed: InspectionRequest
    other: InspectionRequest


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
            user("manager", UserRole.MUNICIPAL_MANAGER),
        ]
    )
    elevator = Elevator(
        internal_reference="01.05.0203",
        owner_id=owner.id,
        maintenance_company_id=maintenance.id,
        address="Rua do Gravito 18",
        postal_code="3810-000",
        parish="Glória e Vera Cruz",
        service_date=date(2020, 1, 1),
    )
    db.add(elevator)
    db.flush()

    def request(
        number: str,
        company: InspectionCompany,
        status: RequestStatus = RequestStatus.AWAITING_SCHEDULING,
        scheduled_at: datetime | None = None,
    ) -> InspectionRequest:
        return InspectionRequest(
            process_number=number,
            elevator_id=elevator.id,
            inspection_company_id=company.id,
            type=RequestType.PERIODIC,
            equipment_type=EquipmentType.ELEVATOR,
            status=status,
            submitted_at=datetime(2026, 10, 1),
            scheduled_at=scheduled_at,
        )

    requests = Requests(
        awaiting=request("2026/0377", a),
        scheduled=request("2026/0341", a, RequestStatus.SCHEDULED, datetime(2026, 11, 19, 10)),
        completed=request("2025/0118", a, RequestStatus.COMPLETED, datetime(2025, 3, 3, 10)),
        other=request("2026/0400", b),
    )
    db.add_all([requests.awaiting, requests.scheduled, requests.completed, requests.other])
    db.flush()
    return requests


def schedule(client: TestClient, request: InspectionRequest, when: str, headers: dict):
    return client.post(url(request), json={"scheduled_at": when}, headers=headers)


def assert_unchanged(
    db: Session, request: InspectionRequest, status: RequestStatus, at: datetime | None
):
    db.refresh(request)
    assert (request.status, request.scheduled_at) == (status, at)


def test_schedules_an_awaiting_request(client: TestClient, db: Session, requests: Requests):
    response = schedule(client, requests.awaiting, FUTURE, COMPANY_A)

    assert response.status_code == 200
    body = response.json()
    assert body["process_number"] == "2026/0377"
    assert body["status"] == "scheduled"
    assert body["scheduled_at"] == "2030-12-02T10:00:00"
    assert_unchanged(db, requests.awaiting, RequestStatus.SCHEDULED, datetime(2030, 12, 2, 10))


def test_the_manager_sees_the_new_date(client: TestClient, requests: Requests):
    schedule(client, requests.awaiting, FUTURE, COMPANY_A)

    listed = client.get("/api/inspections/requests", headers=MANAGER).json()
    row = next(r for r in listed if r["id"] == requests.awaiting.id)
    assert (row["status"], row["scheduled_at"]) == ("scheduled", "2030-12-02T10:00:00")


def test_another_companys_request_is_not_found(client: TestClient, db: Session, requests: Requests):
    assert schedule(client, requests.awaiting, FUTURE, COMPANY_B).status_code == 404
    assert_unchanged(db, requests.awaiting, RequestStatus.AWAITING_SCHEDULING, None)


def test_a_missing_request_is_not_found(client: TestClient, requests: Requests):
    response = client.post(
        "/api/inspections/requests/999999/schedule",
        json={"scheduled_at": FUTURE},
        headers=COMPANY_A,
    )
    assert response.status_code == 404


def test_a_user_without_company_gets_not_found(client: TestClient, requests: Requests):
    assert schedule(client, requests.awaiting, FUTURE, NO_COMPANY).status_code == 404


def test_an_already_scheduled_request_is_refused(
    client: TestClient, db: Session, requests: Requests
):
    assert schedule(client, requests.scheduled, FUTURE, COMPANY_A).status_code == 409
    assert_unchanged(db, requests.scheduled, RequestStatus.SCHEDULED, datetime(2026, 11, 19, 10))


def test_a_completed_request_is_refused(client: TestClient, requests: Requests):
    assert schedule(client, requests.completed, FUTURE, COMPANY_A).status_code == 409


def test_a_date_in_the_past_is_refused(client: TestClient, db: Session, requests: Requests):
    assert schedule(client, requests.awaiting, PAST, COMPANY_A).status_code == 422
    assert_unchanged(db, requests.awaiting, RequestStatus.AWAITING_SCHEDULING, None)


def test_an_hour_already_gone_today_is_refused(client: TestClient, requests: Requests):
    an_hour_ago = datetime.now(LISBON).replace(tzinfo=None) - timedelta(hours=1)

    response = schedule(client, requests.awaiting, an_hour_ago.isoformat(), COMPANY_A)
    assert response.status_code == 422


def test_a_date_with_zone_is_stored_in_lisbon_time(client: TestClient, requests: Requests):
    # In July Lisbon is one hour ahead of UTC.
    response = schedule(client, requests.awaiting, "2030-07-01T09:00:00Z", COMPANY_A)

    assert response.status_code == 200
    assert response.json()["scheduled_at"] == "2030-07-01T10:00:00"


def test_only_the_inspection_company_can_schedule(client: TestClient, requests: Requests):
    assert schedule(client, requests.awaiting, FUTURE, MAINTENANCE).status_code == 403


def test_a_missing_date_is_refused(client: TestClient, requests: Requests):
    response = client.post(url(requests.awaiting), json={}, headers=COMPANY_A)
    assert response.status_code == 422
