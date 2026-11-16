"""The test database (tests/conftest.py) runs the migrations against a real Postgres."""

from datetime import date

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, Enum, func, select, text
from sqlalchemy.orm import Session

import api.accounts.models
import api.elevators.models
import api.inspections.models
import api.notices.models
import api.permits.models  # noqa: F401
from api.accounts.models import InspectionCompany
from api.database import Base
from tests.conftest import rolled_back_session


def test_migrations_match_the_models(db: Session):
    context = MigrationContext.configure(db.connection())

    assert compare_metadata(context, Base.metadata) == []


def test_migrations_create_the_model_enums(db: Session):
    # compare_metadata does not compare the values of a Postgres enum.
    rows = db.execute(
        text(
            "SELECT t.typname, e.enumlabel FROM pg_type t"
            " JOIN pg_enum e ON e.enumtypid = t.oid ORDER BY t.typname, e.enumsortorder"
        )
    )
    database_enums: dict[str, list[str]] = {}
    for name, value in rows:
        database_enums.setdefault(name, []).append(value)

    model_enums = {
        column.type.name: list(column.type.enums)
        for table in Base.metadata.tables.values()
        for column in table.columns
        if isinstance(column.type, Enum)
    }
    assert database_enums == model_enums


def test_changes_are_rolled_back_at_the_end_of_the_session(engine: Engine):
    with rolled_back_session(engine) as session:
        session.add(InspectionCompany(name="Inspeave, Lda.", contract_start=date(2026, 1, 1)))
        session.commit()

        assert session.scalars(select(InspectionCompany)).one().name == "Inspeave, Lda."

    with Session(engine) as other:
        assert other.scalar(select(func.count()).select_from(InspectionCompany)) == 0
