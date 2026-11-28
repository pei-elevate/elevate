from datetime import date, datetime
from typing import Self
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from api.elevators.models import EquipmentType
from api.inspections.models import InspectionResult, RequestStatus, RequestType

LOCAL_TIME = ZoneInfo("Europe/Lisbon")


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


class ScheduleRequest(BaseModel):
    """The date and time the inspection company sets for a request (Schedule Inspections)."""

    scheduled_at: datetime

    @field_validator("scheduled_at")
    @classmethod
    def local_time(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value
        return value.astimezone(LOCAL_TIME).replace(tzinfo=None)


class ResultIn(BaseModel):
    """The verdict the inspection company submits after the visit (Submit Inspection Results).

    Approved needs the certificate's validity; failed needs the nonconformities and the
    deadline to correct them. Whether performed_date is in the future is checked by the service,
    which knows today's date.
    """

    result: InspectionResult
    performed_date: date
    valid_until: date | None = None
    correction_deadline: date | None = None
    nonconformities: str | None = None

    @field_validator("valid_until", "correction_deadline", "nonconformities", mode="before")
    @classmethod
    def blank_is_none(cls, value: object) -> object:
        """A form sends the fields it does not use as empty text."""
        if isinstance(value, str) and not value.strip():
            return None
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def fields_of_the_result(self) -> Self:
        if self.result == InspectionResult.APPROVED:
            if self.valid_until is None or self.valid_until <= self.performed_date:
                raise ValueError("An approved inspection needs a validity after its date")
            self.correction_deadline = None
            self.nonconformities = None
        else:
            if not self.nonconformities:
                raise ValueError("A failed inspection needs its nonconformities")
            if self.correction_deadline is None or self.correction_deadline < self.performed_date:
                raise ValueError("A failed inspection needs a deadline from its date on")
            self.valid_until = None
        return self
