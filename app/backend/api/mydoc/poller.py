"""Asks MyDoc for new inspection requests every MYDOC_POLL_SECONDS.

Why polling: as far as we know, MyDoc cannot tell Elevate that a request arrived, so Elevate
has to ask.

What it remembers, and why only in memory
-----------------------------------------
- last_seen: the "Registado em" of the newest request already handled. The next question is
  "what was registered since then?" (the fake's ?desde=), minus LOOKBACK: in the real MyDoc a
  request may become visible after a newer one was already read, and without the margin it
  would be skipped. Requests asked for twice are skipped by their process number.
- pending: requests that are fine but cannot enter yet because something is missing in
  Elevate: the elevator's reference is unknown (registration not approved yet) or no
  inspection company has a contract in force. They are real requests, so they must not be
  lost: while there are pending ones, the question goes back to the oldest of them, and each
  cycle tries them again. Once the elevator or the contract is in Elevate, they enter on
  their own.
- warned: what has already been logged for each process number, so a pending or invalid
  request is reported once (and again only if the reason changes), not every 30 seconds.

None of this is in the database. On a restart, last_seen and pending are empty, so the first
question asks MyDoc for everything: requests Elevate already has are skipped by their process
number, and the pending ones are found again. Nothing is lost; the only cost is that their
warnings are logged once more. warned only grows with requests that never enter, which are
rare.

Known limit: a pending request that never resolves (a mistyped reference, a registration
that is never approved) keeps the question at its date, so every cycle fetches again and
checks every request registered after it. Fine for the MVP; with the real MyDoc's volume,
give pending requests a deadline after which they stop holding the question back.

When to move this to a table: if the municipal manager needs to see the pending requests in
Elevate ("requests to associate"), or if MyDoc stops answering for old dates.
"""

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from api.mydoc import service
from api.mydoc.client import MyDocUnavailable
from api.mydoc.service import Kind, Outcome

log = logging.getLogger(__name__)

Fetch = Callable[[datetime | None], list[Any]]
SessionFactory = Callable[[], Session]

LOOKBACK = timedelta(minutes=10)


@dataclass
class PollState:
    last_seen: datetime | None = None
    pending: dict[str, datetime] = field(default_factory=dict)  # Process number -> registered
    warned: dict[str, str] = field(default_factory=dict)  # Process number -> reason logged

    def since(self) -> datetime | None:
        """Where the next question starts: the oldest pending request, if any, with a margin."""
        start = min(self.pending.values()) if self.pending else self.last_seen
        if start is None or start - datetime.min < LOOKBACK:
            return start
        return start - LOOKBACK


def run_once(fetch: Fetch, session_factory: SessionFactory, state: PollState) -> list[Outcome]:
    """One cycle: fetch, ingest each request in its own session, remember what happened."""
    since = state.since()
    try:
        registos = fetch(since)
    except MyDocUnavailable as error:
        log.warning("MyDoc unavailable, trying again next cycle: %s", error)
        return []

    outcomes = []
    for raw in registos:
        with session_factory() as db:
            try:
                outcome = service.ingest(db, raw)
            except OperationalError as error:
                # The database is down: the other requests would fail the same way. Keep this
                # one pending so the next cycle asks from here, and stop the cycle.
                db.rollback()
                log.warning("Database unavailable, trying again next cycle: %s", error.orig)
                number = _process_number(raw)
                if number is not None:
                    state.pending[number] = since or datetime.min
                break
            except Exception:
                # A bug with this request: keep it pending, so it is asked for again, and go
                # on with the others.
                db.rollback()
                log.exception("Could not handle MyDoc request %r", raw)
                outcome = _unexpected(raw, since, "unexpected error, see the log above")
        _remember(state, outcome)
        outcomes.append(outcome)
    return outcomes


async def poll_forever(fetch: Fetch, session_factory: SessionFactory, interval: float) -> None:
    """Runs until cancelled (when the backend stops). The database work runs in a thread
    because the SQLAlchemy session is synchronous."""
    state = PollState()
    while True:
        try:
            await asyncio.to_thread(run_once, fetch, session_factory, state)
        except Exception:
            log.exception("MyDoc polling cycle failed")
        await asyncio.sleep(interval)


def _remember(state: PollState, outcome: Outcome) -> None:
    number = outcome.process_number
    if outcome.submitted_at is not None and (
        state.last_seen is None or outcome.submitted_at > state.last_seen
    ):
        state.last_seen = outcome.submitted_at

    match outcome.kind:
        case Kind.CREATED:
            log.info("Inspection request %s created from MyDoc", number)
            for warning in outcome.warnings:
                log.warning("Inspection request %s: %s", number, warning)
            _forget(state, number)
        case Kind.DUPLICATE:
            # Only out of pending: forgetting the warnings would log them again every cycle.
            if number is not None:
                state.pending.pop(number, None)
            for warning in outcome.warnings:
                _warn_once(state, number, warning)
        case Kind.PENDING:
            if number is not None and outcome.submitted_at is not None:
                state.pending[number] = outcome.submitted_at
            _warn_once(state, number, f"pending, tried again every cycle: {outcome.reason}")
        case Kind.INVALID:
            _warn_once(state, number, f"invalid, not created: {outcome.reason}")
        case Kind.SKIPPED:
            if number is not None:
                state.pending.pop(number, None)
            _warn_once(state, number, f"skipped: {outcome.reason}")


def _warn_once(state: PollState, number: str | None, message: str) -> None:
    key = number or message
    if state.warned.get(key) != message:
        state.warned[key] = message
        log.warning("MyDoc request %s %s", number or "(no process number)", message)


def _forget(state: PollState, number: str | None) -> None:
    if number is not None:
        state.pending.pop(number, None)
        state.warned.pop(number, None)


def _unexpected(raw: Any, since: datetime | None, reason: str) -> Outcome:
    """Pending at the date this cycle asked from, so the next cycle asks for it again."""
    return Outcome(
        Kind.PENDING,
        _process_number(raw),
        submitted_at=since or datetime.min,
        reason=reason,
    )


def _process_number(raw: Any) -> str | None:
    number = raw.get("processo") if isinstance(raw, dict) else None
    return number if isinstance(number, str) else None
