"""Inspection requests fetched from MyDoc (ELEV-50): the rules and the polling cycle."""

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from api.accounts.models import InspectionCompany, MaintenanceCompany, Owner
from api.elevators.models import Elevator, ElevatorStatus, EquipmentType, RegistrationStatus
from api.inspections.models import (
    FailedInspectionStatus,
    Inspection,
    InspectionRequest,
    InspectionResult,
    RequestStatus,
    RequestType,
)
from api.mydoc import poller
from api.mydoc.client import MyDocUnavailable
from api.mydoc.poller import LOOKBACK, PollState, run_once
from api.mydoc.service import Kind, ingest

REGISTERED = datetime(2026, 11, 20, 10, 30)


def registo(number="2026/0401", reference="01.05.0079", **fields):
    return {
        "processo": number,
        "registo": reference,
        "registado_em": REGISTERED.isoformat(),
        "tipo_inspecao": "periodic",
        "tipo_equipamento": "elevator",
        **fields,
    }


@pytest.fixture
def company(db: Session) -> InspectionCompany:
    company = InspectionCompany(name="Inspeave, Lda.", contract_start=date(2025, 1, 1))
    db.add(company)
    db.flush()
    return company


def add_elevator(db: Session, reference: str, **fields) -> Elevator:
    owner = Owner(
        name=f"Condomínio {reference}", nif=f"5{reference[-4:]}0000", email="condominio@ex.pt"
    )
    maintenance = MaintenanceCompany(name=f"Manutenção {reference}", nif=f"6{reference[-4:]}0000")
    db.add_all([owner, maintenance])
    db.flush()
    elevator = Elevator(
        internal_reference=reference,
        owner_id=owner.id,
        maintenance_company_id=maintenance.id,
        address="Rua de Viseu 12",
        postal_code="3800-000",
        parish="Glória e Vera Cruz",
        service_date=date(2015, 1, 1),
        registration_status=RegistrationStatus.APPROVED,
        **fields,
    )
    db.add(elevator)
    db.flush()
    return elevator


@pytest.fixture
def elevator(db: Session) -> Elevator:
    return add_elevator(db, "01.05.0079")


def add_inspection(
    db: Session,
    elevator: Elevator,
    company: InspectionCompany,
    number: str,
    performed: date,
    result: InspectionResult,
    failed_status: FailedInspectionStatus | None = None,
) -> Inspection:
    request = InspectionRequest(
        process_number=number,
        elevator_id=elevator.id,
        inspection_company_id=company.id,
        type=RequestType.PERIODIC,
        equipment_type=EquipmentType.ELEVATOR,
        status=RequestStatus.COMPLETED,
        submitted_at=datetime(performed.year, performed.month, 1),
    )
    db.add(request)
    db.flush()
    inspection = Inspection(
        request_id=request.id,
        performed_date=performed,
        result=result,
        failed_status=failed_status,
        report_file=f"relatorio-{number.replace('/', '-')}.pdf",
    )
    db.add(inspection)
    db.flush()
    return inspection


def created(db: Session, number: str) -> InspectionRequest | None:
    return db.scalar(select(InspectionRequest).where(InspectionRequest.process_number == number))


# --- The rules (service.ingest) -------------------------------------------------------------


def test_a_valid_request_enters_awaiting_scheduling(db, company, elevator):
    outcome = ingest(db, registo())

    assert outcome.kind == Kind.CREATED
    assert outcome.warnings == ()
    request = created(db, "2026/0401")
    assert request.elevator_id == elevator.id
    assert request.inspection_company_id == company.id
    assert request.type == RequestType.PERIODIC
    assert request.equipment_type == EquipmentType.ELEVATOR
    assert request.status == RequestStatus.AWAITING_SCHEDULING
    assert request.submitted_at == REGISTERED
    assert request.original_inspection_id is None
    assert request.scheduled_at is None


def test_a_known_process_number_is_skipped(db, company, elevator):
    ingest(db, registo())

    outcome = ingest(db, registo())

    assert outcome.kind == Kind.DUPLICATE
    assert outcome.warnings == ()
    assert len(db.scalars(select(InspectionRequest)).all()) == 1


def test_a_known_process_number_with_other_data_keeps_elevates_and_warns(db, company, elevator):
    add_elevator(db, "01.05.0154")
    ingest(db, registo())

    outcome = ingest(db, registo(reference="01.05.0154", tipo_inspecao="extraordinary"))

    assert outcome.kind == Kind.DUPLICATE
    assert "01.05.0154 in MyDoc, 01.05.0079 in Elevate" in outcome.warnings[0]
    assert created(db, "2026/0401").elevator_id == elevator.id


@pytest.mark.parametrize(
    "raw",
    [
        {"registo": "01.05.0079", "registado_em": "2026-11-20T10:30:00"},
        registo(tipo_inspecao="inspeção periódica"),
        registo(tipo_equipamento="lift"),
        registo(registado_em="ontem"),
        registo(registo="  "),
        "not a request",
    ],
)
def test_an_invalid_request_never_enters(db, company, elevator, raw):
    outcome = ingest(db, raw)

    assert outcome.kind == Kind.INVALID
    assert outcome.reason
    assert db.scalars(select(InspectionRequest)).all() == []


def test_an_unknown_reference_is_pending(db, company, elevator):
    outcome = ingest(db, registo(reference="01.05.9999"))

    assert outcome.kind == Kind.PENDING
    assert "01.05.9999" in outcome.reason
    assert created(db, "2026/0401") is None


@pytest.mark.parametrize(
    "start, end",
    [(date(2026, 12, 1), None), (date(2025, 1, 1), date(2026, 11, 19))],
    ids=["contract-not-started", "contract-ended"],
)
def test_without_a_contract_in_force_it_is_pending(db, elevator, start, end):
    db.add(InspectionCompany(name="Inspeave, Lda.", contract_start=start, contract_end=end))
    db.flush()

    outcome = ingest(db, registo())

    assert outcome.kind == Kind.PENDING
    assert "contract" in outcome.reason


def test_it_goes_to_the_company_whose_contract_covers_the_day(db, elevator):
    old = InspectionCompany(
        name="Antiga", contract_start=date(2024, 1, 1), contract_end=date(2025, 12, 31)
    )
    current = InspectionCompany(name="Atual", contract_start=date(2026, 1, 1))
    db.add_all([old, current])
    db.flush()

    ingest(db, registo())

    assert created(db, "2026/0401").inspection_company_id == current.id


def test_a_registration_time_with_a_time_zone_is_stored_in_lisbon_time(db, company, elevator):
    # 23:30 UTC on 30 June is already 1 July in Lisbon (summer time, UTC+1).
    ingest(db, registo(registado_em="2026-06-30T23:30:00+00:00"))

    stored = created(db, "2026/0401").submitted_at
    assert stored == datetime(2026, 7, 1, 0, 30)
    assert stored.tzinfo is None


def test_a_different_equipment_type_keeps_the_forms_and_warns(db, company, elevator):
    outcome = ingest(db, registo(tipo_equipamento="escalator"))

    assert outcome.kind == Kind.CREATED
    assert created(db, "2026/0401").equipment_type == EquipmentType.ESCALATOR
    assert any("escalator" in w for w in outcome.warnings)


def test_a_second_open_request_of_the_same_type_enters_with_a_warning(db, company, elevator):
    ingest(db, registo("2026/0401"))

    outcome = ingest(db, registo("2026/0402"))

    assert outcome.kind == Kind.CREATED
    assert any("already has an open periodic request" in w for w in outcome.warnings)


def test_an_open_request_of_another_type_is_no_warning(db, company, elevator):
    ingest(db, registo("2026/0401"))

    assert ingest(db, registo("2026/0402", tipo_inspecao="extraordinary")).warnings == ()


@pytest.mark.parametrize("status", [ElevatorStatus.INACTIVE, ElevatorStatus.SEALED])
def test_inactive_and_sealed_elevators_still_get_requests(db, company, status):
    add_elevator(db, "01.05.0079", status=status)

    assert ingest(db, registo()).kind == Kind.CREATED


# --- Re-inspections ------------------------------------------------------------------------


def test_a_reinspection_links_the_last_failed_inspection_even_if_corrected(db, company, elevator):
    # As in the seed: the owner corrects first, then asks for the re-inspection.
    add_inspection(db, elevator, company, "2025/0100", date(2025, 3, 1), InspectionResult.FAILED)
    failed = add_inspection(
        db,
        elevator,
        company,
        "2026/0270",
        date(2026, 9, 18),
        InspectionResult.FAILED,
        FailedInspectionStatus.RESOLVED,
    )

    outcome = ingest(db, registo(tipo_inspecao="reinspection"))

    assert outcome.warnings == ()
    assert created(db, "2026/0401").original_inspection_id == failed.id


def test_a_reinspection_is_not_linked_when_the_last_inspection_passed(db, company, elevator):
    add_inspection(db, elevator, company, "2025/0100", date(2025, 3, 1), InspectionResult.FAILED)
    add_inspection(db, elevator, company, "2026/0270", date(2026, 9, 18), InspectionResult.APPROVED)

    outcome = ingest(db, registo(tipo_inspecao="reinspection"))

    assert outcome.kind == Kind.CREATED
    assert created(db, "2026/0401").original_inspection_id is None
    assert any("did not fail" in w for w in outcome.warnings)


def test_a_reinspection_without_any_inspection_is_not_linked(db, company, elevator):
    outcome = ingest(db, registo(tipo_inspecao="reinspection"))

    assert created(db, "2026/0401").original_inspection_id is None
    assert any("did not fail" in w for w in outcome.warnings)


def test_a_repeated_reinspection_of_the_same_failure_is_not_created(db, company, elevator):
    failed = add_inspection(
        db, elevator, company, "2026/0270", date(2026, 9, 18), InspectionResult.FAILED
    )
    first = ingest(db, registo("2026/0401", tipo_inspecao="reinspection"))

    second = ingest(db, registo("2026/0402", tipo_inspecao="reinspection"))

    assert first.kind == Kind.CREATED
    assert second.kind == Kind.SKIPPED
    assert f"failed inspection {failed.id}" in second.reason
    assert created(db, "2026/0402") is None


def test_a_reinspection_is_created_again_once_the_previous_one_is_completed(db, company, elevator):
    failed = add_inspection(
        db, elevator, company, "2026/0270", date(2026, 9, 18), InspectionResult.FAILED
    )
    ingest(db, registo("2026/0401", tipo_inspecao="reinspection"))
    created(db, "2026/0401").status = RequestStatus.COMPLETED
    db.flush()

    outcome = ingest(db, registo("2026/0402", tipo_inspecao="reinspection"))

    assert outcome.kind == Kind.CREATED
    assert created(db, "2026/0402").original_inspection_id == failed.id


# --- The polling cycle (poller.run_once) ---------------------------------------------------


@pytest.fixture
def sessions(db: Session):
    """Gives the test session to run_once, which normally opens a new one per request."""

    @contextmanager
    def factory() -> Iterator[Session]:
        yield db

    return factory


class FakeMyDoc:
    def __init__(self, *registos):
        self.registos = list(registos)
        self.asked: list[datetime | None] = []
        self.down = False

    def __call__(self, since):
        self.asked.append(since)
        if self.down:
            raise MyDocUnavailable("ConnectError: connection refused")
        return [
            r
            for r in self.registos
            if since is None
            or not isinstance(r, dict)
            or datetime.fromisoformat(r["registado_em"]) >= since
        ]


def test_one_bad_request_does_not_stop_the_others(db, company, elevator, sessions):
    mydoc = FakeMyDoc(
        registo("2026/0401", tipo_inspecao="nonsense"),
        registo("2026/0402", reference="01.05.9999"),
        registo("2026/0403"),
    )

    outcomes = run_once(mydoc, sessions, PollState())

    assert [o.kind for o in outcomes] == [Kind.INVALID, Kind.PENDING, Kind.CREATED]
    assert created(db, "2026/0403") is not None


def test_an_error_in_one_request_keeps_it_pending_and_goes_on(
    db, company, elevator, sessions, monkeypatch
):
    real_ingest = poller.service.ingest

    def failing(db, raw):
        if raw["processo"] == "2026/0401":
            raise RuntimeError("boom")
        return real_ingest(db, raw)

    monkeypatch.setattr(poller.service, "ingest", failing)
    # run_once rolls back after the error; commit first so the company and elevator stay.
    db.commit()
    state = PollState()

    outcomes = run_once(
        FakeMyDoc(registo("2026/0401"), registo("2026/0402", tipo_inspecao="extraordinary")),
        sessions,
        state,
    )

    assert [o.kind for o in outcomes] == [Kind.PENDING, Kind.CREATED]
    assert "2026/0401" in state.pending


def test_the_first_cycle_asks_for_everything_then_only_what_is_new(db, company, elevator, sessions):
    mydoc = FakeMyDoc(registo())
    state = PollState()

    run_once(mydoc, sessions, state)
    run_once(mydoc, sessions, state)

    # With a margin back, for requests that show up in MyDoc after a newer one.
    assert mydoc.asked == [None, REGISTERED - LOOKBACK]


def test_a_pending_request_enters_once_the_elevator_exists(db, company, elevator, sessions):
    later = registo("2026/0405", registado_em="2026-11-21T09:00:00")
    mydoc = FakeMyDoc(registo("2026/0402", reference="01.05.0300"), later)
    state = PollState()

    run_once(mydoc, sessions, state)
    assert created(db, "2026/0402") is None
    # Still asks from the pending one, not from the newest.
    assert state.since() == REGISTERED - LOOKBACK

    add_elevator(db, "01.05.0300")
    run_once(mydoc, sessions, state)

    assert created(db, "2026/0402") is not None
    assert state.pending == {}
    assert state.since() == datetime(2026, 11, 21, 9, 0) - LOOKBACK


def test_a_known_number_with_other_data_is_logged_once(db, company, elevator, sessions, caplog):
    add_elevator(db, "01.05.0154")
    ingest(db, registo())
    mydoc = FakeMyDoc(registo(reference="01.05.0154"))
    state = PollState()

    with caplog.at_level(logging.WARNING, logger="api.mydoc"):
        for _ in range(3):
            run_once(mydoc, sessions, state)

    assert sum("other data" in r.getMessage() for r in caplog.records) == 1


def test_a_save_error_that_is_not_a_duplicate_stays_pending(
    db, company, elevator, sessions, monkeypatch
):
    def fail_once():
        monkeypatch.undo()
        raise IntegrityError("INSERT", {}, Exception("foreign key violation"))

    # ingest rolls back after the error; commit first so the company and elevator stay.
    db.commit()
    monkeypatch.setattr(db, "commit", fail_once)
    db_commit_state = PollState()

    outcomes = run_once(FakeMyDoc(registo()), sessions, db_commit_state)

    assert outcomes[0].kind == Kind.PENDING
    assert "could not save" in outcomes[0].reason
    assert "2026/0401" in db_commit_state.pending
    run_once(FakeMyDoc(registo()), sessions, db_commit_state)
    assert created(db, "2026/0401") is not None


def test_a_database_outage_stops_the_cycle_with_one_warning(
    db, company, elevator, sessions, monkeypatch, caplog
):
    def database_down(db, raw):
        raise OperationalError("SELECT", {}, Exception("connection refused"))

    monkeypatch.setattr(poller.service, "ingest", database_down)
    state = PollState()
    mydoc = FakeMyDoc(*(registo(f"2026/04{n:02d}") for n in range(1, 6)))

    with caplog.at_level(logging.WARNING, logger="api.mydoc"):
        outcomes = run_once(mydoc, sessions, state)

    assert outcomes == []
    assert len(caplog.records) == 1
    assert "Database unavailable" in caplog.text
    assert "2026/0401" in state.pending  # The next cycle asks from here again


def test_pending_invalid_and_skipped_requests_are_logged_once(
    db, company, elevator, sessions, caplog
):
    add_inspection(db, elevator, company, "2026/0270", date(2026, 9, 18), InspectionResult.FAILED)
    mydoc = FakeMyDoc(
        registo("2026/0401", reference="01.05.9999"),
        registo("2026/0402", tipo_inspecao="nonsense"),
        registo("2026/0403", tipo_inspecao="reinspection"),
        registo("2026/0404", tipo_inspecao="reinspection"),
    )
    state = PollState()

    with caplog.at_level(logging.WARNING, logger="api.mydoc"):
        for _ in range(3):
            run_once(mydoc, sessions, state)

    messages = [r.getMessage() for r in caplog.records]
    assert sum("2026/0401" in m for m in messages) == 1
    assert sum("2026/0402" in m for m in messages) == 1
    assert sum("2026/0404" in m for m in messages) == 1
    assert created(db, "2026/0404") is None


def test_mydoc_down_is_logged_and_retried(db, company, elevator, sessions, caplog):
    mydoc = FakeMyDoc(registo())
    mydoc.down = True
    state = PollState()

    with caplog.at_level(logging.WARNING, logger="api.mydoc"):
        assert run_once(mydoc, sessions, state) == []
    assert "MyDoc unavailable" in caplog.text

    mydoc.down = False
    run_once(mydoc, sessions, state)
    assert created(db, "2026/0401") is not None
