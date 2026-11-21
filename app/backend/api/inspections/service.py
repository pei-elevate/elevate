"""Inspection requests as the inspection company sees them."""

from sqlalchemy.orm import Session

from api.accounts.models import User
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
    text = text.strip() if text else None
    return repository.list_assigned_requests(db, user.inspection_company_id, status, text)
