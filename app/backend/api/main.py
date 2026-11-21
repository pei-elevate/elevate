from fastapi import APIRouter, FastAPI

from api.elevators.elevators_router import router as elevators_router
from api.elevators.router import router as registrations_router
from api.inspections.router import router as inspections_router
from api.permits.router import router as permits_router

app = FastAPI(
    title="Elevate API",
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
