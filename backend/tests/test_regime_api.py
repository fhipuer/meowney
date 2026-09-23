import pytest

import app.api.v1.regime as regime_api


class RefreshStub:
    def __init__(self, result):
        self.result = result

    async def refresh(self, *args, **kwargs):
        return self.result


def test_regime_router_no_longer_exposes_a_separate_export():
    assert "/export" not in {route.path for route in regime_api.router.routes}


@pytest.mark.asyncio
async def test_dashboard_summary_uses_persisted_lightweight_service(monkeypatch):
    expected = {
        "available": True,
        "evaluated_at": "2026-09-24T00:00:00+00:00",
        "automatic_regime": "경계",
        "review_urgency": "watch",
        "review_acknowledged": False,
        "needs_new_review": False,
        "active_trigger_count": 2,
    }

    class SummaryStub:
        def dashboard_summary(self):
            return expected

    monkeypatch.setattr(regime_api, "RegimeService", SummaryStub)

    assert await regime_api.get_regime_dashboard_summary() == expected


@pytest.mark.asyncio
async def test_aggregate_refresh_reports_partial_when_one_feed_fails(monkeypatch):
    monkeypatch.setattr(regime_api, "RegimeService", lambda: RefreshStub({"status": "success"}))
    monkeypatch.setattr(regime_api, "TreasuryYieldService", lambda: RefreshStub({"status": "success"}))
    monkeypatch.setattr(regime_api, "RegimeEventService", lambda: RefreshStub({"status": "failed", "error": "calendar"}))
    monkeypatch.setattr(regime_api, "SecCapexService", lambda: RefreshStub({"status": "success"}))
    monkeypatch.setattr(regime_api, "MemoryPriceService", lambda: RefreshStub({"status": "cached"}))
    monkeypatch.setattr(regime_api, "RegimeThesisDataService", lambda: RefreshStub({"status": "success"}))

    result = await regime_api.refresh_regime_data(force=True)

    assert result["status"] == "partial"
    assert result["events"]["status"] == "failed"


@pytest.mark.asyncio
async def test_aggregate_refresh_reports_success_only_when_all_feeds_are_healthy(monkeypatch):
    for name in (
        "RegimeService",
        "TreasuryYieldService",
        "RegimeEventService",
        "SecCapexService",
        "MemoryPriceService",
        "RegimeThesisDataService",
    ):
        monkeypatch.setattr(regime_api, name, lambda: RefreshStub({"status": "success"}))

    result = await regime_api.refresh_regime_data()

    assert result["status"] == "success"
