from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from api.elevators.models import Elevator, ReferenceCounter, RegistrationStatus
from api.permits.models import Permit


def list_registrations(db: Session, status: RegistrationStatus) -> list[Elevator]:
    query = (
        select(Elevator)
        .options(
            joinedload(Elevator.owner),
            joinedload(Elevator.maintenance_company),
            joinedload(Elevator.permit),
        )
        .where(Elevator.registration_status == status)
        .order_by(Elevator.created_at, Elevator.id)
    )
    return list(db.scalars(query))


def get_registration(db: Session, elevator_id: int) -> Elevator | None:
    return db.get(Elevator, elevator_id)


def lock_registration(db: Session, elevator_id: int) -> Elevator | None:
    """The elevator, locked until the end of the transaction, so two decisions on the same
    registration cannot both go through."""
    return db.get(Elevator, elevator_id, with_for_update=True, populate_existing=True)


def get_permit(db: Session, permit_id: int) -> Permit | None:
    return db.get(Permit, permit_id)


def take_next_number(db: Session, prefix: str) -> int | None:
    """The next number of the prefix, or None if it has no counter.

    The row stays locked until the end of the transaction, so the numbers have no gaps
    and are never repeated.
    """
    counter = db.get(ReferenceCounter, prefix, with_for_update=True, populate_existing=True)
    if counter is None:
        return None
    counter.last_number += 1
    return counter.last_number
