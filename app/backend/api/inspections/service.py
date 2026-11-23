"""Inspection requests as each profile sees them, and scheduling them."""

from datetime import datetime

from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.inspections import repository
from api.inspections.models import InspectionRequest, RequestStatus


class RequestNotFound(Exception):
    """No such request, or it belongs to another inspection company."""


class RequestNotSchedulable(Exception):
    """The request is no longer awaiting scheduling."""


class ScheduleInPast(Exception):
    """The date and time chosen have already passed."""


def list_assigned_requests(
    db: Session, user: User, status: RequestStatus | None = None, text: str | None = None
) -> list[InspectionRequest]:
    """Only the requests assigned to the user's own company, never another company's.

    A user without a company (an account not set up yet) sees none.
    """
    if user.inspection_company_id is None:
        return []
    return repository.list_requests(
        db, inspection_company_id=user.inspection_company_id, status=status, text=_clean(text)
    )


def list_requests(
    db: Session,
    user: User,
    status: RequestStatus | None = None,
    text: str | None = None,
    only_open: bool = False,
) -> list[InspectionRequest]:
    """The requests whose status the user follows (Check Request / Inspection Status).

    A maintenance company sees the ones for the elevators it maintains, the municipal manager
    all of them. Anyone else, or a maintenance user without a company, sees none.
    only_open leaves out the completed ones, which stay in each elevator's history.
    """
    if user.role == UserRole.MUNICIPAL_MANAGER:
        scope = {}
    elif user.role == UserRole.MAINTENANCE and user.maintenance_company_id is not None:
        scope = {"maintenance_company_id": user.maintenance_company_id}
    else:
        return []
    return repository.list_requests(
        db,
        **scope,
        status=status,
        only_open=only_open,
        text=_clean(text),
        with_inspection_company=True,
    )


def schedule_request(
    db: Session, user: User, request_id: int, scheduled_at: datetime, now: datetime
) -> InspectionRequest:
    """Set the date and time of a request awaiting scheduling (Schedule Inspections).

    Only the inspection company the request is assigned to can schedule it. Another company's
    request is reported as not found, so its existence is not revealed. Rescheduling is out of
    scope for now: a request already scheduled or completed is refused. now is Aveiro's local
    time, without a time zone, like scheduled_at.
    """
    request = repository.get_request_for_update(db, request_id)
    if (
        request is None
        or user.inspection_company_id is None
        or request.inspection_company_id != user.inspection_company_id
    ):
        raise RequestNotFound
    if request.status != RequestStatus.AWAITING_SCHEDULING:
        raise RequestNotSchedulable
    if scheduled_at < now:
        raise ScheduleInPast

    request.scheduled_at = scheduled_at
    request.status = RequestStatus.SCHEDULED
    db.commit()
    return request


def _clean(text: str | None) -> str | None:
    return text.strip() if text else None
