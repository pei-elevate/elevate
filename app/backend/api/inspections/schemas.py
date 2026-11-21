from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from api.elevators.models import EquipmentType
from api.inspections.models import InspectionResult, RequestStatus, RequestType


class OrmSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MaintenanceCompanyContact(OrmSchema):
    """Who the inspection company contacts to schedule the visit."""

    name: str
    phone: str | None
    email: str | None


class AssignedElevator(OrmSchema):
    """Only what the inspection company needs to find the elevator: no owner data."""

    internal_reference: str | None
    address: str
    postal_code: str
    parish: str
    building: str | None
    maintenance_company: MaintenanceCompanyContact


class InspectionOutcome(OrmSchema):
    performed_date: date
    result: InspectionResult
    valid_until: date | None
    correction_deadline: date | None


class AssignedRequestOut(OrmSchema):
    """An inspection request assigned to the company, with its result once submitted."""

    id: int
    process_number: str
    type: RequestType
    equipment_type: EquipmentType
    status: RequestStatus
    submitted_at: datetime
    scheduled_at: datetime | None

    elevator: AssignedElevator
    inspection: InspectionOutcome | None
