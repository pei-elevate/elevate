from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.auth import require_role
from api.database import get_db
from api.elevators import views
from api.elevators.schemas import ElevatorSummaryOut

router = APIRouter(prefix="/elevators", tags=["elevators"])

Db = Annotated[Session, Depends(get_db)]
Viewer = Annotated[
    User,
    Depends(require_role(UserRole.OWNER, UserRole.MAINTENANCE, UserRole.MUNICIPAL_MANAGER)),
]


@router.get("", response_model=list[ElevatorSummaryOut])
def list_elevators(db: Db, user: Viewer) -> list[ElevatorSummaryOut]:
    return [ElevatorSummaryOut.from_view(v) for v in views.list_elevators(db, user, date.today())]
