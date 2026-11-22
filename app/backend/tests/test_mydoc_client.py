"""The HTTP client that reads MyDoc (ELEV-50)."""

from datetime import datetime

import httpx
import pytest

from api.mydoc.client import MyDocUnavailable, fetch_registos


def fetch(handler, since=None):
    return fetch_registos(
        since, base_url="http://mydoc", timeout=1, transport=httpx.MockTransport(handler)
    )


def test_returns_the_list_and_sends_desde():
    seen = []

    def handler(request):
        seen.append(request.url)
        return httpx.Response(200, json=[{"processo": "2026/0401"}])

    assert fetch(handler, datetime(2026, 11, 20, 10, 30)) == [{"processo": "2026/0401"}]
    assert seen[0].path == "/registos"
    assert seen[0].params["desde"] == "2026-11-20T10:30:00"


def test_without_since_asks_for_everything():
    seen = []

    def handler(request):
        seen.append(request.url)
        return httpx.Response(200, json=[])

    fetch(handler)
    assert "desde" not in seen[0].params


def timeout(request):
    raise httpx.ReadTimeout("timed out", request=request)


def refused(request):
    raise httpx.ConnectError("connection refused", request=request)


@pytest.mark.parametrize(
    "handler",
    [
        timeout,
        refused,
        lambda request: httpx.Response(500, text="Internal Server Error"),
        lambda request: httpx.Response(200, text="<html>not json</html>"),
        lambda request: httpx.Response(200, json={"registos": []}),
    ],
    ids=["timeout", "refused", "server-error", "not-json", "not-a-list"],
)
def test_any_failure_becomes_mydoc_unavailable(handler):
    with pytest.raises(MyDocUnavailable):
        fetch(handler)
