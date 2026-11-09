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
| Authentication | Authentik | Accounts and roles over standard OIDC; owners will log in with Autenticação.gov through it |
| Email | SMTP | The CMA relay in production; added with the first story that sends email |
| CMA records | MyDoc (AIRC), external | Source of inspection requests, behind an adapter in `api/mydoc/` |

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
