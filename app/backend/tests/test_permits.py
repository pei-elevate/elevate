from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from api.accounts.models import Owner, User, UserRole
from api.permits.models import Permit


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
