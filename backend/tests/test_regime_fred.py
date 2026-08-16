from datetime import date

import httpx
import pytest

from app.services.regime_fred import fetch_all_pages, history_start


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
