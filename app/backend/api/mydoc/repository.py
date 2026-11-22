from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from api.elevators.models import Elevator
from api.inspections.models import Inspection, InspectionRequest, RequestStatus, RequestType


def find_request(db: Session, process_number: str) -> InspectionRequest | None:
    return db.scalar(
        select(InspectionRequest).where(InspectionRequest.process_number == process_number)
    )


def find_elevator(db: Session, internal_reference: str) -> Elevator | None:
    return db.scalar(select(Elevator).where(Elevator.internal_reference == internal_reference))


def latest_inspection(db: Session, elevator_id: int) -> Inspection | None:
    """The elevator's most recent inspection, by the date it was performed."""
    return db.scalar(
        select(Inspection)
        .join(InspectionRequest, Inspection.request_id == InspectionRequest.id)
        .where(InspectionRequest.elevator_id == elevator_id)
        .order_by(Inspection.performed_date.desc(), Inspection.id.desc())
        .limit(1)
    )


def has_open_reinspection(db: Session, inspection_id: int) -> bool:
    """Whether a re-inspection of this failed inspection is still waiting or scheduled."""
    return db.scalar(
        select(
            exists().where(
                InspectionRequest.original_inspection_id == inspection_id,
                InspectionRequest.status != RequestStatus.COMPLETED,
            )
        )
    )


def has_open_request(db: Session, elevator_id: int, request_type: RequestType) -> bool:
    """Whether the elevator already has a request of this type that is not completed."""
    return db.scalar(
        select(
            exists().where(
                InspectionRequest.elevator_id == elevator_id,
                InspectionRequest.type == request_type,
                InspectionRequest.status != RequestStatus.COMPLETED,
            )
        )
    )
