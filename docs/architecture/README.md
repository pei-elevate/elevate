# Architecture

The architecture diagrams live in the team's Google Drive, in the "Arquitetura" folder. The Milestone 3 report lists the technologies and their licenses.

## Services

| Service | Technology | Role |
| --- | --- | --- |
| Reverse proxy | Nginx | Single entry point: `/` goes to the frontend, `/api` to the backend |
| User interface | React, TypeScript, Vite | `app/frontend/` |
| Backend | FastAPI | `app/backend/` |
| Database | PostgreSQL | Schema managed by Alembic migrations |
| File storage | SeaweedFS | Registration documents and inspection reports, through the S3 API only; added with the first story that stores files |
| Authentication | Keycloak ([why](Keycloak.md)) | Accounts and roles over standard OIDC; owners will log in with Autenticação.gov through it |
| Email | SMTP | The CMA relay in production; added with the first story that sends email |
| CMA records | MyDoc (AIRC), external | Source of inspection requests, behind an adapter in `api/mydoc/` |
| Fake MyDoc | FastAPI, `app/mydoc-fake/` | Stands in for MyDoc until the AIRC credential exists; see below |

## Backend layers

Each area in `app/backend/api/` follows the layers of the architecture diagram:

| File | Layer |
| --- | --- |
| `router.py` | Controller: HTTP endpoints |
| `service.py` | Service: business rules |
| `repository.py` | Repository: database queries |
| `models.py` | SQLAlchemy models (tables) |
| `schemas.py` | Pydantic models (request and response bodies) |

Global modules sit at the top of `api/`: `config.py` (settings from environment variables) and `database.py` (engine, session and the declarative base).

## Authentication (provisional)

Until Keycloak is connected, `api/auth.py` takes the user from the `X-User-Id` header, which holds the `external_id` of a row in `users`. After `python -m api.seed`, use `seed-municipal-manager`, `seed-maintenance`, `seed-owner`, `seed-urban-planning` or `seed-inspection`. Endpoints ask for a role with `Depends(require_role(UserRole.X))`. Anyone can send any value, so this must not reach production: when Keycloak arrives, only `get_current_user` changes to validate the OIDC token.

## Inspection requests from MyDoc

Applicants submit form 3658 in MyNet; MyDoc registers it (process number, "Registado em"). Elevate fetches the requests from MyDoc: there is no screen to create them.

- Until the CMA gets the AIRC credential (MyNet Services, SOAP), the `mydoc` service in `compose.yml` plays MyDoc. It starts with four requests for elevators of the seed, and `POST /registos` at http://localhost:8001/docs registers a new one.
- The backend asks it every `MYDOC_POLL_SECONDS` (30) when `MYDOC_URL` is set (`api/mydoc/poller.py`). Each request enters as awaiting scheduling, assigned to the inspection company with a contract in force; a re-inspection is linked to the elevator's last inspection if it failed, and is not created if that failure already has an open re-inspection. A second open periodic or extraordinary request for the same elevator does enter, with a warning: unlike a repeated re-inspection, it may be legitimate. Inactive and sealed elevators also get requests, since a sealed one needs an inspection to return to service.
- A request whose elevator reference or contract is missing in Elevate stays pending in memory and enters on its own once the data is there. Why in memory, and when to move it to a table, is explained in `poller.py`. Pending, invalid and unusual requests are logged by `api.mydoc` (`docker compose logs backend`).
- When the real MyDoc arrives, only `api/mydoc/client.py` changes.
