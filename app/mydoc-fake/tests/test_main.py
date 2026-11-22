from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from main import app, initial_registos, load_registos, next_process_number


@pytest.fixture
def client():
    """Each test starts with the initial requests only, in memory."""
    app.state.data_file = None
    app.state.registos = initial_registos()
    return TestClient(app)


def test_lists_the_initial_requests_oldest_first(client):
    response = client.get("/registos")

    assert response.status_code == 200
    body = response.json()
    assert [r["processo"] for r in body] == ["2026/0401", "2026/0402", "2026/0403", "2026/0404"]
    assert body[0] == {
        "registo": "01.05.0079",
        "tipo_inspecao": "periodic",
        "tipo_equipamento": "elevator",
        "processo": "2026/0401",
        "registado_em": "2026-11-16T09:12:00",
    }


def test_desde_keeps_requests_registered_at_or_after_it(client):
    response = client.get("/registos", params={"desde": "2026-11-18T10:05:00"})

    assert [r["processo"] for r in response.json()] == ["2026/0403", "2026/0404"]


def test_creating_a_request_numbers_and_dates_it(client):
    response = client.post(
        "/registos", json={"registo": "01.05.0203", "tipo_inspecao": "reinspection"}
    )

    assert response.status_code == 201
    created = response.json()
    assert created["processo"] == next_process_number(initial_registos(), datetime.now().year)
    assert created["tipo_equipamento"] == "elevator"
    # Local time without a time zone, like the real "Registado em".
    assert datetime.fromisoformat(created["registado_em"]).tzinfo is None
    assert client.get("/registos").json()[-1] == created


def test_numbers_keep_going_after_each_new_request(client):
    numbers = [
        client.post(
            "/registos", json={"registo": "01.05.0079", "tipo_inspecao": "periodic"}
        ).json()["processo"]
        for _ in range(2)
    ]

    first = next_process_number(initial_registos(), datetime.now().year)
    year, number = first.split("/")
    assert numbers == [first, f"{year}/{int(number) + 1:04d}"]


@pytest.mark.parametrize(
    "body",
    [
        {"tipo_inspecao": "periodic"},
        {"registo": "01.05.0079", "tipo_inspecao": "inspeção"},
        {"registo": "01.05.0079", "tipo_inspecao": "periodic", "tipo_equipamento": "lift"},
    ],
)
def test_rejects_an_incomplete_or_invalid_form(client, body):
    assert client.post("/registos", json=body).status_code == 422


def test_a_new_year_starts_at_one():
    assert next_process_number(initial_registos(), 2027) == "2027/0001"


def test_with_a_data_file_numbering_survives_a_restart(client, tmp_path):
    data_file = tmp_path / "registos.json"
    app.state.data_file = data_file
    first = client.post(
        "/registos", json={"registo": "01.05.0079", "tipo_inspecao": "periodic"}
    ).json()

    # A restart: the requests come back from the file, so the next number is new.
    app.state.registos = load_registos(data_file)
    second = client.post(
        "/registos", json={"registo": "01.05.0112", "tipo_inspecao": "periodic"}
    ).json()

    assert second["processo"] != first["processo"]
    assert [r.processo for r in load_registos(data_file)][-2:] == [
        first["processo"],
        second["processo"],
    ]


def test_without_a_data_file_it_starts_from_the_initial_requests(tmp_path):
    assert load_registos(None) == initial_registos()
    assert load_registos(tmp_path / "missing.json") == initial_registos()


def test_concurrent_requests_never_share_a_process_number(client):
    from concurrent.futures import ThreadPoolExecutor

    def submit(_):
        body = {"registo": "01.05.0079", "tipo_inspecao": "periodic"}
        return client.post("/registos", json=body).json()["processo"]

    with ThreadPoolExecutor(max_workers=8) as pool:
        numbers = list(pool.map(submit, range(20)))

    assert len(set(numbers)) == 20
