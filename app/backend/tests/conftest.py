import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from testcontainers.community.postgres import PostgresContainer

from alembic import command

# api.config refuses to load without these. Tests that do not use the db fixture never
# connect to the database, so placeholder values are enough; real ones (e.g. from .env)
# take precedence. The api modules are imported inside the fixtures, after these are set.
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")
os.environ.setdefault("POSTGRES_DB", "test")

# Same image as the db service in compose.yml.
POSTGRES_IMAGE = "postgres:18.6-alpine"
ALEMBIC_INI = Path(__file__).parents[1] / "alembic.ini"


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """A real Postgres in Docker, started once for the whole test run, with the migrations
    applied. Only started if a test asks for it (through db or client)."""
    with PostgresContainer(POSTGRES_IMAGE, driver="psycopg") as postgres:
        engine = create_engine(postgres.get_connection_url())

        config = Config(ALEMBIC_INI)
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")

        yield engine
        engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    """A session whose changes are rolled back at the end of the test, so each test starts
    with empty tables. Commits made by the code under test only release a savepoint."""
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(
            bind=connection,
            join_transaction_mode="create_savepoint",
            autoflush=False,
            expire_on_commit=False,
        )
        yield session
        session.close()
        transaction.rollback()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    """A TestClient whose endpoints use the test session instead of the real database."""
    from api.database import get_db
    from api.main import app

    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db)
