from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base, pg_enum


class NoticeType(StrEnum):
    INSPECTION_DUE = "inspection_due"  # Automatic: periodic inspection deadline
    INSPECTION_REQUIRED = "inspection_required"  # Manual: an inspection is needed
    MISSING_REGISTRATION = "missing_registration"  # Alert to the owner of an unregistered permit


class Notice(Base):
    """Notices / official letters sent by email.

    The recipients are the elevator's owner and maintenance company, or the permit's owner.
    """

    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[NoticeType] = mapped_column(pg_enum(NoticeType, "notice_type"))

    elevator_id: Mapped[int | None] = mapped_column(ForeignKey("elevators.id"))
    # Only when type = missing_registration.
    permit_id: Mapped[int | None] = mapped_column(ForeignKey("permits.id"))
    # Null when the notice is automatic.
    sent_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    subject: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)
    # Names and emails of the recipients at the time it was sent.
    recipients: Mapped[str] = mapped_column(String)

    created_at: Mapped[datetime | None] = mapped_column(server_default=func.now())
