from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.auth import require_role
from api.database import get_db
from api.elevators.schemas import PermitSummary
from api.permits import repository
from api.permits.models import Permit

router = APIRouter(prefix="/permits", tags=["permits"])

Db = Annotated[Session, Depends(get_db)]
# The municipal manager picks from these the permit a registration matches.
Reader = Annotated[User, Depends(require_role(UserRole.MUNICIPAL_MANAGER, UserRole.URBAN_PLANNING))]


@router.get("", response_model=list[PermitSummary])
def list_permits(db: Db, _user: Reader) -> list[Permit]:
    return repository.list_permits(db)
