from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from api.elevators.models import Elevator
from api.inspections.models import InspectionRequest, RequestStatus


def list_assigned_requests(
    db: Session,
    inspection_company_id: int,
    status: RequestStatus | None = None,
    text: str | None = None,
) -> list[InspectionRequest]:
    """The company's requests, by status (awaiting scheduling first) and oldest first.

    text matches part of the process number, the internal reference or the address.
    """
    query = (
        select(InspectionRequest)
        .join(InspectionRequest.elevator)
        .options(
            joinedload(InspectionRequest.elevator).joinedload(Elevator.maintenance_company),
            joinedload(InspectionRequest.inspection),
        )
        .where(InspectionRequest.inspection_company_id == inspection_company_id)
        .order_by(InspectionRequest.status, InspectionRequest.submitted_at, InspectionRequest.id)
    )
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
    return list(db.scalars(query))


def _escape_like(text: str) -> str:
    """So that % and _ typed by the user are searched for, not used as wildcards."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
