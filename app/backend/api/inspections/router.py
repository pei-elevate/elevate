from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.auth import require_role
from api.database import get_db
from api.inspections import service
from api.inspections.models import InspectionRequest, RequestStatus
from api.inspections.schemas import (
    LOCAL_TIME,
    AssignedRequestOut,
    RequestStatusOut,
    ScheduleRequest,
)

router = APIRouter(prefix="/inspections", tags=["inspections"])

Db = Annotated[Session, Depends(get_db)]
InspectionUser = Annotated[User, Depends(require_role(UserRole.INSPECTION))]
Follower = Annotated[User, Depends(require_role(UserRole.MAINTENANCE, UserRole.MUNICIPAL_MANAGER))]
Status = Annotated[RequestStatus | None, Query(alias="status")]
Text = Annotated[str | None, Query(max_length=100)]


@contextmanager
def http_errors() -> Iterator[None]:
    """Turn the service's errors into HTTP responses."""
    try:
        yield
    except service.RequestNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inspection request not found") from None
    except service.RequestNotSchedulable:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a request awaiting scheduling can be scheduled"
        ) from None
    except service.ScheduleInPast:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "The inspection cannot be scheduled in the past"
        ) from None


@router.get("/assigned", response_model=list[AssignedRequestOut])
def list_assigned(
    db: Db, user: InspectionUser, request_status: Status = None, q: Text = None
) -> list[InspectionRequest]:
    """Requests assigned to the user's inspection company (View Assigned Inspections)."""
    return service.list_assigned_requests(db, user, request_status, q)


@router.get("/requests", response_model=list[RequestStatusOut])
def list_requests(
    db: Db,
    user: Follower,
    request_status: Status = None,
    q: Text = None,
    only_open: Annotated[bool, Query(alias="open")] = False,
) -> list[InspectionRequest]:
    """Requests and their status: a maintenance company's elevators, or all of them for the
    municipal manager (Check Request / Inspection Status). open=true leaves out the
    completed ones."""
    return service.list_requests(db, user, request_status, q, only_open)


@router.post("/requests/{request_id}/schedule", response_model=AssignedRequestOut)
def schedule_request(
    db: Db, user: InspectionUser, request_id: int, body: ScheduleRequest
) -> InspectionRequest:
    """Set the date and time of a request awaiting scheduling (Schedule Inspections)."""
    now = datetime.now(LOCAL_TIME).replace(tzinfo=None)
    with http_errors():
        return service.schedule_request(db, user, request_id, body.scheduled_at, now)
