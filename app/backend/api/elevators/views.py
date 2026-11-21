"""What each profile sees of the registered elevators (ELEV-54).

Kept apart from service.py, which handles the review of registrations.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from api.accounts.models import InspectionCompany, User, UserRole
from api.elevators import repository
from api.elevators.certificate import certificate_status
from api.elevators.models import CertificateStatus, Elevator, RegistrationStatus
from api.inspections.models import Inspection, InspectionRequest
from api.notices.models import Notice


class ElevatorNotFound(Exception):
    """The elevator does not exist, is not approved, or the user may not see it."""


@dataclass(frozen=True)
class ElevatorView:
    elevator: Elevator
    last_inspection: Inspection | None
    latest_request: InspectionRequest | None
    inspection_company: InspectionCompany | None
    certificate_status: CertificateStatus


def list_elevators(db: Session, user: User, today: date) -> list[ElevatorView]:
    """The approved elevators the user may see: an owner's own, a maintenance company's
    contract, or all of them for the municipal manager."""
    if user.role == UserRole.OWNER:
        if user.owner_id is None:
            return []
        elevators = repository.list_elevators(db, owner_id=user.owner_id)
    elif user.role == UserRole.MAINTENANCE:
        if user.maintenance_company_id is None:
            return []
        elevators = repository.list_elevators(
            db, maintenance_company_id=user.maintenance_company_id
        )
    elif user.role == UserRole.MUNICIPAL_MANAGER:
        elevators = repository.list_elevators(db)
    else:
        return []
    return _views(db, elevators, today)


def _views(db: Session, elevators: list[Elevator], today: date) -> list[ElevatorView]:
    ids = [elevator.id for elevator in elevators]
    inspections = repository.last_inspections(db, ids) if ids else {}
    requests = repository.latest_requests(db, ids) if ids else {}
    company = repository.current_inspection_company(db, today)
    views = []
    for elevator in elevators:
        inspection = inspections.get(elevator.id)
        status = certificate_status(
            inspection.result if inspection else None,
            inspection.valid_until if inspection else None,
            today,
        )
        views.append(ElevatorView(elevator, inspection, requests.get(elevator.id), company, status))
    return views


def get_elevator(db: Session, user: User, elevator_id: int, today: date) -> ElevatorView:
    return _views(db, [_visible_elevator(db, user, elevator_id)], today)[0]


def list_inspections(db: Session, user: User, elevator_id: int) -> list[InspectionRequest]:
    """The elevator's completed inspections, with the request each one answered."""
    _visible_elevator(db, user, elevator_id)
    return repository.list_inspections(db, elevator_id)


def list_notices(db: Session, user: User, elevator_id: int) -> list[Notice]:
    _visible_elevator(db, user, elevator_id)
    return repository.list_notices(db, elevator_id)


def _visible_elevator(db: Session, user: User, elevator_id: int) -> Elevator:
    """The elevator, if it is approved and within the user's scope. Otherwise the same
    error as an unknown one, so its existence is not revealed."""
    elevator = repository.get_elevator(db, elevator_id)
    if (
        elevator is None
        or elevator.registration_status != RegistrationStatus.APPROVED
        or not _in_scope(user, elevator)
    ):
        raise ElevatorNotFound
    return elevator


def _in_scope(user: User, elevator: Elevator) -> bool:
    if user.role == UserRole.OWNER:
        return user.owner_id is not None and elevator.owner_id == user.owner_id
    if user.role == UserRole.MAINTENANCE:
        return (
            user.maintenance_company_id is not None
            and elevator.maintenance_company_id == user.maintenance_company_id
        )
    return user.role == UserRole.MUNICIPAL_MANAGER
