"""Review of elevator registrations by the municipal manager (SCRUM-53)."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from api.accounts.models import MaintenanceCompany, Owner, OwnerType, User, UserRole
from api.elevators.models import Elevator, ReferenceCounter, RegistrationStatus
from api.elevators.service import format_reference
from api.permits.models import Permit

MANAGER = {"X-User-Id": "manager"}


@pytest.fixture
def users(db: Session) -> dict[UserRole, User]:
    users = {
        role: User(external_id=role.value, name=role.value, email=f"{role.value}@ex.pt", role=role)
        for role in UserRole
    }
    users[UserRole.MUNICIPAL_MANAGER].external_id = "manager"
    db.add_all(users.values())
    db.flush()
    return users


@pytest.fixture
def owner(db: Session) -> Owner:
    owner = Owner(
        type=OwnerType.CONDOMINIUM, name="Condomínio Gravito 18", nif="900000001", email="a@ex.pt"
    )
    db.add(owner)
    db.flush()
    return owner


@pytest.fixture
def permits(db: Session, users: dict[UserRole, User], owner: Owner) -> list[Permit]:
    permits = [
        Permit(
            created_by=users[UserRole.URBAN_PLANNING].id,
            owner_id=owner.id,
            permit_number=number,
            permit_date=date(2026, 10, 7),
            address=address,
            postal_code="3810-000",
            parish="Glória e Vera Cruz",
            num_elevators=1,
        )
        for number, address in [("118/2026", "Rua do Gravito 18"), ("097/2026", "Rua de Viseu 30")]
    ]
    db.add_all(permits)
    db.flush()
    return permits


@pytest.fixture
def counter(db: Session) -> ReferenceCounter:
    counter = ReferenceCounter(prefix="01.05", last_number=285)
    db.add(counter)
    db.flush()
    return counter


def make_elevator(db: Session, owner: Owner, **fields) -> Elevator:
    company = MaintenanceCompany(name="Elevar, Lda.")
    db.add(company)
    db.flush()
    elevator = Elevator(
        owner_id=owner.id,
        maintenance_company_id=company.id,
        address="Rua do Gravito 18",
        postal_code="3810-000",
        parish="Glória e Vera Cruz",
        service_date=date(2026, 10, 1),
        **fields,
    )
    db.add(elevator)
    db.flush()
    return elevator


@pytest.fixture
def pending(db: Session, owner: Owner, permits: list[Permit], counter) -> Elevator:
    return make_elevator(db, owner, permit_id=permits[0].id)


# Access


def test_requires_a_user(client: TestClient, pending: Elevator):
    assert client.get("/api/registrations").status_code == 401
    assert client.get("/api/registrations", headers={"X-User-Id": "unknown"}).status_code == 401


@pytest.mark.parametrize("role", [role for role in UserRole if role != UserRole.MUNICIPAL_MANAGER])
def test_only_the_municipal_manager_reviews(client: TestClient, pending: Elevator, role):
    headers = {"X-User-Id": role.value}
    url = f"/api/registrations/{pending.id}"

    assert client.get("/api/registrations", headers=headers).status_code == 403
    assert (
        client.post(f"{url}/approve", headers=headers, json={"permit_id": None}).status_code == 403
    )
    assert client.post(f"{url}/reject", headers=headers, json={"reason": "x"}).status_code == 403


# Listing


def test_lists_the_pending_registrations_with_their_details(
    client: TestClient, db: Session, owner: Owner, pending: Elevator
):
    make_elevator(
        db, owner, internal_reference="01.05.0001", registration_status=RegistrationStatus.APPROVED
    )

    response = client.get("/api/registrations", headers=MANAGER)

    assert response.status_code == 200
    [registration] = response.json()
    assert registration["id"] == pending.id
    assert registration["registration_status"] == "pending_approval"
    assert registration["owner"]["nif"] == "900000001"
    assert registration["maintenance_company"]["name"] == "Elevar, Lda."
    assert registration["permit"]["permit_number"] == "118/2026"


def test_filters_by_status(client: TestClient, db: Session, owner: Owner, pending: Elevator):
    rejected = make_elevator(
        db, owner, registration_status=RegistrationStatus.REJECTED, rejected_reason="NIF"
    )

    response = client.get("/api/registrations?status=rejected", headers=MANAGER)

    assert [r["id"] for r in response.json()] == [rejected.id]


def test_gets_one_registration(client: TestClient, pending: Elevator):
    response = client.get(f"/api/registrations/{pending.id}", headers=MANAGER)

    assert response.status_code == 200
    assert response.json()["address"] == "Rua do Gravito 18"


def test_unknown_registration(client: TestClient, users):
    assert client.get("/api/registrations/999", headers=MANAGER).status_code == 404
    response = client.post(
        "/api/registrations/999/approve", headers=MANAGER, json={"permit_id": None}
    )
    assert response.status_code == 404


# Approval


def test_approval_gives_the_next_internal_reference(
    client: TestClient, db: Session, pending: Elevator, counter: ReferenceCounter
):
    response = client.post(
        f"/api/registrations/{pending.id}/approve",
        headers=MANAGER,
        json={"permit_id": pending.permit_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["registration_status"] == "approved"
    assert body["internal_reference"] == "01.05.0286"
    db.refresh(counter)
    assert counter.last_number == 286


def test_approvals_never_repeat_a_reference(
    client: TestClient, db: Session, owner: Owner, pending: Elevator
):
    other = make_elevator(db, owner)

    references = [
        client.post(
            f"/api/registrations/{elevator.id}/approve", headers=MANAGER, json={"permit_id": None}
        ).json()["internal_reference"]
        for elevator in [pending, other]
    ]

    assert references == ["01.05.0286", "01.05.0287"]


def test_approval_can_link_another_permit(
    client: TestClient, pending: Elevator, permits: list[Permit]
):
    response = client.post(
        f"/api/registrations/{pending.id}/approve",
        headers=MANAGER,
        json={"permit_id": permits[1].id},
    )

    assert response.json()["permit"]["permit_number"] == "097/2026"


def test_approval_can_remove_the_permit(client: TestClient, db: Session, pending: Elevator):
    response = client.post(
        f"/api/registrations/{pending.id}/approve", headers=MANAGER, json={"permit_id": None}
    )

    assert response.json()["permit"] is None
    db.refresh(pending)
    assert pending.permit_id is None


def test_approval_with_an_unknown_permit_changes_nothing(
    client: TestClient, db: Session, pending: Elevator, counter: ReferenceCounter
):
    response = client.post(
        f"/api/registrations/{pending.id}/approve", headers=MANAGER, json={"permit_id": 999}
    )

    assert response.status_code == 422
    db.refresh(pending)
    db.refresh(counter)
    assert pending.registration_status == RegistrationStatus.PENDING_APPROVAL
    assert counter.last_number == 285


def test_approval_clears_the_reason_of_an_earlier_rejection(
    client: TestClient, db: Session, owner: Owner, users, counter
):
    # Corrected and resubmitted by the maintenance company: pending again, with the old reason.
    resubmitted = make_elevator(db, owner, rejected_reason="Falta o contrato de manutenção.")

    response = client.post(
        f"/api/registrations/{resubmitted.id}/approve", headers=MANAGER, json={"permit_id": None}
    )

    assert response.json()["rejected_reason"] is None


# Rejection


def test_rejection_keeps_the_reason(client: TestClient, pending: Elevator):
    response = client.post(
        f"/api/registrations/{pending.id}/reject",
        headers=MANAGER,
        json={"reason": "  O NIF não corresponde ao alvará.  "},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["registration_status"] == "rejected"
    assert body["rejected_reason"] == "O NIF não corresponde ao alvará."
    assert body["internal_reference"] is None


@pytest.mark.parametrize("body", [{}, {"reason": ""}, {"reason": "   "}])
def test_rejection_requires_a_reason(client: TestClient, pending: Elevator, body):
    response = client.post(f"/api/registrations/{pending.id}/reject", headers=MANAGER, json=body)

    assert response.status_code == 422


# Only once


@pytest.mark.parametrize(
    ("action", "body"), [("approve", {"permit_id": None}), ("reject", {"reason": "Outra"})]
)
def test_a_reviewed_registration_cannot_be_reviewed_again(
    client: TestClient, pending: Elevator, action, body
):
    url = f"/api/registrations/{pending.id}"
    client.post(f"{url}/reject", headers=MANAGER, json={"reason": "Morada errada."})

    response = client.post(f"{url}/{action}", headers=MANAGER, json=body)

    assert response.status_code == 409


# Reference format


@pytest.mark.parametrize(
    ("number", "reference"),
    [(79, "01.05.0079"), (286, "01.05.0286"), (9999, "01.05.9999"), (10000, "01.05.10000")],
)
def test_format_reference(number, reference):
    assert format_reference("01.05", number) == reference
