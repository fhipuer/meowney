from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest

from app.config import settings
from app.db.sqlite_client import SQLiteClient
from app.services.regime_events import (
    FRED_RELEASES,
    FredRelease,
    RegimeEventService,
    parse_fred_release_dates,
)


def _today():
    return datetime.now(ZoneInfo(settings.timezone)).date()


def _service(tmp_path, handler, *, api_key="a" * 32):
    transport = httpx.MockTransport(handler)
    service = RegimeEventService(
        api_key=api_key,
        client_factory=lambda **kwargs: httpx.AsyncClient(
            transport=transport, **kwargs
        ),
    )
    service.db = SQLiteClient(tmp_path / "events.db")
    return service


def _success_handler(scheduled_date, requests=None):
    def handler(request: httpx.Request):
        if requests is not None:
            requests.append(request)
        release_id = int(request.url.params["release_id"])
        return httpx.Response(
            200,
            json={
                "release_dates": [
                    {"release_id": release_id, "date": scheduled_date.isoformat()}
                ]
            },
        )

    return handler


def test_parse_fred_release_dates_filters_range_and_deduplicates():
    release = FredRelease(10, "CPI", ("inflation", "rates"))
    result = parse_fred_release_dates(
        {
            "release_dates": [
                {"date": "2026-08-01"},
                {"date": "2026-09-11"},
                {"date": "2026-09-11"},
                {"date": "invalid"},
                {"unexpected": "2026-10-01"},
                {"date": "2027-01-01"},
            ]
        },
        release,
        start_date=datetime(2026, 8, 17).date(),
        end_date=datetime(2026, 12, 31).date(),
    )

    assert result == [
        {
            "release_id": 10,
            "title": "CPI",
            "scheduled_date": "2026-09-11",
            "scheduled_at": None,
            "time_precision": "date",
            "importance": "high",
            "affected_domains": ["inflation", "rates"],
            "source": "FRED",
            "source_url": "https://fred.stlouisfed.org/release?rid=10",
        }
    ]


@pytest.mark.asyncio
async def test_refresh_uses_fred_future_dates_and_replaces_legacy_bls_event(tmp_path):
    future = _today() + timedelta(days=20)
    requests = []
    service = _service(tmp_path, _success_handler(future, requests))
    with service.db.connect() as conn:
        conn.execute(
            "INSERT INTO regime_events("
            "id,event_type,scheduled_at,importance,affected_domains_json,status,source,source_url"
            ") VALUES('legacy-cpi','CPI',?,'high','[\"inflation\"]','scheduled','BLS','https://bls.gov')",
            (f"{future.isoformat()}T12:30:00+00:00",),
        )

    result = await service.refresh()

    assert result == {
        "status": "success",
        "saved": len(FRED_RELEASES),
        "source": "FRED",
        "error": None,
    }
    assert len(requests) == len(FRED_RELEASES)
    assert all(
        request.url.params["include_release_dates_with_no_data"] == "true"
        for request in requests
    )
    events = service.upcoming(limit=20)
    assert len(events) == len(FRED_RELEASES)
    assert all(event["source"] == "FRED" for event in events)
    assert all(event["scheduled_at"] is None for event in events)
    assert all(event["scheduled_date"] == future.isoformat() for event in events)
    assert all(event["time_precision"] == "date" for event in events)
    assert len([event for event in events if event["event_type"] == "CPI"]) == 1
    assert service.health()["status"] == "success"
    assert service.health()["source"] == "macro_events"


@pytest.mark.asyncio
async def test_partial_refresh_keeps_cached_events_for_failed_releases(tmp_path):
    future = _today() + timedelta(days=20)
    service = _service(tmp_path, _success_handler(future))
    await service.refresh()

    def partial_handler(request: httpx.Request):
        release_id = int(request.url.params["release_id"])
        if release_id == 10:
            return httpx.Response(
                200,
                json={"release_dates": [{"release_id": 10, "date": future.isoformat()}]},
            )
        return httpx.Response(503, text="temporarily unavailable")

    service.client_factory = lambda **kwargs: httpx.AsyncClient(
        transport=httpx.MockTransport(partial_handler), **kwargs
    )
    result = await service.refresh()

    assert result["status"] == "partial"
    assert result["saved"] == 1
    assert len(service.upcoming(limit=20)) == len(FRED_RELEASES)
    assert service.health()["status"] == "partial"
    assert service.health()["last_success_at"] is not None


@pytest.mark.asyncio
async def test_failed_refresh_preserves_last_successful_calendar_cache(tmp_path):
    future = _today() + timedelta(days=20)
    service = _service(tmp_path, _success_handler(future))
    await service.refresh()
    last_success = service.health()["last_success_at"]

    service.client_factory = lambda **kwargs: httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(503, text="blocked")
        ),
        **kwargs,
    )
    result = await service.refresh()

    assert result["status"] == "failed"
    assert result["saved"] == 0
    assert "a" * 32 not in result["error"]
    assert len(service.upcoming(limit=20)) == len(FRED_RELEASES)
    assert service.health()["status"] == "failed"
    assert service.health()["last_success_at"] == last_success


@pytest.mark.asyncio
async def test_missing_fred_key_is_explicit_and_does_not_call_network(tmp_path):
    service = _service(
        tmp_path,
        lambda request: pytest.fail("network must not be called without a key"),
        api_key="",
    )

    result = await service.refresh()

    assert result["status"] == "configuration_required"
    assert result["saved"] == 0
    assert service.health()["status"] == "configuration_required"
