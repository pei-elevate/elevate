from sqlalchemy import select
from sqlalchemy.orm import Session

from api.permits.models import Permit


def list_permits(db: Session) -> list[Permit]:
    return list(db.scalars(select(Permit).order_by(Permit.permit_date.desc(), Permit.id.desc())))
