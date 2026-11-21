"""What each profile sees of the registered elevators (ELEV-54).

Kept apart from service.py, which handles the review of registrations.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from api.accounts.models import InspectionCompany, User, UserRole
from api.elevators import repository
from api.elevators.certificate import certificate_status
from api.elevators.models import CertificateStatus, Elevator
from api.inspections.models import Inspection, InspectionRequest


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
