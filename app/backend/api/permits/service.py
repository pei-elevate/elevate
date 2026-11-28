"""Use permits (alvarás) logged by Urban Planning and followed up by the municipal manager."""

from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.accounts.models import Owner, User
from api.permits import repository
from api.permits.models import Permit
from api.permits.schemas import NewPermit, PermitOut, PermitStatus


class PermitNumberTaken(Exception):
    pass


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


def create_permit(db: Session, user: User, data: NewPermit) -> PermitOut:
    """Log a permit. The owner is found by NIF and left unchanged, or created."""
    # Checked before touching the owner, so a repeated number leaves nothing behind.
    if repository.permit_number_exists(db, data.permit_number):
        raise PermitNumberTaken

    owner = repository.get_owner_by_nif(db, data.owner_nif)
    if owner is None:
        owner = Owner(
            type=None,
            name=data.owner_name,
            nif=data.owner_nif,
            email=data.owner_email,
            phone=data.owner_phone,
        )
        db.add(owner)
        db.flush()

    permit = Permit(
        created_by=user.id,
        owner_id=owner.id,
        maintenance_company_id=None,
        permit_number=data.permit_number,
        permit_date=data.permit_date,
        address=data.address,
        postal_code=data.postal_code,
        parish=data.parish,
        num_elevators=data.num_elevators,
    )
    db.add(permit)
    try:
        db.commit()
    except IntegrityError:
        # Another request took the same number in the meantime.
        db.rollback()
        raise PermitNumberTaken from None
    return _to_out(permit, owner.name, registered=0, pending=0, last_alert_at=None)


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
