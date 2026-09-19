from datetime import date

import httpx
import pytest

from app.services.regime_fred import (
    fetch_all_pages,
    history_start,
    incremental_start,
    safe_error_message,
)


@pytest.mark.asyncio
async def test_fetch_all_pages_keeps_first_and_last_observation():
    observations = [{"date": f"{index:04d}-01-01", "value": str(index)} for index in range(1005)]

    def handler(request: httpx.Request) -> httpx.Response:
        offset = int(request.url.params.get("offset", 0))
        limit = int(request.url.params.get("limit", 1000))
        return httpx.Response(200, json={"count": len(observations), "observations": observations[offset:offset + limit]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await fetch_all_pages(client, "https://example.test/fred", {"series_id": "TEST"})

    assert len(result) == 1005
    assert result[0]["value"] == "0"
    assert result[-1]["value"] == "1004"


def test_history_start_depends_on_series_frequency():
    today = date(2026, 8, 16)
    assert history_start("daily", today) == "2016-08-16"
    assert history_start("monthly", today) == "1996-08-16"


def test_incremental_start_overlaps_recent_data_for_revisions():
    today = date(2026, 9, 19)
    assert incremental_start("daily", "2026-09-11", today) == "2026-07-28"
    assert incremental_start("monthly", "2026-08-01", today) == "2025-06-27"


@pytest.mark.asyncio
async def test_fetch_all_pages_retries_transient_http_failure():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, json={"error_message": "temporarily unavailable"})
        return httpx.Response(200, json={"count": 1, "observations": [{"date": "2026-09-11", "value": "1340.3"}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await fetch_all_pages(
            client, "https://example.test/fred", {"series_id": "DEXKOUS"},
            backoff_seconds=0,
        )

    assert attempts == 2
    assert result[-1]["value"] == "1340.3"


def test_safe_error_message_redacts_credentials_and_urls():
    rendered = safe_error_message(
        RuntimeError("failed https://fred.test/path?api_key=secret-key"),
        "secret-key",
    )
    assert "secret-key" not in rendered
    assert "https://" not in rendered
