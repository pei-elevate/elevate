# Elevate

Information system for the management and inspection of municipal elevators, developed for the Câmara Municipal de Aveiro as a Projeto em Engenharia Informática project at the Universidade de Aveiro.

Project site: https://pei-elevate.github.io/elevate-site/

## Repository layout

| Path | What |
| --- | --- |
| `frontend/` | Web interface (React, TypeScript, Vite). It currently holds the clickable prototype from [`elevate-mockups`](https://github.com/pei-elevate/elevate-mockups), which is being turned into the MVP frontend. |

The backend and infrastructure will be added as the MVP is built.

## Run the frontend

Requires Node.js 22.12 or newer.

```sh
cd frontend
npm ci
npm run dev
```

Open the address shown by Vite, usually http://localhost:5173.

```sh
npm test        # tests
npm run build   # type-check and production build
```

## Contributing

- `main` is protected: changes go through a pull request with one approval and an automatic Copilot review, and are merged with squash.
- Name branches after the Jira issue, for example `ELEV-12-validate-registration`, and include the issue key in the pull request title.
