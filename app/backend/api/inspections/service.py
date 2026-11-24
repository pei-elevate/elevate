"""Inspection requests as each profile sees them, scheduling them and submitting their result."""

from datetime import date, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.elevators import views as elevator_views
from api.inspections import reports, repository
from api.inspections.models import (
    FailedInspectionStatus,
    Inspection,
    InspectionRequest,
    InspectionResult,
    RequestStatus,
)
from api.inspections.schemas import ResultIn


class RequestNotFound(Exception):
    """No such request, or it belongs to another inspection company."""


class RequestNotSchedulable(Exception):
    """The request is no longer awaiting scheduling."""


class ScheduleInPast(Exception):
    """The date and time chosen have already passed."""


class RequestNotCompletable(Exception):
    """The request is not scheduled: still awaiting scheduling, or already completed."""


class PerformedInFuture(Exception):
    """The inspection cannot have been performed after today."""


class ReportMissing(Exception):
    """The inspection names a report whose file is not in the reports folder."""


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
    recent: int | None = None,
) -> list[InspectionRequest]:
    """The requests whose status the user follows (Check Request / Inspection Status).

    An owner sees the ones for their elevators, a maintenance company the ones for the
    elevators it maintains, the municipal manager all of them. Anyone else, or an owner or
    maintenance user without one set up, sees none. only_open leaves out the completed ones,
    which stay in each elevator's history; recent keeps the most recent ones, for the dashboard.
    """
    if user.role == UserRole.MUNICIPAL_MANAGER:
        scope = {}
    elif user.role == UserRole.OWNER and user.owner_id is not None:
        scope = {"owner_id": user.owner_id}
    elif user.role == UserRole.MAINTENANCE and user.maintenance_company_id is not None:
        scope = {"maintenance_company_id": user.maintenance_company_id}
    else:
        return []
    return repository.list_requests(
        db,
        **scope,
        status=status,
        only_open=only_open,
        recent=recent,
        text=_clean(text),
        with_inspection_company=True,
    )


def _own_request(db: Session, user: User, request_id: int) -> InspectionRequest:
    """The request, locked until the transaction ends, if it is assigned to the user's company.

    Another company's request is reported as not found, so its existence is not revealed.
    """
    request = repository.get_request_for_update(db, request_id)
    if (
        request is None
        or user.inspection_company_id is None
        or request.inspection_company_id != user.inspection_company_id
    ):
        raise RequestNotFound
    return request


def schedule_request(
    db: Session, user: User, request_id: int, scheduled_at: datetime, now: datetime
) -> InspectionRequest:
    """Set the date and time of a request awaiting scheduling (Schedule Inspections).

    Only the inspection company the request is assigned to can schedule it. Another company's
    request is reported as not found, so its existence is not revealed. Rescheduling is out of
    scope for now: a request already scheduled or completed is refused. now is Aveiro's local
    time, without a time zone, like scheduled_at.
    """
    request = _own_request(db, user, request_id)
    if request.status != RequestStatus.AWAITING_SCHEDULING:
        raise RequestNotSchedulable
    if scheduled_at < now:
        raise ScheduleInPast

    request.scheduled_at = scheduled_at
    request.status = RequestStatus.SCHEDULED
    db.commit()
    return request


def submit_result(
    db: Session,
    user: User,
    request_id: int,
    data: ResultIn,
    report: bytes,
    report_name: str | None,
    today: date,
) -> InspectionRequest:
    """Record the verdict and the PDF of a scheduled inspection (Submit Inspection Results).

    The request is completed and the inspection enters the elevator's history. A failed one
    starts as action required. Correcting a submitted result is out of scope: a completed
    request is refused, like one still awaiting scheduling.
    """
    request = _own_request(db, user, request_id)
    if request.status != RequestStatus.SCHEDULED:
        raise RequestNotCompletable
    if data.performed_date > today:
        raise PerformedInFuture
    reports.check(report, report_name)

    stored = reports.save(report)
    try:
        db.add(
            Inspection(
                request_id=request.id,
                performed_date=data.performed_date,
                result=data.result,
                valid_until=data.valid_until,
                correction_deadline=data.correction_deadline,
                nonconformities=data.nonconformities,
                failed_status=FailedInspectionStatus.ACTION_REQUIRED
                if data.result == InspectionResult.FAILED
                else None,
                report_file=stored,
            )
        )
        request.status = RequestStatus.COMPLETED
        db.commit()
    except Exception:
        # Without the row, nothing would ever point to the file.
        reports.delete(stored)
        raise
    db.refresh(request)
    return request


def report_of(db: Session, user: User, request_id: int) -> tuple[Path, str]:
    """The PDF of a request's inspection and the name to download it with.

    The inspection company of the request gets it, and so does whoever sees the elevator's
    history: its owner, its maintenance company and the municipal manager. For anyone else, or
    a request without a result yet, the request is reported as not found.
    """
    request = repository.get_request(db, request_id)
    if request is None or request.inspection is None:
        raise RequestNotFound
    if user.role == UserRole.INSPECTION:
        allowed = (
            user.inspection_company_id is not None
            and request.inspection_company_id == user.inspection_company_id
        )
    else:
        allowed = elevator_views.can_see(user, request.elevator)
    if not allowed:
        raise RequestNotFound

    path = reports.path(request.inspection.report_file)
    if not path.is_file():
        raise ReportMissing
    return path, f"relatorio-{request.process_number.replace('/', '-')}.pdf"


def _clean(text: str | None) -> str | None:
    return text.strip() if text else None
