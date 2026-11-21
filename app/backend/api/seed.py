"""Sample data for development, taken from the frontend prototype mocks.

Run it by hand, with the stack up:

    docker compose exec backend python -m api.seed

It empties every table first, so it can be run again without duplicating rows.
Never run it against real data: it is meant for development and tests only.
NIFs, emails, postal codes and dates missing from the mocks are made up.
"""

from datetime import date, datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from api.accounts.models import (
    InspectionCompany,
    MaintenanceCompany,
    Owner,
    OwnerType,
    User,
    UserRole,
)
from api.database import Base, SessionLocal
from api.elevators.models import Elevator, EquipmentType, ReferenceCounter, RegistrationStatus
from api.inspections.models import (
    FailedInspectionStatus,
    Inspection,
    InspectionRequest,
    InspectionResult,
    RequestStatus,
    RequestType,
)
from api.notices.models import Notice, NoticeType
from api.permits.models import Permit

POSTAL_CODE = "3810-000"

# (reference, owner, address, parish, maintenance company), as in elevators/mocks.ts.
ELEVATORS = [
    ("01.05.0079", "Condomínio Edifício Ria", "Rua de Viseu 12", "Glória e Vera Cruz", "Elevar"),
    ("01.05.0112", "Condomínio Edifício Ria", "Rua de Viseu 14", "Glória e Vera Cruz", "Elevar"),
    (
        "01.05.0154",
        "Condomínio Edifício Ria",
        "Av. Dr. Lourenço Peixinho 85",
        "Glória e Vera Cruz",
        "Elevar",
    ),
    ("01.05.0203", "Condomínio Mendonça 5", "Rua João Mendonça 5", "Glória e Vera Cruz", "Elevar"),
    (
        "01.05.0231",
        "Condomínio Von Haff 40",
        "Rua Eng. Von Haff 40",
        "Glória e Vera Cruz",
        "Elevar",
    ),
    ("01.05.0247", "Condomínio Beringela", "Rua Direita 64", "Esgueira", "Ascende"),
    ("01.05.0263", "Condomínio das Neves", "Rua Dr. Manuel das Neves 21", "Esgueira", "Elevar"),
    ("01.05.0285", "Condomínio da Pega", "Rua da Pega 14", "Esgueira", "Elevar"),
]


def clear(db: Session) -> None:
    """Empty every table and restart the ids at 1."""
    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    db.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


def seed(db: Session) -> None:
    clear(db)

    # Companies
    elevar = MaintenanceCompany(
        name="Elevar, Lda.", nif="509000001", email="geral@elevar.exemplo.pt", phone="234000001"
    )
    ascende = MaintenanceCompany(
        name="Ascende, Lda.", nif="509000002", email="geral@ascende.exemplo.pt", phone="234000002"
    )
    inspeave = InspectionCompany(
        name="Inspeave, Lda.",
        nif="509000003",
        email="geral@inspeave.exemplo.pt",
        phone="234000003",
        contract_start=date(2025, 1, 1),
    )
    maintenance = {"Elevar": elevar, "Ascende": ascende}
    db.add_all([elevar, ascende, inspeave])

    # Owners, one per condominium in the mocks
    owner_names = dict.fromkeys(name for _, name, *_ in ELEVATORS)
    owner_names.update(
        dict.fromkeys(["Condomínio Gravito 18", "Condomínio Cónego Maio", "Condomínio Viseu 30"])
    )
    owners = {
        name: Owner(
            type=OwnerType.CONDOMINIUM,
            name=name,
            nif=f"9000000{i:02d}",
            email=f"administracao{i}@exemplo.pt",
        )
        for i, name in enumerate(owner_names, start=1)
    }
    db.add_all(owners.values())
    db.flush()

    # One account per profile, with the names shown in the prototype (App.tsx)
    urbanismo = User(
        external_id="seed-urban-planning",
        name="Ana Rodrigues",
        email="ana.rodrigues@exemplo.pt",
        role=UserRole.URBAN_PLANNING,
    )
    manager = User(
        external_id="seed-municipal-manager",
        name="Augusta Jesus",
        email="augusta.jesus@exemplo.pt",
        role=UserRole.MUNICIPAL_MANAGER,
    )
    db.add_all(
        [
            User(
                external_id="seed-owner",
                name="Condomínio Edifício Ria",
                email="ria@exemplo.pt",
                role=UserRole.OWNER,
                owner_id=owners["Condomínio Edifício Ria"].id,
            ),
            User(
                external_id="seed-maintenance",
                name="Elevar, Lda.",
                email="elevar@exemplo.pt",
                role=UserRole.MAINTENANCE,
                maintenance_company_id=elevar.id,
            ),
            urbanismo,
            manager,
            User(
                external_id="seed-inspection",
                name="Inspeave, Lda.",
                email="inspeave@exemplo.pt",
                role=UserRole.INSPECTION,
                inspection_company_id=inspeave.id,
            ),
        ]
    )
    db.flush()

    # Permits (permits/mocks.ts)
    permits = {
        number: Permit(
            created_by=urbanismo.id,
            owner_id=owners[owner].id,
            permit_number=number,
            permit_date=permit_date,
            address=address,
            postal_code=POSTAL_CODE,
            parish=parish,
            num_elevators=count,
        )
        for number, owner, address, parish, permit_date, count in [
            (
                "104/2026",
                "Condomínio Cónego Maio",
                "Rua Cónego Maio 22",
                "Esgueira",
                date(2026, 9, 24),
                2,
            ),
            (
                "118/2026",
                "Condomínio Gravito 18",
                "Rua do Gravito 18",
                "Glória e Vera Cruz",
                date(2026, 10, 7),
                1,
            ),
            (
                "097/2026",
                "Condomínio Viseu 30",
                "Rua de Viseu 30",
                "Glória e Vera Cruz",
                date(2026, 9, 11),
                1,
            ),
        ]
    }
    db.add_all(permits.values())
    db.flush()

    # The missing-registration alert already sent for 097/2026 (alerted in permits/mocks.ts)
    viseu = owners["Condomínio Viseu 30"]
    db.add(
        Notice(
            type=NoticeType.MISSING_REGISTRATION,
            permit_id=permits["097/2026"].id,
            sent_by=manager.id,
            subject="Elevador sem registo",
            body=(
                "O alvará 097/2026 inclui um elevador que ainda não foi registado na "
                "plataforma elevate. Peça à empresa de manutenção que faça o registo."
            ),
            recipients=f"{viseu.name} <{viseu.email}>",
            created_at=datetime(2026, 9, 28, 10, 0),
        )
    )

    # Registered elevators (elevators/mocks.ts)
    elevators = {
        reference: Elevator(
            internal_reference=reference,
            dge_number=f"DGE-10{reference[-3:]}",
            owner_id=owners[owner].id,
            maintenance_company_id=maintenance[company].id,
            address=address,
            postal_code=POSTAL_CODE,
            parish=parish,
            service_date=date(2015, 1, 1),
            registration_status=RegistrationStatus.APPROVED,
        )
        for reference, owner, address, parish, company in ELEVATORS
    }
    # Registrations waiting for approval (registrations in elevators/mocks.ts)
    pending = [
        Elevator(
            owner_id=owners["Condomínio Gravito 18"].id,
            maintenance_company_id=elevar.id,
            permit_id=permits["118/2026"].id,
            address="Rua do Gravito 18",
            postal_code=POSTAL_CODE,
            parish="Glória e Vera Cruz",
            service_date=date(2026, 10, 1),
            registration_document="contrato-manutencao.pdf",
        ),
        Elevator(
            owner_id=owners["Condomínio Cónego Maio"].id,
            maintenance_company_id=ascende.id,
            permit_id=permits["104/2026"].id,
            address="Rua Cónego Maio 22",
            postal_code=POSTAL_CODE,
            parish="Esgueira",
            service_date=date(2026, 9, 20),
            registration_document="contrato-manutencao.pdf",
        ),
    ]
    db.add_all([*elevators.values(), *pending])
    db.add(ReferenceCounter(prefix="01.05", last_number=285))
    db.flush()

    def request(number, reference, submitted, type_, status, scheduled=None, original=None):
        return InspectionRequest(
            process_number=number,
            elevator_id=elevators[reference].id,
            inspection_company_id=inspeave.id,
            original_inspection_id=original,
            type=type_,
            equipment_type=EquipmentType.ELEVATOR,
            status=status,
            submitted_at=submitted,
            scheduled_at=scheduled,
        )

    # Failed inspection behind the re-inspection 2026/0362 (failedInspections in the mocks).
    # Its process number is made up.
    failed_request = request(
        "2026/0270",
        "01.05.0231",
        datetime(2026, 8, 1),
        RequestType.PERIODIC,
        RequestStatus.COMPLETED,
        datetime(2026, 9, 18, 10, 0),
    )
    approved_request = request(
        "2025/0118",
        "01.05.0112",
        datetime(2025, 1, 14),
        RequestType.PERIODIC,
        RequestStatus.COMPLETED,
        datetime(2025, 3, 3, 10, 0),
    )
    db.add_all([failed_request, approved_request])
    db.flush()

    failed = Inspection(
        request_id=failed_request.id,
        performed_date=date(2026, 9, 18),
        result=InspectionResult.FAILED,
        correction_deadline=date(2026, 10, 18),
        nonconformities="Porta de patamar sem encravamento eficaz.",
        failed_status=FailedInspectionStatus.RESOLVED,
        report_file="relatorio-2026-0270.pdf",
    )
    approved = Inspection(
        request_id=approved_request.id,
        performed_date=date(2025, 3, 3),
        result=InspectionResult.APPROVED,
        valid_until=date(2027, 3, 3),
        report_file="relatorio-2025-0118.pdf",
    )
    db.add_all([failed, approved])
    db.flush()

    # Open requests (requests in inspections/mocks.ts)
    db.add_all(
        [
            request(
                "2026/0377",
                "01.05.0203",
                datetime(2026, 10, 8),
                RequestType.PERIODIC,
                RequestStatus.AWAITING_SCHEDULING,
            ),
            request(
                "2026/0369",
                "01.05.0247",
                datetime(2026, 10, 7),
                RequestType.PERIODIC,
                RequestStatus.AWAITING_SCHEDULING,
            ),
            request(
                "2026/0362",
                "01.05.0231",
                datetime(2026, 10, 9),
                RequestType.REINSPECTION,
                RequestStatus.AWAITING_SCHEDULING,
                original=failed.id,
            ),
            request(
                "2026/0341",
                "01.05.0154",
                datetime(2026, 10, 2),
                RequestType.PERIODIC,
                RequestStatus.SCHEDULED,
                datetime(2026, 11, 19, 10, 0),
            ),
        ]
    )

    # Notices of the elevators of Condomínio Edifício Ria (notices in the mocks)
    ria = owners["Condomínio Edifício Ria"]
    recipients = f"{ria.name} <{ria.email}>; {elevar.name} <{elevar.email}>"
    db.add_all(
        [
            Notice(
                type=NoticeType.INSPECTION_DUE,
                elevator_id=elevators["01.05.0079"].id,
                subject="Prazo da inspeção periódica",
                body=(
                    "A inspeção periódica do elevador 01.05.0079 deve ser feita nos próximos "
                    "60 dias. Peça a inspeção à Câmara Municipal de Aveiro."
                ),
                recipients=recipients,
                created_at=datetime(2026, 10, 13, 9, 0),
            ),
            Notice(
                type=NoticeType.INSPECTION_REQUIRED,
                elevator_id=elevators["01.05.0079"].id,
                sent_by=manager.id,
                subject="Inspeção necessária",
                body=(
                    "O elevador 01.05.0079 precisa de ser inspecionado. Peça a inspeção à "
                    "Câmara Municipal de Aveiro com a maior brevidade."
                ),
                recipients=recipients,
                created_at=datetime(2026, 11, 2, 11, 30),
            ),
            Notice(
                type=NoticeType.INSPECTION_DUE,
                elevator_id=elevators["01.05.0154"].id,
                subject="Prazo da inspeção periódica",
                body=(
                    "A inspeção periódica do elevador 01.05.0154 deve ser feita nos próximos "
                    "60 dias. Peça a inspeção à Câmara Municipal de Aveiro."
                ),
                recipients=recipients,
                created_at=datetime(2026, 4, 21, 9, 0),
            ),
        ]
    )
    db.commit()


def main() -> None:
    with SessionLocal() as db:
        seed(db)
    print("Sample data loaded.")


if __name__ == "__main__":
    main()
