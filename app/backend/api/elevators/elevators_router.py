from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.auth import require_role
from api.database import get_db
from api.elevators import views
from api.elevators.schemas import (
    ElevatorInspectionOut,
    ElevatorNoticeOut,
    ElevatorOut,
    ElevatorSummaryOut,
)
from api.notices.models import Notice

router = APIRouter(prefix="/elevators", tags=["elevators"])

Db = Annotated[Session, Depends(get_db)]
Viewer = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.MAINTENANCE, UserRole.MUNICIPAL_MANAGER)),
]


@contextmanager
def not_found() -> Iterator[None]:
    """An elevator the user may not see gets the same answer as one that does not exist."""
    try:
        yield
    except views.ElevatorNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Elevator not found") from None


@router.get("", response_model=list[ElevatorSummaryOut])
def list_elevators(db: Db, user: Viewer) -> list[ElevatorSummaryOut]:
    return [ElevatorSummaryOut.from_view(v) for v in views.list_elevators(db, user, date.today())]


@router.get("/{elevator_id}", response_model=ElevatorOut)
def get_elevator(db: Db, user: Viewer, elevator_id: int) -> ElevatorOut:
    with not_found():
        view = views.get_elevator(db, user, elevator_id, date.today())
    return ElevatorOut.from_view(view, include_permit=user.role == UserRole.MUNICIPAL_MANAGER)


@router.get("/{elevator_id}/inspections", response_model=list[ElevatorInspectionOut])
def list_inspections(db: Db, user: Viewer, elevator_id: int) -> list[ElevatorInspectionOut]:
    with not_found():
        requests = views.list_inspections(db, user, elevator_id)
    return [ElevatorInspectionOut.from_request(r) for r in requests]


@router.get("/{elevator_id}/notices", response_model=list[ElevatorNoticeOut])
def list_notices(db: Db, user: Viewer, elevator_id: int) -> list[Notice]:
    with not_found():
        return views.list_notices(db, user, elevator_id)
