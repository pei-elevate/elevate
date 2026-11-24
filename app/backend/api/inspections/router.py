from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.auth import require_role
from api.database import get_db
from api.inspections import service
from api.inspections.models import InspectionRequest, RequestStatus
from api.inspections.schemas import AssignedRequestOut, RequestStatusOut

router = APIRouter(prefix="/inspections", tags=["inspections"])

Db = Annotated[Session, Depends(get_db)]
InspectionUser = Annotated[User, Depends(require_role(UserRole.INSPECTION))]
Follower = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.MAINTENANCE, UserRole.MUNICIPAL_MANAGER)),
]
Status = Annotated[RequestStatus | None, Query(alias="status")]
Text = Annotated[str | None, Query(max_length=100)]


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
    elevator_id: int | None = None,
) -> list[InspectionRequest]:
    """Requests and their status (Check Request / Inspection Status): an owner's elevators,
    a maintenance company's, or all of them for the municipal manager. open=true leaves out
    the completed ones; elevator_id keeps one elevator's."""
    return service.list_requests(db, user, request_status, q, only_open, elevator_id)
