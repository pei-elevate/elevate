"""Fake MyDoc: stands in for the CMA's MyDoc (AIRC) until Elevate gets access to the real one.

Only the part Elevate uses: the registered inspection requests (form 3658). The real MyDoc
gives each request its process number and "Registado em" date when it is registered, so this
one does too, and like the real one it never gives the same number twice.

With MYDOC_DATA_FILE set (compose.yml does), the requests are kept in that JSON file, so a
restart of the container does not start the numbering over: a reused number would be a
different request that Elevate skips, because it already has that process number. Without it
(the tests), they live in memory and start from the initial ones.

The field names follow the form; the values of tipo_inspecao and tipo_equipamento are the
same as Elevate's enums (request_type and equipment_type in docs/database/schema.dbml).
"""

import os
import threading
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Query
from pydantic import BaseModel, Field, TypeAdapter


class TipoInspecao(StrEnum):
    PERIODIC = "periodic"  # Inspeção periódica
    EXTRAORDINARY = "extraordinary"  # Inspeção extraordinária
    REINSPECTION = "reinspection"  # Reinspeção


class TipoEquipamento(StrEnum):
    ELEVATOR = "elevator"  # Elevador
    GOODS_LIFT = "goods_lift"  # Monta-cargas
    ESCALATOR = "escalator"  # Escada mecânica
    MOVING_WALKWAY = "moving_walkway"  # Tapete rolante


class NovoRegisto(BaseModel):
    """What the applicant fills in on form 3658."""

    registo: Annotated[str, Field(examples=["01.05.0079"])]  # "Registo n.º" of the elevator
    tipo_inspecao: TipoInspecao
    tipo_equipamento: TipoEquipamento = TipoEquipamento.ELEVATOR


class Registo(NovoRegisto):
    """A request as MyDoc keeps it, after it is registered."""

    processo: str  # "Processo n.º", e.g. 2026/0401
    registado_em: datetime  # "Registado em", local time without a time zone


def initial_registos() -> list[Registo]:
    """For elevators of Elevate's seed that have no open request there."""
    return [
        Registo(
            processo="2026/0401",
            registo="01.05.0079",
            tipo_inspecao=TipoInspecao.PERIODIC,
            registado_em=datetime(2026, 11, 16, 9, 12),
        ),
        Registo(
            processo="2026/0402",
            registo="01.05.0112",
            tipo_inspecao=TipoInspecao.EXTRAORDINARY,
            registado_em=datetime(2026, 11, 17, 14, 40),
        ),
        Registo(
            processo="2026/0403",
            registo="01.05.0263",
            tipo_inspecao=TipoInspecao.PERIODIC,
            registado_em=datetime(2026, 11, 18, 10, 5),
        ),
        Registo(
            processo="2026/0404",
            registo="01.05.0285",
            tipo_inspecao=TipoInspecao.PERIODIC,
            registado_em=datetime(2026, 11, 19, 11, 30),
        ),
    ]


RegistoList = TypeAdapter(list[Registo])

# "Registado em" is Aveiro's time, without a time zone, whatever the container's time zone is.
LOCAL_TIME = ZoneInfo("Europe/Lisbon")

# POST runs in FastAPI's thread pool: without the lock, two requests at the same moment could
# get the same process number.
registering = threading.Lock()


def load_registos(data_file: Path | None) -> list[Registo]:
    """The saved requests, or the initial ones the first time."""
    if data_file is None or not data_file.exists():
        return initial_registos()
    return RegistoList.validate_json(data_file.read_bytes())


def save_registos(data_file: Path | None, registos: list[Registo]) -> None:
    if data_file is None:
        return
    data_file.parent.mkdir(parents=True, exist_ok=True)
    temporary = data_file.with_suffix(".tmp")
    temporary.write_bytes(RegistoList.dump_json(registos, indent=2))
    temporary.replace(data_file)  # A crash mid-write never leaves half a file


app = FastAPI(
    title="MyDoc (fake)",
    description="Inspection requests registered in MyDoc, as Elevate reads them.",
)
app.state.data_file = (
    Path(os.environ["MYDOC_DATA_FILE"]) if "MYDOC_DATA_FILE" in os.environ else None
)
app.state.registos = load_registos(app.state.data_file)


def next_process_number(registos: list[Registo], year: int) -> str:
    """The year's next number, as MyDoc numbers its processes (2026/0405)."""
    prefix = f"{year}/"
    numbers = [
        int(r.processo.removeprefix(prefix)) for r in registos if r.processo.startswith(prefix)
    ]
    return f"{prefix}{max(numbers, default=0) + 1:04d}"


@app.get("/registos")
def list_registos(
    desde: Annotated[
        datetime | None, Query(description="Only requests registered at or after")
    ] = None,
) -> list[Registo]:
    """Registered requests, oldest first."""
    registos = app.state.registos
    if desde is not None:
        if desde.tzinfo is not None:  # Stored times have no time zone: they are Aveiro's
            desde = desde.astimezone(LOCAL_TIME).replace(tzinfo=None)
        registos = [r for r in registos if r.registado_em >= desde]
    return sorted(registos, key=lambda r: (r.registado_em, r.processo))


@app.post("/registos", status_code=201)
def create_registo(novo: NovoRegisto) -> Registo:
    """Plays the applicant submitting the form: MyDoc registers it and numbers it."""
    now = datetime.now(LOCAL_TIME).replace(tzinfo=None, microsecond=0)
    with registering:
        registo = Registo(
            **novo.model_dump(),
            processo=next_process_number(app.state.registos, now.year),
            registado_em=now,
        )
        app.state.registos.append(registo)
        save_registos(app.state.data_file, app.state.registos)
    return registo
