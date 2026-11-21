from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

from api.elevators.schemas import PermitSummary

# missing: elevators still to register; pending: all registered, some awaiting the CMA;
# registered: every elevator approved.
PermitStatus = Literal["missing", "pending", "registered"]


class PermitOut(PermitSummary):
    """A permit with the progress of its elevators' registration."""

    postal_code: str
    parish: str
    owner_name: str
    registered: int
    pending: int
    missing: int
    status: PermitStatus
    last_alert_at: datetime | None


Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class NewPermit(BaseModel):
    """A permit as Urban Planning logs it."""

    permit_number: Text
    permit_date: date
    address: Text
    postal_code: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{4}-\d{3}$")]
    parish: Text
    num_elevators: Annotated[int, Field(ge=1)]
    owner_name: Text
    owner_nif: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{9}$")]
    # The same rule as the elevator registration form (features/elevators/validation.ts).
    owner_email: Annotated[
        str,
        StringConstraints(strip_whitespace=True, pattern=r"^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$"),
    ]
    owner_phone: str | None = None

    @field_validator("permit_date")
    @classmethod
    def not_in_the_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("The permit date cannot be in the future")
        return value

    @field_validator("owner_phone", mode="before")
    @classmethod
    def blank_phone_is_none(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value
