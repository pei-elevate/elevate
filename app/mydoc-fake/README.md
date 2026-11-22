# Fake MyDoc

Stands in for the CMA's MyDoc (AIRC) until Elevate can reach the real one (ELEV-50).

Applicants submit form 3658 ("Inspeção periódica de elevadores") in MyNet, and MyDoc registers it with a process number and a "Registado em" date. Elevate has no screen to create inspection requests: it fetches them from MyDoc. The real connection goes through AIRC's MyNet Services (SOAP) and needs a paid credential that the CMA has to ask AIRC for, so for now this small FastAPI app plays MyDoc. It only does what Elevate uses: list the registered requests and register a new one.

When the real MyDoc arrives, this folder goes away and only `app/backend/api/mydoc/client.py` changes. How Elevate fetches and checks the requests is in [docs/architecture/README.md](../../docs/architecture/README.md#inspection-requests-from-mydoc).

## Run it

It starts with the rest of the stack:

```sh
docker compose up -d --build
docker compose exec backend python -m api.seed   # the elevators the requests point to
```

| Address | What |
| --- | --- |
| http://localhost:8001/docs | Swagger: list and create requests |
| http://localhost:8001/registos | The requests, as JSON |

The backend asks for new requests every 30 seconds (`MYDOC_POLL_SECONDS`). To see them in Elevate, open http://localhost/atribuidas with the demo profile "Empresa de inspeção".

## API

`GET /registos?desde=2026-11-18T10:05:00` lists the requests registered at or after `desde` (all of them without it), oldest first:

```json
[
  {
    "processo": "2026/0401",
    "registo": "01.05.0079",
    "registado_em": "2026-11-16T09:12:00",
    "tipo_inspecao": "periodic",
    "tipo_equipamento": "elevator"
  }
]
```

`POST /registos` plays the applicant submitting the form. MyDoc gives the process number (the year's next one) and the date (now):

```sh
curl -X POST localhost:8001/registos -H 'content-type: application/json' \
  -d '{"registo": "01.05.0079", "tipo_inspecao": "periodic"}'
```

| Field | On the form | Values |
| --- | --- | --- |
| `processo` | Processo n.º | Given by MyDoc, e.g. `2026/0405` |
| `registo` | Registo n.º | The elevator's internal reference, `01.05.xxxx` |
| `registado_em` | Registado em | Given by MyDoc; local time, no time zone |
| `tipo_inspecao` | Tipo de inspeção | `periodic`, `extraordinary`, `reinspection` |
| `tipo_equipamento` | Tipo de equipamento | `elevator` (default), `goods_lift`, `escalator`, `moving_walkway` |

The values are the same as Elevate's enums (`request_type` and `equipment_type` in [docs/database/schema.dbml](../../docs/database/schema.dbml)). The address, parish and maintenance company on the form are left out: Elevate takes them from the elevator.

## Initial data

The first time it starts, the fake has four requests, for elevators of Elevate's seed (`app/backend/api/seed.py`) that have no open request there:

| Processo | Registo | Tipo | Registado em |
| --- | --- | --- | --- |
| 2026/0401 | 01.05.0079 | periodic | 16/11/2026 09:12 |
| 2026/0402 | 01.05.0112 | extraordinary | 17/11/2026 14:40 |
| 2026/0403 | 01.05.0263 | periodic | 18/11/2026 10:05 |
| 2026/0404 | 01.05.0285 | periodic | 19/11/2026 11:30 |

Useful references from the seed for new requests:

| Registo | What happens in Elevate |
| --- | --- |
| `01.05.0079`, `0112`, `0263`, `0285` | Enter normally (with a warning if the same type is already open) |
| `01.05.0203`, `0247` | Already have an open periodic request: a new periodic one enters with a warning |
| `01.05.0231` | Failed inspection with an open re-inspection (2026/0362): a new `reinspection` is not created |
| `01.05.0154` | Has a scheduled periodic inspection |
| `01.05.9999` (any unknown) | Stays pending in Elevate until an elevator with that reference exists |

## Data and restarts

In `compose.yml` the requests are kept in `/data/registos.json`, in the `mydoc-data` volume (`MYDOC_DATA_FILE`). A restart keeps them, so a process number is never given twice, as in the real MyDoc. Without `MYDOC_DATA_FILE` (the tests) they live in memory.

To start over, delete the volume together with Elevate's database, so the two stay in step:

```sh
docker compose down -v
```

Deleting only one of them makes MyDoc reuse numbers Elevate already has; Elevate keeps its own and logs a warning.

## Demo

[`demo.sh`](demo.sh) shows the flow step by step: a new request arriving, an unknown elevator, a repeated re-inspection, MyDoc going down and coming back. Run it from the repository root, with the stack up and the seed loaded:

```sh
app/mydoc-fake/demo.sh
```

Press Enter between steps and reload http://localhost/atribuidas after each one. `DEMO_AUTO=1` runs it without pauses. To follow what Elevate does with the requests:

```sh
docker compose logs -f backend | grep api.mydoc
```

## Develop

Requires [uv](https://docs.astral.sh/uv/):

```sh
cd app/mydoc-fake
uv sync
uv run pytest
uv run ruff check .
uv run ruff format .
uv run fastapi dev main.py --port 8001
```

CI runs the same checks in the `mydoc-fake` job.
