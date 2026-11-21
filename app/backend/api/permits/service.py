"""Use permits (alvarás) logged by Urban Planning and followed up by the municipal manager."""

from datetime import datetime

from sqlalchemy.orm import Session

from api.permits import repository
from api.permits.models import Permit
from api.permits.schemas import PermitOut, PermitStatus


def permit_counts(num_elevators: int, registered: int, pending: int) -> tuple[int, PermitStatus]:
    """How many elevators are still missing, and the permit's status.

    Rejected registrations count as missing. More approved elevators than the permit
    declares still give registered, never a negative count.
    """
    missing = max(num_elevators - registered - pending, 0)
    if registered >= num_elevators:
        return missing, "registered"
    if missing == 0 and pending > 0:
        return missing, "pending"
    return missing, "missing"


def list_permits(db: Session) -> list[PermitOut]:
    return [
        _to_out(row.Permit, row.owner_name, row.registered, row.pending, row.last_alert_at)
        for row in repository.list_permits(db)
    ]


def _to_out(
    permit: Permit,
    owner_name: str,
    registered: int,
    pending: int,
    last_alert_at: datetime | None,
) -> PermitOut:
    missing, status = permit_counts(permit.num_elevators, registered, pending)
    return PermitOut(
        id=permit.id,
        permit_number=permit.permit_number,
        permit_date=permit.permit_date,
        address=permit.address,
        postal_code=permit.postal_code,
        parish=permit.parish,
        num_elevators=permit.num_elevators,
        owner_name=owner_name,
        registered=registered,
        pending=pending,
        missing=missing,
        status=status,
        last_alert_at=last_alert_at,
    )
