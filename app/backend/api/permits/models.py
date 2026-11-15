from datetime import date, datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class Permit(Base):
    """Use permit (alvará) logged by Urban Planning.

    Its status (not registered, partly registered, pending approval, registered) is
    calculated from the elevators linked to it, so it is not stored.
    """

    __tablename__ = "permits"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"))
    # If known; chosen from the list of registered companies.
    maintenance_company_id: Mapped[int | None] = mapped_column(
        ForeignKey("maintenance_companies.id")
    )

    permit_number: Mapped[str] = mapped_column(String, unique=True)
    permit_date: Mapped[date]

    address: Mapped[str] = mapped_column(String)
    postal_code: Mapped[str] = mapped_column(String)
    parish: Mapped[str] = mapped_column(String)
    num_elevators: Mapped[int]

    created_at: Mapped[datetime | None] = mapped_column(server_default=func.now())
