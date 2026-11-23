"""Elevator registrations: submitted by maintenance companies, reviewed by the municipal
manager."""

from sqlalchemy.orm import Session

from api.accounts.models import Owner
from api.elevators import repository
from api.elevators.models import Elevator, RegistrationStatus
from api.elevators.schemas import RegistrationIn

# Prefix of every internal reference in Aveiro, e.g. 01.05.0079.
REFERENCE_PREFIX = "01.05"


class RegistrationNotFound(Exception):
    pass


class RegistrationNotPending(Exception):
    """The registration was already approved or rejected."""


class PermitNotFound(Exception):
    pass


class RegistrationNotRejected(Exception):
    """Only a rejected registration can be corrected and submitted again."""


class DgeNumberTaken(Exception):
    pass


def format_reference(prefix: str, number: int) -> str:
    """01.05 and 79 give 01.05.0079; numbers past 9999 keep all their digits."""
    return f"{prefix}.{number:04d}"


def list_registrations(
    db: Session,
    statuses: list[RegistrationStatus],
    maintenance_company_id: int | None = None,
) -> list[Elevator]:
    """The registrations in the statuses; with a company, only the ones it submitted."""
    return repository.list_registrations(db, statuses, maintenance_company_id)


def get_registration(
    db: Session, elevator_id: int, maintenance_company_id: int | None = None
) -> Elevator:
    """The registration; with a company, another company's one is not found."""
    elevator = repository.get_registration(db, elevator_id)
    if elevator is None or (
        maintenance_company_id is not None
        and elevator.maintenance_company_id != maintenance_company_id
    ):
        raise RegistrationNotFound
    return elevator


def submit(db: Session, maintenance_company_id: int, data: RegistrationIn) -> Elevator:
    """Submit a new elevator for the municipal manager to review."""
    if data.dge_number and repository.dge_number_in_use(db, data.dge_number):
        raise DgeNumberTaken

    elevator = Elevator(maintenance_company_id=maintenance_company_id)
    _fill(db, elevator, data)
    db.add(elevator)
    db.commit()
    return elevator


def resubmit(
    db: Session, maintenance_company_id: int, elevator_id: int, data: RegistrationIn
) -> Elevator:
    """Correct a rejected registration and submit it again. The reason of the rejection is
    kept, so the manager sees what had to be fixed."""
    elevator = repository.lock_registration(db, elevator_id)
    if elevator is None or elevator.maintenance_company_id != maintenance_company_id:
        raise RegistrationNotFound
    if elevator.registration_status != RegistrationStatus.REJECTED:
        raise RegistrationNotRejected
    if data.dge_number and repository.dge_number_in_use(db, data.dge_number, elevator.id):
        raise DgeNumberTaken

    _fill(db, elevator, data)
    elevator.registration_status = RegistrationStatus.PENDING_APPROVAL
    db.commit()
    return elevator


def _fill(db: Session, elevator: Elevator, data: RegistrationIn) -> None:
    """Copy the submitted data, with the owner found by NIF and the permit suggested by the
    address; the manager can still pick another permit when reviewing."""
    elevator.owner = _owner(db, data)
    elevator.permit = repository.find_permit(db, data.address, data.postal_code)
    elevator.address = data.address
    elevator.postal_code = data.postal_code
    elevator.parish = data.parish
    elevator.building = data.building
    elevator.service_date = data.service_date
    elevator.dge_number = data.dge_number
    elevator.registration_document = data.registration_document


def _owner(db: Session, data: RegistrationIn) -> Owner:
    """The owner with the NIF, or a new one.

    An existing owner only gets what it is missing (the permit does not ask for the type):
    its name and email are used by its other elevators and permits, so they are not changed.
    """
    owner = repository.get_owner_by_nif(db, data.owner_nif)
    if owner is None:
        owner = Owner(
            type=data.owner_type,
            name=data.owner_name,
            nif=data.owner_nif,
            email=data.owner_email,
            phone=data.owner_phone,
        )
        db.add(owner)
        return owner

    if owner.type is None:
        owner.type = data.owner_type
    if owner.phone is None:
        owner.phone = data.owner_phone
    return owner


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
    """The registration, locked, if it still awaits a decision."""
    elevator = repository.lock_registration(db, elevator_id)
    if elevator is None:
        raise RegistrationNotFound
    if elevator.registration_status != RegistrationStatus.PENDING_APPROVAL:
        raise RegistrationNotPending
    return elevator
