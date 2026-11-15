from collections.abc import Iterator
from enum import StrEnum

from sqlalchemy import Enum, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from api.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def pg_enum(enum: type[StrEnum], name: str) -> Enum:
    """Postgres enum type that stores the values ("owner"), not the names ("OWNER")."""
    return Enum(enum, name=name, values_callable=lambda e: [m.value for m in e])


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
