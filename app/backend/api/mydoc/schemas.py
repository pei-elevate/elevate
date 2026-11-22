from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator

from api.elevators.models import EquipmentType
from api.inspections.models import RequestType

# Time in Aveiro. submitted_at, like the seed, keeps it without a time zone. Explicit, so it
# does not depend on the container's time zone (UTC by default).
LOCAL_TIME = ZoneInfo("Europe/Lisbon")


class Registo(BaseModel):
    """An inspection request (form 3658) as MyDoc registered it.

    The names follow the form; tipo_inspecao and tipo_equipamento already use Elevate's values.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    processo: str = Field(min_length=1)  # "Processo n.º", e.g. 2026/0401
    registo: str = Field(min_length=1)  # "Registo n.º": the elevator's 01.05.xxxx reference
    registado_em: datetime  # "Registado em"
    tipo_inspecao: RequestType
    tipo_equipamento: EquipmentType

    @field_validator("registado_em")
    @classmethod
    def local_time(cls, value: datetime) -> datetime:
        """A value without a time zone is already Aveiro's time. One with a time zone is
        converted, so the contract check does not land on the wrong day."""
        if value.tzinfo is None:
            return value
        return value.astimezone(LOCAL_TIME).replace(tzinfo=None)
