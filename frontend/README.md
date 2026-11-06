# Elevate — frontend

Web interface of Elevate, in European Portuguese. React, TypeScript and Vite.

It started as the clickable prototype from [`elevate-mockups`](https://github.com/pei-elevate/elevate-mockups) and keeps its behaviour: sample data in memory, shared between profiles in the same tab, reset on reload. Each feature will move from the sample data to the API as the backend is built.

## Run

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev      # http://localhost:5173
npm test         # Vitest
npm run build    # type-check and production build
```

The **Perfil de demonstração** selector at the bottom of the side menu switches between the five profiles. The chosen profile is kept in memory only: on reload the app goes back to Proprietário. Until authentication exists, there is no way to choose the profile from the address.

## Routes

[React Router](https://reactrouter.com/) in data mode. A single catch-all route renders the app, and `app/Page.tsx` picks the screen from the path `/<page>/<id>`. Examples:
- `/painel`
- `/elevadores`
- `/historico/01.05.0079`
- `/agendar/2026%2F0377`

The id is URL-encoded.

- Pages navigate with `s.go(page, id)` and read `s.route` (`page`, `id`, `role`). They do not use the router directly.
- With unsaved changes, leaving the page asks for confirmation, including the browser's back and forward buttons (`useBlocker`).
- After each navigation, focus moves to the page `h1`.

**Server:** any path must return `index.html`. Vite already does this in `npm run dev` and `npm run preview`. With Caddy, use `try_files {path} /index.html` inside the `file_server` block.

## Where things go

```
src/
  main.tsx        entry point
  app/            app shell: router and layout (App), page selection (Page),
                  navigation, shared prototype state, global styles
  features/       one folder per feature, with everything it needs
    dashboard/      Painel geral
    elevators/      elevator list, details, registration and its validation
    inspections/    inspection requests, scheduling, results, failed inspections
    complaints/     complaints
    permits/        urban planning permits (alvarás) and unregistered elevators
    notices/        official notices (ofícios)
  shared/         code with no feature of its own
    ui/             generic components (Button, Panel, DataTable, Search, …)
    forms/          form building blocks (fields, PDF upload, validation helpers)
    lib/            dates and text utilities
    auth/           profiles (roles)
tests/            Vitest tests
```

Inside a feature folder:

| File | What |
| --- | --- |
| `*Page.tsx` | a screen |
| `*Form.tsx` | a form |
| `types.ts` | data types |
| `rules.ts` | business rules (statuses, deadlines, decisions) |
| `validation.ts` | form validation |
| `mocks.ts` | sample data, to be replaced by the API |

### Rules

- **Dependencies point one way:** `shared/` ← `features/` ← `app/`.
  - `shared/` never imports from `features/` or `app/`.
  - A feature may import another feature's types, rules or small components. Only `dashboard/` is meant to combine several features.
  - Exception, until the API exists: features read and update the prototype state with `usePrototype()` from `app/state.tsx`.
- **Import files directly with the `@/` alias:** for example `import { Panel } from '@/shared/ui/Panel'`. There are no `index.ts` files that re-export a folder.
- **Keep the existing markup:** ids, `aria-*` attributes and texts are covered by the accessibility audit and by the tests.
- **CSS:** it lives in `app/styles/`, split in the original order. `responsive.css` must stay after the rules it adjusts.

## Moving this folder

The frontend is self-contained: nothing outside this folder depends on it, and nothing in it points outside it. To move it, for example to `apps/web`, run `git mv frontend <new path>`. Then update the paths in CI and Docker Compose once those exist.
