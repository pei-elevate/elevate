from datetime import date, datetime
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, StringConstraints

from api.accounts.models import OwnerType
from api.elevators.models import CertificateStatus, EquipmentType, RegistrationStatus
from api.elevators.views import ElevatorView
from api.inspections.models import InspectionResult, RequestType


class OrmSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class OwnerOut(OrmSchema):
    id: int
    type: OwnerType | None
    name: str
    nif: str
    email: str
    phone: str | None


class MaintenanceCompanyOut(OrmSchema):
    id: int
    name: str
    email: str | None
    phone: str | None


class PermitSummary(OrmSchema):
    id: int
    permit_number: str
    permit_date: date
    address: str
    num_elevators: int


class RegistrationOut(OrmSchema):
    """An elevator as submitted by its maintenance company, with what the CMA decided."""

    id: int
    internal_reference: str | None
    registration_status: RegistrationStatus
    rejected_reason: str | None

    equipment_type: EquipmentType
    address: str
    postal_code: str
    parish: str
    building: str | None
    service_date: date
    registration_document: str | None
    created_at: datetime | None

    owner: OwnerOut
    maintenance_company: MaintenanceCompanyOut
    permit: PermitSummary | None


class ApproveRegistration(BaseModel):
    # The permit the registration matches: the suggested one, another one, or none.
    permit_id: int | None


class RejectRegistration(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class LatestRequestOut(OrmSchema):
    process_number: str
    submitted_at: datetime
    type: RequestType


class CompanyName(OrmSchema):
    name: str


class ElevatorSummaryOut(BaseModel):
    """A registered elevator in the list of a profile, with its certificate status."""

    id: int
    internal_reference: str
    dge_number: str | None
    address: str
    postal_code: str
    parish: str
    building: str | None
    owner: CompanyName
    maintenance_company: CompanyName
    # The company with a contract in force with the CMA, if any.
    inspection_company: CompanyName | None
    certificate_status: CertificateStatus
    valid_until: date | None
    # The most recent request, in any status.
    latest_request: LatestRequestOut | None

    @classmethod
    def from_view(cls, v: ElevatorView) -> Self:
        return cls.model_validate(_view_fields(v))


def _view_fields(v: ElevatorView) -> dict:
    e = v.elevator
    return {
        "id": e.id,
        "internal_reference": e.internal_reference,
        "dge_number": e.dge_number,
        "address": e.address,
        "postal_code": e.postal_code,
        "parish": e.parish,
        "building": e.building,
        "owner": e.owner,
        "maintenance_company": e.maintenance_company,
        "inspection_company": v.inspection_company,
        "certificate_status": v.certificate_status,
        "valid_until": v.last_inspection.valid_until if v.last_inspection else None,
        "latest_request": v.latest_request,
    }


class ContactOut(OrmSchema):
    name: str
    email: str | None
    phone: str | None


class LastInspectionOut(OrmSchema):
    performed_date: date
    result: InspectionResult


class ElevatorOut(ElevatorSummaryOut):
    """Everything about a registered elevator, for its page."""

    equipment_type: EquipmentType
    service_date: date
    created_at: datetime | None
    owner: OwnerOut
    maintenance_company: ContactOut
    inspection_company: ContactOut | None
    last_inspection: LastInspectionOut | None
    # Only for the municipal manager.
    permit: PermitSummary | None

    @classmethod
    def from_view(cls, v: ElevatorView, *, include_permit: bool = False) -> Self:
        e = v.elevator
        return cls.model_validate(
            {
                **_view_fields(v),
                "equipment_type": e.equipment_type,
                "service_date": e.service_date,
                "created_at": e.created_at,
                "last_inspection": v.last_inspection,
                "permit": e.permit if include_permit else None,
            }
        )
