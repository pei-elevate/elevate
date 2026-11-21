from sqlalchemy import Row, distinct, func, select
from sqlalchemy.orm import Session

from api.accounts.models import Owner
from api.elevators.models import Elevator, RegistrationStatus
from api.notices.models import Notice, NoticeType
from api.permits.models import Permit


def list_permits(db: Session) -> list[Row]:
    """Every permit, newest first, with its owner's name, how many linked elevators are
    approved or awaiting approval, and when the last missing-registration alert was sent."""
    elevators = func.count(distinct(Elevator.id))
    query = (
        select(
            Permit,
            Owner.name.label("owner_name"),
            elevators.filter(Elevator.registration_status == RegistrationStatus.APPROVED).label(
                "registered"
            ),
            elevators.filter(
                Elevator.registration_status == RegistrationStatus.PENDING_APPROVAL
            ).label("pending"),
            func.max(Notice.created_at).label("last_alert_at"),
        )
        .join(Owner, Owner.id == Permit.owner_id)
        .outerjoin(Elevator, Elevator.permit_id == Permit.id)
        # Joining the notices repeats the elevator rows, hence the distinct counts.
        .outerjoin(
            Notice,
            (Notice.permit_id == Permit.id) & (Notice.type == NoticeType.MISSING_REGISTRATION),
        )
        .group_by(Permit.id, Owner.name)
        .order_by(Permit.permit_date.desc(), Permit.id.desc())
    )
    return list(db.execute(query))
