from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session, joinedload

from api.accounts.models import InspectionCompany
from api.elevators.models import Elevator, ReferenceCounter, RegistrationStatus
from api.inspections.models import Inspection, InspectionRequest
from api.notices.models import Notice
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


def list_elevators(
    db: Session, *, owner_id: int | None = None, maintenance_company_id: int | None = None
) -> list[Elevator]:
    """The approved elevators, by internal reference, optionally of one owner or company."""
    query = (
        select(Elevator)
        .options(joinedload(Elevator.owner), joinedload(Elevator.maintenance_company))
        .where(Elevator.registration_status == RegistrationStatus.APPROVED)
        .order_by(Elevator.internal_reference)
    )
    if owner_id is not None:
        query = query.where(Elevator.owner_id == owner_id)
    if maintenance_company_id is not None:
        query = query.where(Elevator.maintenance_company_id == maintenance_company_id)
    return list(db.scalars(query))


def last_inspections(db: Session, elevator_ids: list[int]) -> dict[int, Inspection]:
    """The last completed inspection of each elevator: the most recent performed_date and,
    on the same day, the highest id."""
    query = (
        select(InspectionRequest.elevator_id, Inspection)
        .join(Inspection, Inspection.request_id == InspectionRequest.id)
        .where(InspectionRequest.elevator_id.in_(elevator_ids))
        .ext(distinct_on(InspectionRequest.elevator_id))
        .order_by(
            InspectionRequest.elevator_id, Inspection.performed_date.desc(), Inspection.id.desc()
        )
    )
    return {elevator_id: inspection for elevator_id, inspection in db.execute(query)}


def latest_requests(db: Session, elevator_ids: list[int]) -> dict[int, InspectionRequest]:
    """The most recent inspection request of each elevator, in any status."""
    query = (
        select(InspectionRequest)
        .where(InspectionRequest.elevator_id.in_(elevator_ids))
        .ext(distinct_on(InspectionRequest.elevator_id))
        .order_by(
            InspectionRequest.elevator_id,
            InspectionRequest.submitted_at.desc(),
            InspectionRequest.id.desc(),
        )
    )
    return {request.elevator_id: request for request in db.scalars(query)}


def current_inspection_company(db: Session, today: date) -> InspectionCompany | None:
    """The company with a contract in force; the most recent one if there are several."""
    query = (
        select(InspectionCompany)
        .where(
            InspectionCompany.contract_start <= today,
            or_(InspectionCompany.contract_end.is_(None), InspectionCompany.contract_end >= today),
        )
        .order_by(InspectionCompany.contract_start.desc(), InspectionCompany.id.desc())
        .limit(1)
    )
    return db.scalar(query)


def get_elevator(db: Session, elevator_id: int) -> Elevator | None:
    query = (
        select(Elevator)
        .options(
            joinedload(Elevator.owner),
            joinedload(Elevator.maintenance_company),
            joinedload(Elevator.permit),
        )
        .where(Elevator.id == elevator_id)
    )
    return db.scalar(query)


def list_inspections(db: Session, elevator_id: int) -> list[InspectionRequest]:
    """The elevator's requests that already have an inspection, most recent first."""
    query = (
        select(InspectionRequest)
        .join(Inspection, Inspection.request_id == InspectionRequest.id)
        .options(
            joinedload(InspectionRequest.inspection),
            joinedload(InspectionRequest.inspection_company),
        )
        .where(InspectionRequest.elevator_id == elevator_id)
        .order_by(Inspection.performed_date.desc(), Inspection.id.desc())
    )
    return list(db.scalars(query))


def list_notices(db: Session, elevator_id: int) -> list[Notice]:
    query = (
        select(Notice)
        .where(Notice.elevator_id == elevator_id)
        .order_by(Notice.created_at.desc(), Notice.id.desc())
    )
    return list(db.scalars(query))
