from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.auth import require_role
from api.database import get_db
from api.permits import service
from api.permits.schemas import NewPermit, PermitOut

router = APIRouter(prefix="/permits", tags=["permits"])

Db = Annotated[Session, Depends(get_db)]
# The municipal manager picks from these the permit a registration matches.
Reader = Annotated[User, Depends(require_role(UserRole.MUNICIPAL_MANAGER, UserRole.URBAN_PLANNING))]
UrbanPlanning = Annotated[User, Depends(require_role(UserRole.URBAN_PLANNING))]


@contextmanager
def http_errors() -> Iterator[None]:
    """Turn the service's errors into HTTP responses."""
    try:
        yield
    except service.PermitNumberTaken:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A permit with this number already exists"
        ) from None


@router.get("", response_model=list[PermitOut])
def list_permits(db: Db, _user: Reader) -> list[PermitOut]:
    return service.list_permits(db)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PermitOut)
def create_permit(db: Db, user: UrbanPlanning, body: NewPermit) -> PermitOut:
    with http_errors():
        return service.create_permit(db, user, body)
