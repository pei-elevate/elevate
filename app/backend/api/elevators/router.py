from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.auth import require_role
from api.database import get_db
from api.elevators import service
from api.elevators.models import Elevator, RegistrationStatus
from api.elevators.schemas import ApproveRegistration, RegistrationOut, RejectRegistration

router = APIRouter(prefix="/registrations", tags=["registrations"])

Db = Annotated[Session, Depends(get_db)]
MunicipalManager = Annotated[User, Depends(require_role(UserRole.MUNICIPAL_MANAGER))]


@contextmanager
def http_errors() -> Iterator[None]:
    """Turn the service's errors into HTTP responses."""
    try:
        yield
    except service.RegistrationNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registration not found") from None
    except service.RegistrationNotPending:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "The registration was already reviewed"
        ) from None
    except service.PermitNotFound:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Permit not found") from None


@router.get("", response_model=list[RegistrationOut])
def list_registrations(
    db: Db,
    _user: MunicipalManager,
    registration_status: Annotated[RegistrationStatus, Query(alias="status")] = (
        RegistrationStatus.PENDING_APPROVAL
    ),
) -> list[Elevator]:
    return service.list_registrations(db, registration_status)


@router.get("/{registration_id}", response_model=RegistrationOut)
def get_registration(db: Db, _user: MunicipalManager, registration_id: int) -> Elevator:
    with http_errors():
        return service.get_registration(db, registration_id)


@router.post("/{registration_id}/approve", response_model=RegistrationOut)
def approve_registration(
    db: Db, _user: MunicipalManager, registration_id: int, body: ApproveRegistration
) -> Elevator:
    with http_errors():
        return service.approve(db, registration_id, body.permit_id)


@router.post("/{registration_id}/reject", response_model=RegistrationOut)
def reject_registration(
    db: Db, _user: MunicipalManager, registration_id: int, body: RejectRegistration
) -> Elevator:
    with http_errors():
        return service.reject(db, registration_id, body.reason)
