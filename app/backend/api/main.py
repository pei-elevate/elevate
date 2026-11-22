import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress
from functools import partial

from fastapi import APIRouter, FastAPI

from api.config import settings
from api.database import SessionLocal
from api.elevators.elevators_router import router as elevators_router
from api.elevators.router import router as registrations_router
from api.inspections.router import router as inspections_router
from api.mydoc import client as mydoc_client
from api.mydoc import poller as mydoc_poller
from api.permits.router import router as permits_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    """Fetches the inspection requests from MyDoc while the backend runs, if MYDOC_URL is set."""
    if not settings.mydoc_url:
        yield
        return

    # Uvicorn only shows its own loggers; this makes the MyDoc ones visible too.
    mydoc_log = logging.getLogger("api.mydoc")
    if not mydoc_log.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s - %(message)s"))
        mydoc_log.addHandler(handler)
        mydoc_log.setLevel(logging.INFO)
        mydoc_log.propagate = False

    fetch = partial(
        mydoc_client.fetch_registos,
        base_url=settings.mydoc_url,
        timeout=settings.mydoc_timeout_seconds,
    )
    task = asyncio.create_task(
        mydoc_poller.poll_forever(fetch, SessionLocal, settings.mydoc_poll_seconds)
    )
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(
    title="Elevate API",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


router.include_router(registrations_router)
router.include_router(elevators_router)
router.include_router(permits_router)
router.include_router(inspections_router)
app.include_router(router)
