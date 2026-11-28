"""How Elevate talks to MyDoc. The only file that changes when the real MyDoc arrives.

Today it reads the fake MyDoc (app/mydoc-fake) over JSON. The real one is reached through
AIRC's MyNet Services (SOAP), with a credential the CMA has to ask AIRC for. Whatever the
protocol, this module has to keep returning the requests as dicts with the fields of
api.mydoc.schemas.Registo, and raise MyDocUnavailable when MyDoc cannot be read.
"""

from datetime import datetime
from typing import Any

import httpx


class MyDocUnavailable(Exception):
    """MyDoc did not answer, answered with an error or sent something that is not a list."""


def fetch_registos(
    since: datetime | None,
    *,
    base_url: str,
    timeout: float,
    transport: httpx.BaseTransport | None = None,
) -> list[Any]:
    """Requests registered at or after since (all of them when since is None), oldest first.

    Each item is checked later, one by one, so a bad request does not hide the others.
    """
    params = {"desde": since.isoformat()} if since is not None else {}
    try:
        with httpx.Client(base_url=base_url, timeout=timeout, transport=transport) as client:
            response = client.get("/registos", params=params)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise MyDocUnavailable(f"{type(error).__name__}: {error}") from error
    if not isinstance(data, list):
        raise MyDocUnavailable(f"expected a list of requests, got {type(data).__name__}")
    return data
