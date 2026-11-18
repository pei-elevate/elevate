from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from api.accounts.models import OwnerType
from api.elevators.models import EquipmentType, RegistrationStatus


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
