"""Turns a request registered in MyDoc into an inspection request in Elevate.

Only rules: it does not know how the request was fetched (see api.mydoc.client) nor when
(see api.mydoc.poller).
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.elevators.repository import current_inspection_company
from api.inspections.models import (
    Inspection,
    InspectionRequest,
    InspectionResult,
    RequestStatus,
    RequestType,
)
from api.mydoc import repository
from api.mydoc.schemas import Registo


class Kind(StrEnum):
    CREATED = "created"  # Now an inspection request awaiting scheduling
    DUPLICATE = "duplicate"  # Elevate already has this process number (warns if it differs)
    INVALID = "invalid"  # The request itself is wrong: it never enters
    PENDING = "pending"  # Something is missing in Elevate: it enters once it is there
    SKIPPED = "skipped"  # A re-inspection of a failure that already has an open one


@dataclass(frozen=True)
class Outcome:
    kind: Kind
    process_number: str | None
    submitted_at: datetime | None = None
    reason: str | None = None  # Why it is invalid, pending or skipped
    warnings: tuple[str, ...] = ()  # Created, but someone should take a look


def ingest(db: Session, raw: Any) -> Outcome:
    """Creates the inspection request for one MyDoc request, in its own transaction."""
    try:
        registo = Registo.model_validate(raw)
    except ValidationError as error:
        process_number = raw.get("processo") if isinstance(raw, dict) else None
        return Outcome(
            Kind.INVALID,
            process_number if isinstance(process_number, str) else None,
            reason=_describe(error),
        )

    number, submitted_at = registo.processo, registo.registado_em
    existing = repository.find_request(db, number)
    if existing is not None:
        return Outcome(
            Kind.DUPLICATE, number, submitted_at, warnings=_differences(existing, registo)
        )

    elevator = repository.find_elevator(db, registo.registo)
    if elevator is None:
        return Outcome(
            Kind.PENDING, number, submitted_at, f"no elevator with reference {registo.registo}"
        )
    company = current_inspection_company(db, submitted_at.date())
    if company is None:
        return Outcome(
            Kind.PENDING,
            number,
            submitted_at,
            f"no inspection company with a contract in force on {submitted_at.date()}",
        )

    original_inspection_id, reinspection_warning = None, None
    if registo.tipo_inspecao == RequestType.REINSPECTION:
        failed = _failed_inspection(db, elevator.id)
        if failed is not None and repository.has_open_reinspection(db, failed.id):
            # The inspection company would see two re-inspections of the same failure and
            # could visit twice. MyDoc keeps the process; the CMA handles repeats there.
            return Outcome(
                Kind.SKIPPED,
                number,
                submitted_at,
                f"elevator {registo.registo} already has an open re-inspection of the failed "
                f"inspection {failed.id}; not created",
            )
        if failed is None:
            reinspection_warning = (
                "re-inspection, but the elevator's last inspection did not fail; not linked"
            )
        else:
            original_inspection_id = failed.id

    warnings = []
    if registo.tipo_equipamento != elevator.equipment_type:
        warnings.append(
            f"the form says {registo.tipo_equipamento}, elevator {registo.registo} is "
            f"registered as {elevator.equipment_type}; kept the form's"
        )
    if repository.has_open_request(db, elevator.id, registo.tipo_inspecao):
        warnings.append(
            f"elevator {registo.registo} already has an open {registo.tipo_inspecao} request"
        )
    if reinspection_warning:
        warnings.append(reinspection_warning)

    db.add(
        InspectionRequest(
            process_number=number,
            elevator_id=elevator.id,
            inspection_company_id=company.id,
            original_inspection_id=original_inspection_id,
            type=registo.tipo_inspecao,
            equipment_type=registo.tipo_equipamento,
            status=RequestStatus.AWAITING_SCHEDULING,
            submitted_at=submitted_at,
        )
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        existing = repository.find_request(db, number)
        if existing is not None:
            # Another process created the same process number in the meantime.
            return Outcome(
                Kind.DUPLICATE, number, submitted_at, warnings=_differences(existing, registo)
            )
        # Something else changed under us (e.g. the elevator was removed): try again later.
        return Outcome(Kind.PENDING, number, submitted_at, f"could not save: {error.orig}")
    return Outcome(Kind.CREATED, number, submitted_at, warnings=tuple(warnings))


def _failed_inspection(db: Session, elevator_id: int) -> Inspection | None:
    """The failed inspection a re-inspection is about: the elevator's last inspection, if it
    failed, whether or not it is already corrected (the owner usually corrects first and then
    asks for the re-inspection). The form does not say which one it is."""
    last = repository.latest_inspection(db, elevator_id)
    if last is None or last.result != InspectionResult.FAILED:
        return None
    return last


def _differences(existing: InspectionRequest, registo: Registo) -> tuple[str, ...]:
    """A process number is never reused in MyDoc. If the same number comes back with other
    data, something is wrong upstream: Elevate keeps what it has and says so."""
    differences = [
        f"{field} {theirs} in MyDoc, {ours} in Elevate"
        for field, theirs, ours in [
            ("reference", registo.registo, existing.elevator.internal_reference),
            ("type", registo.tipo_inspecao, existing.type),
            ("registered", registo.registado_em, existing.submitted_at),
        ]
        if theirs != ours
    ]
    if not differences:
        return ()
    return ("already in Elevate with other data (" + "; ".join(differences) + "); kept Elevate's",)


def _describe(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in e['loc']) or 'request'}: {e['msg']}"
        for e in error.errors()
    )
