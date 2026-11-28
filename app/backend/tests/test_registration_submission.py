"""Registration of elevators by their maintenance company (ELEV-49)."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.accounts.models import MaintenanceCompany, Owner, OwnerType, User, UserRole
from api.elevators.models import Elevator, RegistrationStatus
from api.permits.models import Permit

ELEVAR = {"X-User-Id": "elevar"}
ASCENDE = {"X-User-Id": "ascende"}
MANAGER = {"X-User-Id": "manager"}

BODY = {
    "address": "Rua do Gravito 18",
    "postal_code": "3810-000",
    "parish": "Glória e Vera Cruz",
    "building": "Bloco A",
    "service_date": "2026-10-01",
    "dge_number": "DGE-20001",
    "owner_type": "condominium",
    "owner_name": "Condomínio Gravito 18",
    "owner_nif": "900000001",
    "owner_email": "gravito18@ex.pt",
    "owner_phone": "234000000",
    "registration_document": "contrato-manutencao.pdf",
}


@pytest.fixture
def companies(db: Session) -> dict[str, MaintenanceCompany]:
    companies = {
        name: MaintenanceCompany(name=f"{name.title()}, Lda.") for name in ["elevar", "ascende"]
    }
    db.add_all(companies.values())
    db.flush()
    db.add_all(
        User(
            external_id=name,
            name=company.name,
            email=f"{name}@ex.pt",
            role=UserRole.MAINTENANCE,
            maintenance_company_id=company.id,
        )
        for name, company in companies.items()
    )
    db.add(
        User(external_id="manager", name="Gestor", email="m@ex.pt", role=UserRole.MUNICIPAL_MANAGER)
    )
    db.flush()
    return companies


def submit(client: TestClient, headers=ELEVAR, **changes):
    return client.post("/api/registrations", headers=headers, json=BODY | changes)


def reject(client: TestClient, registration_id: int, reason="O NIF não corresponde.") -> None:
    response = client.post(
        f"/api/registrations/{registration_id}/reject", headers=MANAGER, json={"reason": reason}
    )
    assert response.status_code == 200


# Submission


def test_submits_a_registration_for_review(client: TestClient, db: Session, companies):
    response = submit(client)

    assert response.status_code == 201
    body = response.json()
    assert body["registration_status"] == "pending_approval"
    assert body["internal_reference"] is None
    assert body["maintenance_company"]["name"] == "Elevar, Lda."
    assert body["owner"] | {"id": 0} == {
        "id": 0,
        "type": "condominium",
        "name": "Condomínio Gravito 18",
        "nif": "900000001",
        "email": "gravito18@ex.pt",
        "phone": "234000000",
    }
    assert (body["building"], body["dge_number"], body["registration_document"]) == (
        "Bloco A",
        "DGE-20001",
        "contrato-manutencao.pdf",
    )
    # The manager sees it waiting for review.
    pending = client.get("/api/registrations", headers=MANAGER).json()
    assert [r["id"] for r in pending] == [body["id"]]


def test_only_maintenance_companies_submit(client: TestClient, db: Session, companies):
    for role in [UserRole.OWNER, UserRole.URBAN_PLANNING, UserRole.INSPECTION]:
        db.add(User(external_id=role.value, name=role.value, email=f"{role.value}@x.pt", role=role))
    db.flush()

    for headers in [
        MANAGER,
        *({"X-User-Id": r} for r in ["owner", "urban_planning", "inspection"]),
    ]:
        assert submit(client, headers=headers).status_code == 403
    assert client.post("/api/registrations", json=BODY).status_code == 401


def test_an_account_without_a_company_cannot_submit(client: TestClient, db: Session):
    db.add(
        User(external_id="lonely", name="Sem empresa", email="s@ex.pt", role=UserRole.MAINTENANCE)
    )
    db.flush()

    assert submit(client, headers={"X-User-Id": "lonely"}).status_code == 403


def test_an_existing_owner_keeps_its_name_and_email(client: TestClient, db: Session, companies):
    # Created by Urban Planning's permit, which asks neither the type nor always the phone.
    db.add(Owner(name="Condomínio do Gravito", nif="900000001", email="admin@gravito.pt"))
    db.flush()

    owner = submit(client).json()["owner"]

    assert (owner["name"], owner["email"]) == ("Condomínio do Gravito", "admin@gravito.pt")
    assert (owner["type"], owner["phone"]) == ("condominium", "234000000")
    assert db.scalar(select(func.count()).select_from(Owner)) == 1


def test_suggests_the_permit_with_the_same_address(client: TestClient, db: Session, companies):
    planner = User(
        external_id="up", name="Urbanismo", email="u@ex.pt", role=UserRole.URBAN_PLANNING
    )
    owner = Owner(name="Condomínio Gravito 18", nif="900000001", email="a@ex.pt")
    db.add_all([planner, owner])
    db.flush()
    db.add(
        Permit(
            created_by=planner.id,
            owner_id=owner.id,
            permit_number="118/2026",
            permit_date=date(2026, 10, 7),
            address="  rua do gravito 18 ",
            postal_code="3810-000",
            parish="Glória e Vera Cruz",
            num_elevators=1,
        )
    )
    db.flush()

    assert submit(client).json()["permit"]["permit_number"] == "118/2026"
    assert submit(client, dge_number=None, address="Rua do Gravito 20").json()["permit"] is None


@pytest.mark.parametrize(
    "changes",
    [
        {"address": "  "},
        {"postal_code": "3810"},
        {"owner_nif": "12345678"},
        {"owner_email": "sem-arroba.pt"},
        {"owner_type": "company_ltd"},
        {"service_date": str(date.today() + timedelta(days=1))},
    ],
)
def test_rejects_invalid_data(client: TestClient, companies, changes):
    assert submit(client, **changes).status_code == 422


def test_blank_optional_fields_are_left_empty(client: TestClient, companies):
    body = submit(
        client, building=" ", dge_number="", owner_phone="  ", registration_document=""
    ).json()

    assert (body["building"], body["dge_number"], body["registration_document"]) == (None,) * 3
    assert body["owner"]["phone"] is None


def test_a_dge_number_cannot_be_repeated(client: TestClient, companies):
    first = submit(client).json()

    assert submit(client, headers=ASCENDE).status_code == 409

    # A rejected registration frees its number.
    reject(client, first["id"])
    assert submit(client, headers=ASCENDE).status_code == 201


# The company's own registrations


def test_a_company_sees_only_its_registrations(client: TestClient, companies):
    mine = submit(client).json()
    theirs = submit(client, headers=ASCENDE, dge_number=None).json()
    reject(client, mine["id"])
    other = submit(client, dge_number=None, address="Rua de Viseu 30").json()

    url = "/api/registrations?status=pending_approval&status=rejected"
    listed = client.get(url, headers=ELEVAR).json()

    assert [(r["id"], r["registration_status"]) for r in listed] == [
        (mine["id"], "rejected"),
        (other["id"], "pending_approval"),
    ]
    assert listed[0]["rejected_reason"] == "O NIF não corresponde."
    assert client.get(f"/api/registrations/{mine['id']}", headers=ELEVAR).status_code == 200
    assert client.get(f"/api/registrations/{theirs['id']}", headers=ELEVAR).status_code == 404


# Correction after a rejection


def test_a_rejected_registration_is_corrected_and_submitted_again(client: TestClient, companies):
    registration = submit(client).json()
    reject(client, registration["id"])

    response = client.put(
        f"/api/registrations/{registration['id']}",
        headers=ELEVAR,
        json=BODY | {"address": "Rua do Gravito 18A"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == registration["id"]
    assert body["address"] == "Rua do Gravito 18A"
    assert body["registration_status"] == "pending_approval"
    # The manager still sees what had to be fixed.
    assert body["rejected_reason"] == "O NIF não corresponde."


def test_only_a_rejected_registration_can_be_corrected(client: TestClient, companies):
    registration = submit(client).json()

    response = client.put(f"/api/registrations/{registration['id']}", headers=ELEVAR, json=BODY)

    assert response.status_code == 409


def test_another_company_cannot_correct_a_registration(client: TestClient, companies):
    registration = submit(client).json()
    reject(client, registration["id"])

    url = f"/api/registrations/{registration['id']}"
    assert client.put(url, headers=ASCENDE, json=BODY).status_code == 404
    assert client.put("/api/registrations/999", headers=ELEVAR, json=BODY).status_code == 404


def test_the_correction_keeps_its_own_dge_number(client: TestClient, db: Session, companies):
    registration = submit(client).json()
    reject(client, registration["id"])
    submit(client, headers=ASCENDE, dge_number="DGE-30003")

    url = f"/api/registrations/{registration['id']}"
    # Its own number is not a repetition; another elevator's is.
    assert client.put(url, headers=ELEVAR, json=BODY).status_code == 200
    reject(client, registration["id"])
    assert (
        client.put(url, headers=ELEVAR, json=BODY | {"dge_number": "DGE-30003"}).status_code == 409
    )

    elevator = db.get(Elevator, registration["id"])
    db.refresh(elevator)
    assert elevator.registration_status == RegistrationStatus.REJECTED
    assert elevator.dge_number == "DGE-20001"


def test_the_correction_can_change_the_owner(client: TestClient, db: Session, companies):
    registration = submit(client).json()
    reject(client, registration["id"])

    body = client.put(
        f"/api/registrations/{registration['id']}",
        headers=ELEVAR,
        json=BODY | {"owner_nif": "900000002", "owner_type": "individual"},
    ).json()

    assert body["owner"]["nif"] == "900000002"
    assert body["owner"]["type"] == OwnerType.INDIVIDUAL.value
