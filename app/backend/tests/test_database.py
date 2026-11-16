"""The test database (tests/conftest.py) runs the migrations against a real Postgres."""

from datetime import date

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from api.accounts.models import InspectionCompany
from api.database import Base


def test_migrations_create_every_model_table(db: Session):
    tables = set(inspect(db.connection()).get_table_names())

    assert set(Base.metadata.tables) <= tables


def test_rows_from_a_test_are_rolled_back(db: Session):
    db.add(InspectionCompany(name="Inspeave, Lda.", contract_start=date(2026, 1, 1)))
    db.commit()

    assert db.scalars(select(InspectionCompany)).one().name == "Inspeave, Lda."


def test_each_test_starts_with_empty_tables(db: Session):
    assert db.scalars(select(InspectionCompany)).all() == []
