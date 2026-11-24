from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from api.elevators.models import Elevator
from api.inspections.models import InspectionRequest, RequestStatus


def list_requests(
    db: Session,
    *,
    inspection_company_id: int | None = None,
    maintenance_company_id: int | None = None,
    owner_id: int | None = None,
    status: RequestStatus | None = None,
    only_open: bool = False,
    text: str | None = None,
    with_inspection_company: bool = False,
    recent: int | None = None,
) -> list[InspectionRequest]:
    """Requests by status (awaiting scheduling first) and oldest first, or, with recent, the
    `recent` most recently submitted, newest first.

    inspection_company_id keeps the ones assigned to that company, maintenance_company_id the
    ones for the elevators it maintains, owner_id the ones for the owner's elevators; with
    none, all of them. only_open leaves out the
    completed ones. text matches part of the process number, the internal reference or the
    address. with_inspection_company also loads the company that handles each request.
    """
    query = (
        select(InspectionRequest)
        .join(InspectionRequest.elevator)
        .options(
            joinedload(InspectionRequest.elevator).joinedload(Elevator.maintenance_company),
            joinedload(InspectionRequest.inspection),
        )
        .order_by(InspectionRequest.status, InspectionRequest.submitted_at, InspectionRequest.id)
    )
    if inspection_company_id is not None:
        query = query.where(InspectionRequest.inspection_company_id == inspection_company_id)
    if maintenance_company_id is not None:
        query = query.where(Elevator.maintenance_company_id == maintenance_company_id)
    if owner_id is not None:
        query = query.where(Elevator.owner_id == owner_id)
    if with_inspection_company:
        query = query.options(joinedload(InspectionRequest.inspection_company))
    if only_open:
        query = query.where(InspectionRequest.status != RequestStatus.COMPLETED)
    if status is not None:
        query = query.where(InspectionRequest.status == status)
    if text:
        pattern = f"%{_escape_like(text)}%"
        query = query.where(
            or_(
                InspectionRequest.process_number.ilike(pattern, escape="\\"),
                Elevator.internal_reference.ilike(pattern, escape="\\"),
                Elevator.address.ilike(pattern, escape="\\"),
            )
        )
    if recent is not None:
        query = (
            query.order_by(None)
            .order_by(InspectionRequest.submitted_at.desc(), InspectionRequest.id.desc())
            .limit(recent)
        )
    return list(db.scalars(query))


def _escape_like(text: str) -> str:
    """So that % and _ typed by the user are searched for, not used as wildcards."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
