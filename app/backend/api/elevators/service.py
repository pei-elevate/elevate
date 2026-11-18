"""Review of the elevator registrations submitted by maintenance companies."""

from sqlalchemy.orm import Session

from api.elevators import repository
from api.elevators.models import Elevator, RegistrationStatus

# Prefix of every internal reference in Aveiro, e.g. 01.05.0079.
REFERENCE_PREFIX = "01.05"


class RegistrationNotFound(Exception):
    pass


class RegistrationNotPending(Exception):
    """The registration was already approved or rejected."""


class PermitNotFound(Exception):
    pass


def format_reference(prefix: str, number: int) -> str:
    """01.05 and 79 give 01.05.0079; numbers past 9999 keep all their digits."""
    return f"{prefix}.{number:04d}"


def list_registrations(db: Session, status: RegistrationStatus) -> list[Elevator]:
    return repository.list_registrations(db, status)


def get_registration(db: Session, elevator_id: int) -> Elevator:
    elevator = repository.get_registration(db, elevator_id)
    if elevator is None:
        raise RegistrationNotFound
    return elevator


def approve(db: Session, elevator_id: int, permit_id: int | None) -> Elevator:
    """Approve the registration, link it to the permit it matches and give the elevator
    the next internal reference."""
    elevator = _lock_pending(db, elevator_id)

    permit = None
    if permit_id is not None:
        permit = repository.get_permit(db, permit_id)
        if permit is None:
            raise PermitNotFound

    number = repository.take_next_number(db, REFERENCE_PREFIX)
    if number is None:
        raise RuntimeError(f"reference_counters has no row for the prefix {REFERENCE_PREFIX}")

    elevator.permit = permit
    elevator.internal_reference = format_reference(REFERENCE_PREFIX, number)
    elevator.registration_status = RegistrationStatus.APPROVED
    elevator.rejected_reason = None
    db.commit()
    return elevator


def reject(db: Session, elevator_id: int, reason: str) -> Elevator:
    """Reject the registration; the maintenance company sees the reason and can correct it."""
    elevator = _lock_pending(db, elevator_id)

    elevator.registration_status = RegistrationStatus.REJECTED
    elevator.rejected_reason = reason
    db.commit()
    return elevator


def _lock_pending(db: Session, elevator_id: int) -> Elevator:
    elevator = repository.lock_registration(db, elevator_id)
    if elevator is None:
        raise RegistrationNotFound
    if elevator.registration_status != RegistrationStatus.PENDING_APPROVAL:
        raise RegistrationNotPending
    return elevator
