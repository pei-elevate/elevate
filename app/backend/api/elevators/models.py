from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base, pg_enum


class EquipmentType(StrEnum):
    """Types on the official inspection form."""

    ELEVATOR = "elevator"  # Elevador
    GOODS_LIFT = "goods_lift"  # Monta-cargas
    ESCALATOR = "escalator"  # Escada mecânica
    MOVING_WALKWAY = "moving_walkway"  # Tapete rolante


class RegistrationStatus(StrEnum):
    PENDING_APPROVAL = "pending_approval"  # Por validar
    APPROVED = "approved"  # Registado
    REJECTED = "rejected"  # Rejeitado


class ElevatorStatus(StrEnum):
    ACTIVE = "active"  # Ativo
    INACTIVE = "inactive"  # Inativo
    SEALED = "sealed"  # Selado


class ComplaintStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"


class Elevator(Base):
    """An elevator in the municipal register.

    The certificate status (valid, due soon, overdue, failed, not inspected) is calculated
    from the last inspection; `status` keeps what cannot be calculated. The inspection
    company is the one with a contract in force with the CMA.
    """

    __tablename__ = "elevators"

    id: Mapped[int] = mapped_column(primary_key=True)
    # E.g. 01.05.0079. Given when the registration is approved, with the next number of
    # reference_counters. The only official identifier in Aveiro.
    internal_reference: Mapped[str | None] = mapped_column(String, unique=True)

    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"))
    maintenance_company_id: Mapped[int] = mapped_column(ForeignKey("maintenance_companies.id"))
    permit_id: Mapped[int | None] = mapped_column(ForeignKey("permits.id"))

    equipment_type: Mapped[EquipmentType] = mapped_column(
        pg_enum(EquipmentType, "equipment_type"), server_default=EquipmentType.ELEVATOR.value
    )

    address: Mapped[str] = mapped_column(String)
    postal_code: Mapped[str] = mapped_column(String)
    parish: Mapped[str] = mapped_column(String)
    building: Mapped[str | None] = mapped_column(String)  # Edifício / bloco
    service_date: Mapped[date]  # Entrada em serviço

    registration_status: Mapped[RegistrationStatus] = mapped_column(
        pg_enum(RegistrationStatus, "registration_status"),
        server_default=RegistrationStatus.PENDING_APPROVAL.value,
    )
    rejected_reason: Mapped[str | None] = mapped_column(String)
    # Maintenance contract or other supporting document (PDF).
    registration_document: Mapped[str | None] = mapped_column(String)

    # Inactive and sealed elevators do not get the 60-day reminder.
    status: Mapped[ElevatorStatus] = mapped_column(
        pg_enum(ElevatorStatus, "elevator_status"), server_default=ElevatorStatus.ACTIVE.value
    )

    created_at: Mapped[datetime | None] = mapped_column(server_default=func.now())


class ReferenceCounter(Base):
    """Gapless numbering of internal references.

    On approval: SELECT ... FOR UPDATE, last_number + 1, and the number is padded with
    zeros to 4 digits (10000 keeps 5).
    """

    __tablename__ = "reference_counters"

    prefix: Mapped[str] = mapped_column(String, primary_key=True)  # E.g. 01.05
    # Starts at the highest number already used in the CMA's Excel.
    last_number: Mapped[int]


class Complaint(Base):
    """Out of the MVP: the table exists but is not used yet."""

    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True)

    elevator_id: Mapped[int] = mapped_column(ForeignKey("elevators.id"))
    maintenance_company_id: Mapped[int] = mapped_column(ForeignKey("maintenance_companies.id"))

    description: Mapped[str] = mapped_column(String)
    status: Mapped[ComplaintStatus] = mapped_column(
        pg_enum(ComplaintStatus, "complaint_status"), server_default=ComplaintStatus.OPEN.value
    )
    received_date: Mapped[date]
    responded_date: Mapped[date | None]
