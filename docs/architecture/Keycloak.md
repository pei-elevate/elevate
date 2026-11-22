# Keycloak instead of Authentik

Decided at a team meeting in November 2026. The Milestone 3 report chose Authentik for identity; Elevate will use **Keycloak** instead.

## Why

We are thinking long-term about other municipalities using Elevate. Each municipality gets its own Elevate instance, with its own database and its own Keycloak; one instance never serves more than one municipality.

## What changes

- The backend still validates standard OIDC tokens, so only `get_current_user` in `app/backend/api/auth.py` changes when the identity provider is connected.
- Owners will log in with Autenticação.gov through Keycloak.
- The `authentik-*` services in `compose.yml`, the Authentik variables in `.env.example` and the remaining mentions of Authentik in the code and docs are replaced when Keycloak is set up, in its own task.
