import os
import re
from collections.abc import Iterator
from contextlib import contextmanager
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
#
# Warning: api.database.engine and SessionLocal are created from these placeholders, so they
# point to a database that does not exist. Only get_db is swapped for the test session (see
# the client fixture). A test that uses engine or SessionLocal directly fails to connect;
# use the db fixture instead.
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")
os.environ.setdefault("POSTGRES_DB", "test")

ROOT = Path(__file__).parents[3]
ALEMBIC_INI = ROOT / "app" / "backend" / "alembic.ini"


def compose_db_image() -> str:
    """The image of the db service in compose.yml, so the tests use the same Postgres."""
    compose = (ROOT / "compose.yml").read_text()
    match = re.search(r"^  db:\n(?:    .*\n)*?    image: (\S+)$", compose, re.M)
    if match is None:
        raise RuntimeError("compose.yml has no image for the db service")
    return match.group(1)


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """A real Postgres in Docker, started once for the whole test run, with the migrations
    applied. Only started if a test asks for it (through db or client)."""
    with PostgresContainer(compose_db_image(), driver="psycopg") as postgres:
        engine = create_engine(postgres.get_connection_url())

        config = Config(ALEMBIC_INI)
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")

        yield engine
        engine.dispose()


@contextmanager
def rolled_back_session(engine: Engine) -> Iterator[Session]:
    """A session whose changes are all rolled back when the block ends. Commits made inside
    it only release a savepoint, so nothing reaches the database."""
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
def db(engine: Engine) -> Iterator[Session]:
    """A session whose changes are rolled back at the end of the test, so each test starts
    with empty tables."""
    with rolled_back_session(engine) as session:
        yield session


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    """A TestClient whose endpoints use the test session instead of the real database."""
    from api.database import get_db
    from api.main import app

    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db)
