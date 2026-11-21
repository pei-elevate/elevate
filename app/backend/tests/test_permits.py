from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.accounts.models import MaintenanceCompany, Owner, User, UserRole
from api.elevators.models import Elevator, RegistrationStatus
from api.notices.models import Notice, NoticeType
from api.permits.models import Permit
from api.permits.service import permit_counts


def add_user(db: Session, role: UserRole) -> dict[str, str]:
    db.add(User(external_id=role.value, name=role.value, email=f"{role.value}@ex.pt", role=role))
    db.flush()
    return {"X-User-Id": role.value}


def test_lists_the_permits_newest_first(client: TestClient, db: Session):
    headers = add_user(db, UserRole.MUNICIPAL_MANAGER)
    planner = add_user(db, UserRole.URBAN_PLANNING)
    creator = db.query(User).filter_by(role=UserRole.URBAN_PLANNING).one()
    owner = Owner(name="Condomínio Viseu 30", nif="900000001", email="a@ex.pt")
    db.add(owner)
    db.flush()
    db.add_all(
        Permit(
            created_by=creator.id,
            owner_id=owner.id,
            permit_number=number,
            permit_date=permit_date,
            address="Rua de Viseu 30",
            postal_code="3810-000",
            parish="Glória e Vera Cruz",
            num_elevators=1,
        )
        for number, permit_date in [
            ("097/2026", date(2026, 9, 11)),
            ("118/2026", date(2026, 10, 7)),
        ]
    )
    db.flush()

    for user in [headers, planner]:
        response = client.get("/api/permits", headers=user)

        assert response.status_code == 200
        assert [p["permit_number"] for p in response.json()] == ["118/2026", "097/2026"]


def test_other_roles_cannot_list_permits(client: TestClient, db: Session):
    for role in [UserRole.OWNER, UserRole.MAINTENANCE, UserRole.INSPECTION]:
        assert client.get("/api/permits", headers=add_user(db, role)).status_code == 403


def add_permit(db: Session, number: str, num_elevators: int = 1) -> Permit:
    creator = db.query(User).filter_by(role=UserRole.URBAN_PLANNING).one_or_none()
    if creator is None:
        add_user(db, UserRole.URBAN_PLANNING)
        creator = db.query(User).filter_by(role=UserRole.URBAN_PLANNING).one()
    nif = "9" + number.replace("/", "").rjust(8, "0")  # 097/2026 gives 900972026
    owner = Owner(name="Condomínio Viseu 30", nif=nif, email="a@ex.pt")
    db.add(owner)
    db.flush()
    permit = Permit(
        created_by=creator.id,
        owner_id=owner.id,
        permit_number=number,
        permit_date=date(2026, 9, 11),
        address="Rua de Viseu 30",
        postal_code="3810-000",
        parish="Glória e Vera Cruz",
        num_elevators=num_elevators,
    )
    db.add(permit)
    db.flush()
    return permit


def add_linked_elevator(db: Session, permit: Permit, status: RegistrationStatus) -> Elevator:
    company = MaintenanceCompany(name="Elevar, Lda.")
    db.add(company)
    db.flush()
    elevator = Elevator(
        owner_id=permit.owner_id,
        maintenance_company_id=company.id,
        permit_id=permit.id,
        address=permit.address,
        postal_code=permit.postal_code,
        parish=permit.parish,
        service_date=date(2026, 10, 1),
        registration_status=status,
    )
    db.add(elevator)
    db.flush()
    return elevator


def add_notice(db: Session, permit: Permit, type_: NoticeType, created_at: datetime) -> None:
    db.add(
        Notice(
            type=type_,
            permit_id=permit.id,
            subject="Elevador sem registo",
            body="...",
            recipients="Condomínio Viseu 30 <a@ex.pt>",
            created_at=created_at,
        )
    )
    db.flush()


@pytest.mark.parametrize(
    ("num", "registered", "pending", "expected"),
    [
        (2, 0, 0, (2, "missing")),
        (2, 1, 0, (1, "missing")),
        (2, 1, 1, (0, "pending")),
        (1, 0, 1, (0, "pending")),
        (2, 2, 0, (0, "registered")),
        (1, 3, 0, (0, "registered")),
    ],
)
def test_permit_counts(num, registered, pending, expected):
    assert permit_counts(num, registered, pending) == expected


def test_lists_counts_and_status_from_the_linked_elevators(client: TestClient, db: Session):
    manager = add_user(db, UserRole.MUNICIPAL_MANAGER)
    permit = add_permit(db, "097/2026", num_elevators=3)
    for status in [
        RegistrationStatus.APPROVED,
        RegistrationStatus.PENDING_APPROVAL,
        RegistrationStatus.REJECTED,
    ]:
        add_linked_elevator(db, permit, status)
    # Notices must not multiply the elevator counts.
    add_notice(db, permit, NoticeType.MISSING_REGISTRATION, datetime(2026, 9, 28, 10, 0))
    add_notice(db, permit, NoticeType.MISSING_REGISTRATION, datetime(2026, 10, 5, 10, 0))

    [p] = client.get("/api/permits", headers=manager).json()

    assert (p["registered"], p["pending"], p["missing"], p["status"]) == (1, 1, 1, "missing")
    assert p["owner_name"] == "Condomínio Viseu 30"
    assert p["parish"] == "Glória e Vera Cruz" and p["postal_code"] == "3810-000"


def test_last_alert_is_the_newest_missing_registration_notice(client: TestClient, db: Session):
    manager = add_user(db, UserRole.MUNICIPAL_MANAGER)
    permit = add_permit(db, "097/2026")
    add_notice(db, permit, NoticeType.MISSING_REGISTRATION, datetime(2026, 9, 28, 10, 0))
    add_notice(db, permit, NoticeType.MISSING_REGISTRATION, datetime(2026, 10, 5, 10, 0))
    add_notice(db, permit, NoticeType.INSPECTION_DUE, datetime(2026, 11, 1, 10, 0))

    [p] = client.get("/api/permits", headers=manager).json()

    assert p["last_alert_at"].startswith("2026-10-05")


def test_a_permit_without_alerts_or_elevators(client: TestClient, db: Session):
    manager = add_user(db, UserRole.MUNICIPAL_MANAGER)
    add_permit(db, "097/2026")

    [p] = client.get("/api/permits", headers=manager).json()

    assert p["last_alert_at"] is None and p["status"] == "missing" and p["missing"] == 1


BODY = {
    "permit_number": "200/2026",
    "permit_date": "2026-11-02",
    "address": "Rua Nova 1",
    "postal_code": "3800-100",
    "parish": "Esgueira",
    "num_elevators": 2,
    "owner_name": "Condomínio Rua Nova",
    "owner_nif": "900000099",
    "owner_email": "rua.nova@ex.pt",
    "owner_phone": None,
}


def test_creates_a_permit_waiting_for_registration(client: TestClient, db: Session):
    urban = add_user(db, UserRole.URBAN_PLANNING)
    manager = add_user(db, UserRole.MUNICIPAL_MANAGER)

    response = client.post("/api/permits", headers=urban, json=BODY)

    assert response.status_code == 201
    body = response.json()
    assert (body["status"], body["missing"], body["registered"], body["pending"]) == (
        "missing",
        2,
        0,
        0,
    )
    assert body["owner_name"] == "Condomínio Rua Nova"
    assert body["last_alert_at"] is None
    permit = db.scalar(select(Permit).where(Permit.permit_number == "200/2026"))
    creator = db.query(User).filter_by(role=UserRole.URBAN_PLANNING).one()
    assert permit.created_by == creator.id and permit.maintenance_company_id is None
    owner = db.get(Owner, permit.owner_id)
    assert (owner.type, owner.email, owner.phone) == (None, "rua.nova@ex.pt", None)
    listed = client.get("/api/permits", headers=manager).json()
    assert [p["permit_number"] for p in listed] == ["200/2026"]


def test_reuses_the_owner_with_the_same_nif_without_changing_it(client: TestClient, db: Session):
    urban = add_user(db, UserRole.URBAN_PLANNING)
    existing = Owner(name="Nome antigo", nif="900000099", email="antigo@ex.pt")
    db.add(existing)
    db.flush()

    response = client.post(
        "/api/permits",
        headers=urban,
        json=BODY | {"owner_name": "Outro", "owner_email": "x@ex.pt", "owner_phone": "912345678"},
    )

    assert response.status_code == 201
    assert response.json()["owner_name"] == "Nome antigo"
    assert db.scalar(select(func.count()).select_from(Owner).where(Owner.nif == "900000099")) == 1
    db.refresh(existing)
    assert (existing.name, existing.email, existing.phone) == ("Nome antigo", "antigo@ex.pt", None)
    permit = db.scalar(select(Permit).where(Permit.permit_number == "200/2026"))
    assert permit.owner_id == existing.id


def test_a_repeated_number_is_a_conflict_and_creates_nothing(client: TestClient, db: Session):
    urban = add_user(db, UserRole.URBAN_PLANNING)
    client.post("/api/permits", headers=urban, json=BODY)

    response = client.post(
        "/api/permits",
        headers=urban,
        json=BODY | {"permit_number": " 200/2026 ", "owner_nif": "900000098"},
    )

    assert response.status_code == 409
    assert db.scalar(select(Owner).where(Owner.nif == "900000098")) is None
    count = select(func.count()).select_from(Permit).where(Permit.permit_number == "200/2026")
    assert db.scalar(count) == 1


def test_strips_whitespace(client: TestClient, db: Session):
    urban = add_user(db, UserRole.URBAN_PLANNING)

    response = client.post(
        "/api/permits",
        headers=urban,
        json=BODY
        | {"permit_number": " 200/2026 ", "address": "  Rua Nova 1  ", "owner_phone": "  "},
    )

    assert response.status_code == 201
    assert response.json()["address"] == "Rua Nova 1"
    assert response.json()["permit_number"] == "200/2026"
    assert db.scalar(select(Owner.phone).where(Owner.nif == "900000099")) is None


@pytest.mark.parametrize(
    "change",
    [
        {"owner_nif": "12345678"},
        {"postal_code": "3800100"},
        {"owner_email": "a@b"},
        {"permit_date": (date.today() + timedelta(days=1)).isoformat()},
        {"num_elevators": 0},
        {"address": "   "},
        {"permit_number": ""},
        {"parish": ""},
        {"owner_name": " "},
    ],
)
def test_invalid_data_is_rejected(client: TestClient, db: Session, change: dict):
    urban = add_user(db, UserRole.URBAN_PLANNING)

    assert client.post("/api/permits", headers=urban, json=BODY | change).status_code == 422


@pytest.mark.parametrize("role", [r for r in UserRole if r != UserRole.URBAN_PLANNING])
def test_only_urban_planning_creates(client: TestClient, db: Session, role: UserRole):
    assert client.post("/api/permits", headers=add_user(db, role), json=BODY).status_code == 403


def test_creating_requires_a_user(client: TestClient):
    assert client.post("/api/permits", json=BODY).status_code == 401
