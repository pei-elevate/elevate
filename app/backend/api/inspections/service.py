"""Inspection requests as each profile sees them."""

from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.inspections import repository
from api.inspections.models import InspectionRequest, RequestStatus


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
) -> list[InspectionRequest]:
    """The requests whose status the user follows (Check Request / Inspection Status).

    A maintenance company sees the ones for the elevators it maintains, the municipal manager
    all of them. Anyone else, or a maintenance user without a company, sees none.
    only_open leaves out the completed ones, which stay in each elevator's history.
    """
    if user.role == UserRole.MUNICIPAL_MANAGER:
        scope = {}
    elif user.role == UserRole.MAINTENANCE and user.maintenance_company_id is not None:
        scope = {"maintenance_company_id": user.maintenance_company_id}
    else:
        return []
    return repository.list_requests(
        db,
        **scope,
        status=status,
        only_open=only_open,
        text=_clean(text),
        with_inspection_company=True,
    )


def _clean(text: str | None) -> str | None:
    return text.strip() if text else None
