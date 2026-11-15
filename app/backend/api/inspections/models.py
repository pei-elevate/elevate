from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base, pg_enum
from api.elevators.models import EquipmentType


class RequestType(StrEnum):
    PERIODIC = "periodic"  # Inspeção periódica
    EXTRAORDINARY = "extraordinary"  # Inspeção extraordinária
    REINSPECTION = "reinspection"  # Reinspeção


class RequestStatus(StrEnum):
    # The request arrives already validated and assigned through MyNet.
    AWAITING_SCHEDULING = "awaiting_scheduling"  # Por agendar
    SCHEDULED = "scheduled"  # Agendado
    COMPLETED = "completed"  # Concluído


class InspectionResult(StrEnum):
    APPROVED = "approved"  # Aprovada
    FAILED = "failed"  # Reprovada


class FailedInspectionStatus(StrEnum):
    ACTION_REQUIRED = "action_required"  # Não corrigida
    RESOLVED = "resolved"  # Corrigida


class InspectionRequest(Base):
    __tablename__ = "inspection_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    # "Processo n.º" in MyDoc, e.g. 2026/0341.
    process_number: Mapped[str] = mapped_column(String, unique=True)

    # Found through the form's "Registo n.º", the elevator's 01.05.xxxx reference.
    elevator_id: Mapped[int] = mapped_column(ForeignKey("elevators.id"))
    # Company with a contract in force when the request arrived.
    inspection_company_id: Mapped[int] = mapped_column(ForeignKey("inspection_companies.id"))
    # Failed inspection that led to this re-inspection. inspections also points back
    # here, so this key is added after both tables exist (use_alter).
    original_inspection_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "inspections.id",
            use_alter=True,
            name="inspection_requests_original_inspection_id_fkey",
        )
    )

    type: Mapped[RequestType] = mapped_column(pg_enum(RequestType, "request_type"))
    # "Tipo de equipamento" on the form.
    equipment_type: Mapped[EquipmentType] = mapped_column(pg_enum(EquipmentType, "equipment_type"))
    status: Mapped[RequestStatus] = mapped_column(
        pg_enum(RequestStatus, "request_status"),
        server_default=RequestStatus.AWAITING_SCHEDULING.value,
    )

    submitted_at: Mapped[datetime]  # "Registado em" in MyDoc
    scheduled_at: Mapped[datetime | None]  # Date and time of the inspection


class Inspection(Base):
    """Created when the inspection company submits the result."""

    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("inspection_requests.id"), unique=True)

    performed_date: Mapped[date]
    result: Mapped[InspectionResult] = mapped_column(pg_enum(InspectionResult, "inspection_result"))
    valid_until: Mapped[date | None]  # Only when result = approved
    correction_deadline: Mapped[date | None]  # Only when result = failed
    nonconformities: Mapped[str | None] = mapped_column(Text)  # Required when result = failed
    # Only when result = failed.
    failed_status: Mapped[FailedInspectionStatus | None] = mapped_column(
        pg_enum(FailedInspectionStatus, "failed_inspection_status")
    )
    report_file: Mapped[str] = mapped_column(String)  # Report or certificate (PDF)

    created_at: Mapped[datetime | None] = mapped_column(server_default=func.now())
