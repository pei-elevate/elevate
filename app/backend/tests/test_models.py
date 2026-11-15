"""The SQLAlchemy models must match the data model in docs/database/schema.dbml."""

import re
from pathlib import Path

import pytest
from sqlalchemy import Enum

import api.accounts.models
import api.elevators.models
import api.inspections.models
import api.notices.models
import api.permits.models  # noqa: F401
from api.database import Base

SCHEMA = (Path(__file__).parents[3] / "docs" / "database" / "schema.dbml").read_text()

DBML_ENUMS = {
    name: [line.split()[0] for line in body.strip().splitlines()]
    for name, body in re.findall(r"^Enum (\w+) \{\n(.*?)^\}", SCHEMA, re.M | re.S)
}

# {table: {column: settings}}, where settings is the text between [...] on the column line.
DBML_TABLES = {
    name: {
        column: settings or ""
        for column, settings in re.findall(r"^  (\w+) \w+(?: \[(.*)\])?$", body, re.M)
        if column != "Note"
    }
    for name, body in re.findall(r"^Table (\w+) \{\n(.*?)^\}", SCHEMA, re.M | re.S)
}

DBML_COLUMNS = [(table, column) for table, columns in DBML_TABLES.items() for column in columns]


def model_enums() -> dict[str, list[str]]:
    return {
        column.type.name: list(column.type.enums)
        for table in Base.metadata.tables.values()
        for column in table.columns
        if isinstance(column.type, Enum)
    }


def test_schema_is_parsed():
    assert len(DBML_TABLES) == 11
    assert len(DBML_ENUMS) == 11


def test_same_tables():
    assert set(Base.metadata.tables) == set(DBML_TABLES)


def test_same_enums():
    assert model_enums() == DBML_ENUMS


@pytest.mark.parametrize("table", DBML_TABLES)
def test_same_columns(table):
    assert set(Base.metadata.tables[table].columns.keys()) == set(DBML_TABLES[table])


@pytest.mark.parametrize(("table", "column"), DBML_COLUMNS)
def test_column_settings(table, column):
    settings = DBML_TABLES[table][column]
    model = Base.metadata.tables[table].columns[column]

    primary_key = "pk" in settings
    assert model.primary_key == primary_key
    assert model.nullable == (not primary_key and "not null" not in settings)
    if not primary_key:
        assert bool(model.unique) == ("unique" in settings)

    ref = re.search(r"ref: [>-] (\w+\.\w+)", settings)
    targets = [key.target_fullname for key in model.foreign_keys]
    assert targets == ([ref.group(1)] if ref else [])

    default = re.search(r"default: (?:'(\w+)'|`(.*?)`)", settings)
    server_default = model.server_default.arg if model.server_default is not None else None
    expected = (default.group(1) or default.group(2)) if default else None
    assert str(getattr(server_default, "text", server_default)) == str(expected)
