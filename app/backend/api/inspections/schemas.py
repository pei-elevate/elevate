from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from api.elevators.models import EquipmentType
from api.inspections.models import InspectionResult, RequestStatus, RequestType


class OrmSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CompanyContact(OrmSchema):
    """A company and how to reach it: the maintenance company, to schedule the visit, or the
    inspection company, to follow up on the request."""

    name: str
    phone: str | None
    email: str | None


class AssignedElevator(OrmSchema):
    """Only what the inspection company needs to find the elevator: no owner data."""

    internal_reference: str | None
    dge_number: str | None
    address: str
    postal_code: str
    parish: str
    building: str | None
    maintenance_company: CompanyContact


class InspectionOutcome(OrmSchema):
    performed_date: date
    result: InspectionResult
    valid_until: date | None
    correction_deadline: date | None


class RequestOut(OrmSchema):
    id: int
    process_number: str
    type: RequestType
    equipment_type: EquipmentType
    status: RequestStatus
    submitted_at: datetime
    scheduled_at: datetime | None

    inspection: InspectionOutcome | None


class AssignedRequestOut(RequestOut):
    """An inspection request assigned to the company, with its result once submitted."""

    elevator: AssignedElevator


class TrackedElevator(AssignedElevator):
    # To open the elevator's page.
    id: int


class RequestStatusOut(RequestOut):
    """A request as the maintenance company or the municipal manager follow it: where it
    stands, which inspection company handles it, and the result once submitted."""

    elevator: TrackedElevator
    inspection_company: CompanyContact
