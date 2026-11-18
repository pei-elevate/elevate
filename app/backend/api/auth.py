"""Who is calling the API.

Provisional until Authentik is connected: the user comes from the X-User-Id header, which
holds the external_id of a row in users (e.g. "seed-municipal-manager" from api.seed). Anyone
can send any value, so this must not reach production. When Authentik arrives, only
get_current_user changes: it validates the OIDC token and finds the user by its subject.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.accounts.models import User, UserRole
from api.database import get_db


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    x_user_id: Annotated[str | None, Header()] = None,
) -> User:
    user = db.scalar(select(User).where(User.external_id == x_user_id)) if x_user_id else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


def require_role(*roles: UserRole) -> Callable[..., User]:
    """Dependency that only lets through users with one of the given roles."""

    def check(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed for this role")
        return user

    return check
