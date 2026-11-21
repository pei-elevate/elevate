from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
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
