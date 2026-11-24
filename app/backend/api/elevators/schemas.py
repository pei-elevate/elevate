from datetime import date, datetime
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from api.accounts.models import OwnerType
from api.elevators.models import CertificateStatus, EquipmentType, RegistrationStatus
from api.elevators.views import ElevatorView
from api.inspections.models import InspectionRequest, InspectionResult, RequestType
from api.notices.models import NoticeType


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
    dge_number: str | None

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


Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class RegistrationIn(BaseModel):
    """An elevator as its maintenance company submits it, new or corrected after a rejection.

    The rules match the registration form (features/elevators/validation.ts).
    """

    address: Text
    postal_code: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{4}-\d{3}$")]
    parish: Text
    building: str | None = None
    service_date: date
    dge_number: str | None = None
    owner_type: OwnerType
    owner_name: Text
    owner_nif: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{9}$")]
    owner_email: Annotated[
        str,
        StringConstraints(strip_whitespace=True, pattern=r"^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$"),
    ]
    owner_phone: str | None = None
    # Name of the supporting document (PDF); the file itself waits for the file storage.
    registration_document: str | None = None

    @field_validator("service_date")
    @classmethod
    def not_in_the_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("The service date cannot be in the future")
        return value

    @field_validator(
        "building", "dge_number", "owner_phone", "registration_document", mode="before"
    )
    @classmethod
    def blank_is_none(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


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


class ElevatorInspectionOut(BaseModel):
    """A completed inspection of the elevator, with the request it answered."""

    # To download the report (GET /api/inspections/requests/{request_id}/report).
    request_id: int
    process_number: str
    submitted_at: datetime
    type: RequestType
    # The company of the request, not necessarily the one in force today.
    inspection_company: CompanyName
    performed_date: date
    result: InspectionResult
    valid_until: date | None
    report_file: str

    @classmethod
    def from_request(cls, r: InspectionRequest) -> Self:
        inspection = r.inspection
        assert inspection is not None  # only requests with an inspection are listed
        return cls.model_validate(
            {
                "request_id": r.id,
                "process_number": r.process_number,
                "submitted_at": r.submitted_at,
                "type": r.type,
                "inspection_company": r.inspection_company,
                "performed_date": inspection.performed_date,
                "result": inspection.result,
                "valid_until": inspection.valid_until,
                "report_file": inspection.report_file,
            }
        )


class ElevatorNoticeOut(OrmSchema):
    id: int
    type: NoticeType
    subject: str
    body: str
    recipients: str
    created_at: datetime | None
