from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.auth import require_role
from api.database import get_db
from api.inspections import service
from api.inspections.models import InspectionRequest, RequestStatus
from api.inspections.schemas import AssignedRequestOut

router = APIRouter(prefix="/inspections", tags=["inspections"])

Db = Annotated[Session, Depends(get_db)]
InspectionUser = Annotated[User, Depends(require_role(UserRole.INSPECTION))]


@router.get("/assigned", response_model=list[AssignedRequestOut])
def list_assigned(
    db: Db,
    user: InspectionUser,
    request_status: Annotated[RequestStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> list[InspectionRequest]:
    """Requests assigned to the user's inspection company (View Assigned Inspections)."""
    return service.list_assigned_requests(db, user, request_status, q)
