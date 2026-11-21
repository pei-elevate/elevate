from datetime import datetime
from typing import Literal

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
