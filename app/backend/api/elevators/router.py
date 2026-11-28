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
from api.elevators.schemas import (
    ApproveRegistration,
    RegistrationIn,
    RegistrationOut,
    RejectRegistration,
)

router = APIRouter(prefix="/registrations", tags=["registrations"])

Db = Annotated[Session, Depends(get_db)]
MunicipalManager = Annotated[User, Depends(require_role(UserRole.MUNICIPAL_MANAGER))]
Maintenance = Annotated[User, Depends(require_role(UserRole.MAINTENANCE))]
# The manager sees every registration; a maintenance company only the ones it submitted.
Reader = Annotated[User, Depends(require_role(UserRole.MUNICIPAL_MANAGER, UserRole.MAINTENANCE))]


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
    except service.RegistrationNotRejected:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a rejected registration can be corrected"
        ) from None
    except service.DgeNumberTaken:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An elevator with this DGE number already exists"
        ) from None
    except service.PermitNotFound:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Permit not found") from None


def own_company(user: User) -> int:
    """The maintenance company of a maintenance user."""
    if user.maintenance_company_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The account has no maintenance company")
    return user.maintenance_company_id


def company_of(user: User) -> int | None:
    """The company a reader's registrations are limited to; None for the manager."""
    return own_company(user) if user.role == UserRole.MAINTENANCE else None


@router.get("", response_model=list[RegistrationOut])
def list_registrations(
    db: Db,
    user: Reader,
    # Repeat it for several, e.g. ?status=pending_approval&status=rejected.
    statuses: Annotated[list[RegistrationStatus] | None, Query(alias="status")] = None,
) -> list[Elevator]:
    return service.list_registrations(
        db, statuses or [RegistrationStatus.PENDING_APPROVAL], company_of(user)
    )


@router.get("/{registration_id}", response_model=RegistrationOut)
def get_registration(db: Db, user: Reader, registration_id: int) -> Elevator:
    with http_errors():
        return service.get_registration(db, registration_id, company_of(user))


@router.post("", status_code=status.HTTP_201_CREATED, response_model=RegistrationOut)
def submit_registration(db: Db, user: Maintenance, body: RegistrationIn) -> Elevator:
    with http_errors():
        return service.submit(db, own_company(user), body)


@router.put("/{registration_id}", response_model=RegistrationOut)
def resubmit_registration(
    db: Db, user: Maintenance, registration_id: int, body: RegistrationIn
) -> Elevator:
    with http_errors():
        return service.resubmit(db, own_company(user), registration_id, body)


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
