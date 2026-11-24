"""View Elevator Information: each profile sees its own elevators (ELEV-54)."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from api.accounts.models import (
    InspectionCompany,
    MaintenanceCompany,
    Owner,
    OwnerType,
    User,
    UserRole,
)
from api.elevators.models import Elevator, EquipmentType, RegistrationStatus
from api.inspections.models import (
    Inspection,
    InspectionRequest,
    InspectionResult,
    RequestStatus,
    RequestType,
)

URL = "/api/elevators"
OWNER_A = {"X-User-Id": "owner-a"}
OWNER_B = {"X-User-Id": "owner-b"}
MAINTENANCE_A = {"X-User-Id": "maintenance-a"}
MANAGER = {"X-User-Id": "manager"}


@dataclass
class World:
    owner_a: Owner
    owner_b: Owner
    maintenance_a: MaintenanceCompany
    maintenance_b: MaintenanceCompany
    users: dict[str, User]
    # By internal reference; the pending one is under "pending".
    elevators: dict[str, Elevator]


@pytest.fixture
def world(db: Session) -> World:
    owner_a = Owner(
        type=OwnerType.CONDOMINIUM,
        name="Condomínio Edifício Ria",
        nif="900000001",
        email="ria@ex.pt",
        phone="234100001",
    )
    owner_b = Owner(
        type=OwnerType.CONDOMINIUM, name="Condomínio Beringela", nif="900000002", email="b@ex.pt"
    )
    maintenance_a = MaintenanceCompany(name="Elevar, Lda.", email="elevar@ex.pt", phone="234000001")
    maintenance_b = MaintenanceCompany(name="Ascende, Lda.", email="ascende@ex.pt")
    db.add_all([owner_a, owner_b, maintenance_a, maintenance_b])
    db.flush()

    users = {
        "owner-a": User(role=UserRole.OWNER, owner_id=owner_a.id),
        "owner-b": User(role=UserRole.OWNER, owner_id=owner_b.id),
        "maintenance-a": User(role=UserRole.MAINTENANCE, maintenance_company_id=maintenance_a.id),
        "manager": User(role=UserRole.MUNICIPAL_MANAGER),
        "urban": User(role=UserRole.URBAN_PLANNING),
        "inspection": User(role=UserRole.INSPECTION),
    }
    for external_id, user in users.items():
        user.external_id = external_id
        user.name = external_id
        user.email = f"{external_id}@ex.pt"
    db.add_all(users.values())

    def elevator(reference, owner, maintenance, status=RegistrationStatus.APPROVED, **fields):
        return Elevator(
            internal_reference=reference,
            owner_id=owner.id,
            maintenance_company_id=maintenance.id,
            address=f"Rua {reference}",
            postal_code="3810-000",
            parish="Glória e Vera Cruz",
            service_date=date(2015, 1, 1),
            registration_status=status,
            **fields,
        )

    elevators = {
        "01.05.0154": elevator("01.05.0154", owner_a, maintenance_a),
        "01.05.0079": elevator(
            "01.05.0079",
            owner_a,
            maintenance_a,
            dge_number="DGE-10079",
            building="Bloco A",
            equipment_type=EquipmentType.ELEVATOR,
        ),
        "01.05.0247": elevator("01.05.0247", owner_b, maintenance_b),
        "01.05.0112": elevator("01.05.0112", owner_b, maintenance_a),
        "pending": elevator(None, owner_a, maintenance_a, RegistrationStatus.PENDING_APPROVAL),
    }
    db.add_all(elevators.values())
    db.flush()
    return World(owner_a, owner_b, maintenance_a, maintenance_b, users, elevators)


@pytest.fixture
def in_force(db: Session) -> InspectionCompany:
    company = InspectionCompany(
        name="Inspeave, Lda.",
        email="inspeave@ex.pt",
        phone="234000003",
        contract_start=date(2025, 1, 1),
    )
    db.add(company)
    db.flush()
    return company


@pytest.fixture
def expired(db: Session) -> InspectionCompany:
    company = InspectionCompany(
        name="Antiga Inspeção, S.A.",
        contract_start=date(2020, 1, 1),
        contract_end=date(2024, 12, 31),
    )
    db.add(company)
    db.flush()
    return company


def make_request(
    db: Session,
    elevator: Elevator,
    number: str,
    company: InspectionCompany,
    submitted: datetime,
    status: RequestStatus = RequestStatus.COMPLETED,
    type_: RequestType = RequestType.PERIODIC,
) -> InspectionRequest:
    request = InspectionRequest(
        process_number=number,
        elevator_id=elevator.id,
        inspection_company_id=company.id,
        type=type_,
        equipment_type=EquipmentType.ELEVATOR,
        status=status,
        submitted_at=submitted,
    )
    db.add(request)
    db.flush()
    return request


def make_inspection(
    db: Session,
    elevator: Elevator,
    number: str,
    company: InspectionCompany,
    performed: date,
    result: InspectionResult,
    valid_until: date | None = None,
    submitted: datetime | None = None,
) -> Inspection:
    request = make_request(
        db, elevator, number, company, submitted or datetime.combine(performed, datetime.min.time())
    )
    inspection = Inspection(
        request_id=request.id,
        performed_date=performed,
        result=result,
        valid_until=valid_until,
        report_file=f"relatorio-{number.replace('/', '-')}.pdf",
    )
    db.add(inspection)
    db.flush()
    return inspection


def references(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [e["internal_reference"] for e in response.json()]


def by_reference(response, reference: str) -> dict:
    assert response.status_code == 200, response.text
    return next(e for e in response.json() if e["internal_reference"] == reference)


# List


def test_owner_sees_only_own_approved_elevators(client: TestClient, world: World):
    assert references(client.get(URL, headers=OWNER_A)) == ["01.05.0079", "01.05.0154"]


def test_maintenance_sees_its_contract(client: TestClient, world: World):
    assert references(client.get(URL, headers=MAINTENANCE_A)) == [
        "01.05.0079",
        "01.05.0112",
        "01.05.0154",
    ]


def test_manager_sees_all_approved(client: TestClient, world: World):
    assert references(client.get(URL, headers=MANAGER)) == [
        "01.05.0079",
        "01.05.0112",
        "01.05.0154",
        "01.05.0247",
    ]


def test_user_without_entity_sees_nothing(client: TestClient, db: Session, world: World):
    db.add(User(external_id="lost", name="lost", email="lost@ex.pt", role=UserRole.OWNER))
    db.flush()
    assert client.get(URL, headers={"X-User-Id": "lost"}).json() == []


@pytest.mark.parametrize("user", ["urban", "inspection"])
def test_other_roles_are_forbidden(client: TestClient, world: World, user):
    assert client.get(URL, headers={"X-User-Id": user}).status_code == 403


def test_requires_a_user(client: TestClient, world: World):
    assert client.get(URL).status_code == 401


def test_summary_fields(client: TestClient, world: World, in_force: InspectionCompany):
    elevator = by_reference(client.get(URL, headers=OWNER_A), "01.05.0079")
    assert elevator["id"] == world.elevators["01.05.0079"].id
    assert elevator["dge_number"] == "DGE-10079"
    assert elevator["address"] == "Rua 01.05.0079"
    assert elevator["postal_code"] == "3810-000"
    assert elevator["parish"] == "Glória e Vera Cruz"
    assert elevator["building"] == "Bloco A"
    assert elevator["owner"] == {"name": "Condomínio Edifício Ria"}
    assert elevator["maintenance_company"] == {"name": "Elevar, Lda."}


def test_status_uses_latest_inspection(
    client: TestClient, db: Session, world: World, in_force: InspectionCompany
):
    elevator = world.elevators["01.05.0079"]
    valid_until = date.today() + timedelta(days=30)
    make_inspection(db, elevator, "2025/0001", in_force, date(2025, 5, 1), InspectionResult.FAILED)
    make_inspection(
        db,
        elevator,
        "2026/0001",
        in_force,
        date(2026, 5, 1),
        InspectionResult.APPROVED,
        valid_until,
    )

    summary = by_reference(client.get(URL, headers=OWNER_A), "01.05.0079")
    assert summary["certificate_status"] == "due_soon"
    assert summary["valid_until"] == valid_until.isoformat()


def test_same_day_inspections_use_highest_id(
    client: TestClient, db: Session, world: World, in_force: InspectionCompany
):
    elevator = world.elevators["01.05.0079"]
    day = date(2026, 5, 1)
    make_inspection(
        db, elevator, "2026/0001", in_force, day, InspectionResult.APPROVED, date(2030, 1, 1)
    )
    make_inspection(db, elevator, "2026/0002", in_force, day, InspectionResult.FAILED)

    summary = by_reference(client.get(URL, headers=OWNER_A), "01.05.0079")
    assert summary["certificate_status"] == "failed"
    assert summary["valid_until"] is None


def test_without_inspections_is_not_inspected(client: TestClient, world: World):
    summary = by_reference(client.get(URL, headers=OWNER_A), "01.05.0154")
    assert summary["certificate_status"] == "not_inspected"
    assert summary["valid_until"] is None
    assert summary["latest_request"] is None


def test_latest_request_is_most_recent_in_any_status(
    client: TestClient, db: Session, world: World, in_force: InspectionCompany
):
    elevator = world.elevators["01.05.0079"]
    make_inspection(
        db,
        elevator,
        "2025/0118",
        in_force,
        date(2025, 3, 3),
        InspectionResult.APPROVED,
        date(2030, 3, 3),
        submitted=datetime(2025, 1, 14),
    )
    make_request(
        db,
        elevator,
        "2026/0341",
        in_force,
        datetime(2026, 10, 2, 9, 30),
        RequestStatus.AWAITING_SCHEDULING,
        RequestType.REINSPECTION,
    )

    summary = by_reference(client.get(URL, headers=OWNER_A), "01.05.0079")
    assert summary["latest_request"] == {
        "process_number": "2026/0341",
        "submitted_at": "2026-10-02T09:30:00",
        "type": "reinspection",
    }
    assert summary["certificate_status"] == "valid"


def test_inspection_company_is_the_one_in_force(
    client: TestClient, world: World, in_force: InspectionCompany, expired: InspectionCompany
):
    summary = by_reference(client.get(URL, headers=OWNER_A), "01.05.0079")
    assert summary["inspection_company"] == {"name": "Inspeave, Lda."}


def test_no_inspection_company_in_force(
    client: TestClient, world: World, expired: InspectionCompany
):
    summary = by_reference(client.get(URL, headers=OWNER_A), "01.05.0079")
    assert summary["inspection_company"] is None


# Detail


@pytest.fixture
def permit(db: Session, world: World):
    from api.permits.models import Permit

    permit = Permit(
        created_by=world.users["urban"].id,
        owner_id=world.owner_a.id,
        permit_number="104/2026",
        permit_date=date(2026, 9, 24),
        address="Rua 01.05.0079",
        postal_code="3810-000",
        parish="Glória e Vera Cruz",
        num_elevators=1,
    )
    db.add(permit)
    db.flush()
    world.elevators["01.05.0079"].permit_id = permit.id
    db.flush()
    return permit


def detail_url(world: World, reference: str) -> str:
    return f"{URL}/{world.elevators[reference].id}"


def test_detail_has_full_data(
    client: TestClient, db: Session, world: World, in_force: InspectionCompany
):
    make_inspection(
        db,
        world.elevators["01.05.0079"],
        "2025/0118",
        in_force,
        date(2025, 3, 3),
        InspectionResult.APPROVED,
        date(2030, 3, 3),
    )
    response = client.get(detail_url(world, "01.05.0079"), headers=OWNER_A)
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail["internal_reference"] == "01.05.0079"
    assert detail["dge_number"] == "DGE-10079"
    assert detail["equipment_type"] == "elevator"
    assert detail["service_date"] == "2015-01-01"
    assert detail["created_at"] is not None
    assert detail["owner"]["nif"] == "900000001"
    assert detail["owner"]["email"] == "ria@ex.pt"
    assert detail["owner"]["type"] == "condominium"
    assert detail["owner"]["phone"] == "234100001"
    assert detail["maintenance_company"] == {
        "name": "Elevar, Lda.",
        "email": "elevar@ex.pt",
        "phone": "234000001",
    }
    assert detail["inspection_company"] == {
        "name": "Inspeave, Lda.",
        "email": "inspeave@ex.pt",
        "phone": "234000003",
    }
    assert detail["last_inspection"] == {"performed_date": "2025-03-03", "result": "approved"}
    assert detail["certificate_status"] == "valid"
    assert detail["valid_until"] == "2030-03-03"


def test_detail_permit_only_for_manager(client: TestClient, world: World, permit):
    url = detail_url(world, "01.05.0079")
    assert client.get(url, headers=MANAGER).json()["permit"]["permit_number"] == "104/2026"
    assert client.get(url, headers=OWNER_A).json()["permit"] is None
    assert client.get(url, headers=MAINTENANCE_A).json()["permit"] is None


def test_detail_of_other_owner_is_404(client: TestClient, world: World):
    response = client.get(detail_url(world, "01.05.0079"), headers=OWNER_B)
    assert response.status_code == 404
    assert response.json() == {"detail": "Elevator not found"}


def test_detail_of_other_maintenance_company_is_404(client: TestClient, world: World):
    response = client.get(detail_url(world, "01.05.0247"), headers=MAINTENANCE_A)
    assert response.status_code == 404


def test_detail_of_pending_is_404(client: TestClient, world: World):
    assert client.get(detail_url(world, "pending"), headers=MANAGER).status_code == 404


def test_detail_unknown_is_404(client: TestClient, world: World):
    assert client.get(f"{URL}/999999", headers=MANAGER).status_code == 404


def test_detail_other_roles_are_forbidden(client: TestClient, world: World):
    url = detail_url(world, "01.05.0079")
    assert client.get(url, headers={"X-User-Id": "urban"}).status_code == 403


# Histories


def test_inspections_only_completed_newest_first(
    client: TestClient,
    db: Session,
    world: World,
    in_force: InspectionCompany,
    expired: InspectionCompany,
):
    elevator = world.elevators["01.05.0079"]
    make_inspection(
        db,
        elevator,
        "2023/0050",
        expired,
        date(2023, 3, 3),
        InspectionResult.FAILED,
        submitted=datetime(2023, 1, 10),
    )
    make_inspection(
        db,
        elevator,
        "2025/0118",
        in_force,
        date(2025, 3, 3),
        InspectionResult.APPROVED,
        date(2027, 3, 3),
        submitted=datetime(2025, 1, 14),
    )
    make_request(
        db,
        elevator,
        "2026/0341",
        in_force,
        datetime(2026, 10, 2),
        RequestStatus.AWAITING_SCHEDULING,
    )
    # Another elevator's inspection never shows up.
    make_inspection(
        db,
        world.elevators["01.05.0154"],
        "2025/0200",
        in_force,
        date(2025, 6, 1),
        InspectionResult.APPROVED,
        date(2027, 6, 1),
    )

    response = client.get(f"{detail_url(world, '01.05.0079')}/inspections", headers=OWNER_A)
    assert response.status_code == 200, response.text
    body = response.json()
    # Each one says which request to download its report from (ELEV-56).
    assert all(isinstance(h.pop("request_id"), int) for h in body)
    assert body == [
        {
            "process_number": "2025/0118",
            "submitted_at": "2025-01-14T00:00:00",
            "type": "periodic",
            "inspection_company": {"name": "Inspeave, Lda."},
            "performed_date": "2025-03-03",
            "result": "approved",
            "valid_until": "2027-03-03",
            "report_file": "relatorio-2025-0118.pdf",
        },
        {
            "process_number": "2023/0050",
            "submitted_at": "2023-01-10T00:00:00",
            "type": "periodic",
            "inspection_company": {"name": "Antiga Inspeção, S.A."},
            "performed_date": "2023-03-03",
            "result": "failed",
            "valid_until": None,
            "report_file": "relatorio-2023-0050.pdf",
        },
    ]


def test_notices_of_the_elevator_newest_first(
    client: TestClient, db: Session, world: World, permit
):
    from api.notices.models import Notice, NoticeType

    elevator = world.elevators["01.05.0079"]

    def notice(type_, subject, created, elevator_id=elevator.id, permit_id=None):
        return Notice(
            type=type_,
            elevator_id=elevator_id,
            permit_id=permit_id,
            subject=subject,
            body=f"Corpo de {subject}",
            recipients="Condomínio Edifício Ria <ria@ex.pt>",
            created_at=created,
        )

    db.add_all(
        [
            notice(NoticeType.INSPECTION_DUE, "Prazo", datetime(2026, 10, 13, 9, 0)),
            notice(NoticeType.INSPECTION_REQUIRED, "Manual", datetime(2026, 11, 2, 11, 30)),
            notice(
                NoticeType.INSPECTION_DUE,
                "Outro elevador",
                datetime(2026, 11, 5),
                world.elevators["01.05.0154"].id,
            ),
            notice(
                NoticeType.MISSING_REGISTRATION,
                "Sem registo",
                datetime(2026, 11, 6),
                None,
                permit.id,
            ),
        ]
    )
    db.flush()

    response = client.get(f"{detail_url(world, '01.05.0079')}/notices", headers=OWNER_A)
    assert response.status_code == 200, response.text
    notices = response.json()
    assert [(n["type"], n["subject"]) for n in notices] == [
        ("inspection_required", "Manual"),
        ("inspection_due", "Prazo"),
    ]
    assert notices[0]["body"] == "Corpo de Manual"
    assert notices[0]["recipients"] == "Condomínio Edifício Ria <ria@ex.pt>"
    assert notices[0]["created_at"] == "2026-11-02T11:30:00"
    assert isinstance(notices[0]["id"], int)


@pytest.mark.parametrize("history", ["inspections", "notices"])
def test_histories_of_other_owner_are_404(client: TestClient, world: World, history):
    response = client.get(f"{detail_url(world, '01.05.0079')}/{history}", headers=OWNER_B)
    assert response.status_code == 404
    assert response.json() == {"detail": "Elevator not found"}


@pytest.mark.parametrize("history", ["inspections", "notices"])
def test_histories_of_pending_are_404(client: TestClient, world: World, history):
    response = client.get(f"{detail_url(world, 'pending')}/{history}", headers=MANAGER)
    assert response.status_code == 404
    assert response.json() == {"detail": "Elevator not found"}
