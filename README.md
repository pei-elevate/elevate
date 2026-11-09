# Elevate

Information system for the management and inspection of municipal elevators, developed for the Câmara Municipal de Aveiro as a Projeto em Engenharia Informática project at the Universidade de Aveiro.

Project site: https://pei-elevate.github.io/elevate-site/

## Repository layout

| Path | What |
| --- | --- |
| `app/frontend/` | Web interface (React, TypeScript, Vite). It started as the clickable prototype from [`elevate-mockups`](https://github.com/pei-elevate/elevate-mockups) and is being turned into the MVP frontend. See its [README](app/frontend/README.md). |
| `app/backend/` | API (FastAPI, SQLAlchemy, Alembic). One package per area in `api/`: `accounts`, `elevators`, `permits`, `inspections`, `notices` and `mydoc`. |
| `docs/` | Architecture, the data model (`database/schema.dbml`, open it in [dbdiagram.io](https://dbdiagram.io)) and plans. |
| `infra/` | Configuration of the infrastructure services, such as the Nginx reverse proxy. |
| `compose.yml` | Every service of the platform, for development. |

## Run everything

Requires Docker with Docker Compose.

```sh
cp .env.example .env   # then replace the passwords with random values
docker compose up -d --build
```

Every variable has a development default, so it also starts without a `.env`. The database password is only applied when its volume is created: if you change `POSTGRES_PASSWORD` later, run `docker compose down -v` first (this deletes the local database).

| Address | What |
| --- | --- |
| http://localhost | Frontend |
| http://localhost/api/health | Backend health check |
| http://localhost/api/docs | API documentation (Swagger) |
| `localhost:5432` | PostgreSQL |

The frontend and the backend reload when you save a file. The backend applies the database migrations (`alembic upgrade head`) when it starts.

Authentik is not started by default. To start it as well:

```sh
docker compose --profile auth up -d
```

It runs at http://localhost:9000. The first time, create the admin account at http://localhost:9000/if/flow/initial-setup/.

To stop everything, `docker compose down`. Add `-v` to also delete the database.

## Develop without Docker

Backend (requires [uv](https://docs.astral.sh/uv/)):

```sh
cd app/backend
uv sync
uv run pytest             # tests
uv run ruff check .       # lint
uv run ruff format .      # format
uv run fastapi dev api/main.py
```

The tests and the lint do not need a database. To run the backend itself without Docker, start only the database with `docker compose up -d db` and point the backend at it: create `app/backend/.env` (ignored by git) with the same values as the root `.env`:

```sh
POSTGRES_USER=elevate
POSTGRES_PASSWORD=<the same password as in the root .env>
POSTGRES_DB=elevate
```

The backend connects to `localhost:5432` by default; `POSTGRES_HOST` and `POSTGRES_PORT` change it.

Frontend (requires Node.js 22.12 or newer):

```sh
cd app/frontend
npm ci
npm run dev      # http://localhost:5173
npm test         # tests
npm run build    # type check and production build
```

## Database migrations

The tables are created by Alembic migrations in `app/backend/alembic/versions/`, generated from the SQLAlchemy models. With the stack running, after changing a model:

```sh
docker compose exec --user "$(id -u):$(id -g)" backend alembic revision --autogenerate -m "short description"
docker compose exec backend alembic upgrade head
```

The new file appears in `app/backend/alembic/versions/` on your machine (`--user` makes it yours instead of root's). Review it and commit it with the model change. The backend also runs `alembic upgrade head` every time it starts, so the others get the migration on their next `docker compose up`. Keep `docs/database/schema.dbml` in line with the models.

## Contributing

- `main` is protected: changes go through a pull request with one approval and an automatic Copilot review, and are merged with squash.
- Name branches after the Jira issue, for example `SCRUM-48-log-new-elevator-notice`, and include the issue key in the pull request title.
- CI runs the frontend checks (lint, types, tests, build) and the backend checks (lint, format, tests) on every pull request.
