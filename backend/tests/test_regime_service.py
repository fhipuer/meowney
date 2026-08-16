from datetime import date, timedelta
from uuid import uuid4

from app.db.sqlite_client import SQLiteClient
from app.services.regime_service import RegimeService
import app.services.regime_service as regime_service_module


def service_for(tmp_path):
    service = RegimeService.__new__(RegimeService)
    service.db = SQLiteClient(tmp_path / "regime.db")
    return service


def add_series(service, indicator_id, values):
    start = date(2025, 1, 1)
    for index, value in enumerate(values):
        service.db.table("regime_observations").insert({
            "id": str(uuid4()),
            "indicator_id": indicator_id,
            "observation_date": (start + timedelta(days=index * 31)).isoformat(),
            "value": value,
            "fetched_at": "2026-08-16T00:00:00+00:00",
            "source": "fred",
        }).execute()


def test_same_data_produces_same_evaluation(tmp_path):
    service = service_for(tmp_path)
    add_series(service, "us_unemployment", [4.0, 4.0, 4.1, 4.5])

    first = service.evaluate()
    second = service.evaluate()

    assert first["id"] == second["id"]
    assert first["candidate_regime"] == "경계"
    assert first["automatic_regime"] == "유지"


def test_hysteresis_requires_second_distinct_confirmation(tmp_path):
    service = service_for(tmp_path)
    add_series(service, "us_unemployment", [4.0, 4.0, 4.1, 4.5])
    first = service.evaluate()
    service.db.table("regime_observations").insert({
        "id": str(uuid4()), "indicator_id": "us_unemployment",
        "observation_date": "2025-06-01", "value": 4.6,
        "fetched_at": "2026-08-16T00:00:00+00:00", "source": "fred",
    }).execute()
    second = service.evaluate()

    assert first["candidate_regime"] == "경계"
    assert second["candidate_regime"] == "경계"
    assert second["automatic_regime"] == "경계"


def test_unrelated_market_update_does_not_confirm_macro_candidate(tmp_path):
    service = service_for(tmp_path)
    add_series(service, "us_unemployment", [4.0, 4.0, 4.1, 4.5])
    first = service.evaluate()
    add_series(service, "market_sp500", [100, 101])
    second = service.evaluate()

    assert first["candidate_regime"] == "경계"
    assert second["candidate_regime"] == "경계"
    assert second["automatic_regime"] == "유지"


def test_restrictive_real_rate_level_is_visible_without_recent_jump():
    score, reason = RegimeService._score(
        "tips10y", 2.39, 0.0, 0.0, [2.39] * 64, 63, 252
    )

    assert score < 0
    assert "제한적 실질금리" in reason


def test_snapshot_keeps_auto_and_user_judgment_separate(tmp_path):
    service = service_for(tmp_path)
    snapshot = service.create_snapshot("경계", "정기 점검", review_completed=True)

    assert snapshot["automatic_regime"] == "유지"
    assert snapshot["user_regime"] == "경계"
    assert snapshot["user_note"] == "정기 점검"
    assert snapshot["signals"] is not None
    assert snapshot["portfolio"] is not None
    assert snapshot["review_urgency"] in {"required", "watch", "not_needed"}
    assert snapshot["coverage"] is not None
    assert snapshot["rule_version"]
    with service.db.connect() as conn:
        acknowledgment = conn.execute("SELECT * FROM regime_review_acknowledgments").fetchone()
    assert acknowledgment is not None
    assert acknowledgment["evaluation_id"] == snapshot["evaluation_id"]


def test_snapshot_does_not_imply_external_review_without_explicit_choice(tmp_path):
    service = service_for(tmp_path)
    snapshot = service.create_snapshot("유지", "상태만 기록")

    assert snapshot["review_completed"] == 0
    with service.db.connect() as conn:
        count = conn.execute("SELECT COUNT(*) FROM regime_review_acknowledgments").fetchone()[0]
    assert count == 0


def test_acknowledgment_covers_same_or_lower_severity_but_not_new_or_escalated_trigger():
    ack = {"trigger_state": {"credit.hy": "high"}}
    same = [{"rule_id": "credit.hy", "severity": "high"}]
    lower = [{"rule_id": "credit.hy", "severity": "medium"}]
    escalated = [{"rule_id": "credit.hy", "severity": "critical"}]
    new = same + [{"rule_id": "rates.jump", "severity": "high"}]

    assert RegimeService._acknowledges(ack, same)
    assert RegimeService._acknowledges(ack, lower)
    assert not RegimeService._acknowledges(ack, escalated)
    assert not RegimeService._acknowledges(ack, new)


def test_complete_review_records_only_ack_context_and_optional_short_note(tmp_path):
    service = service_for(tmp_path)
    result = service.complete_review(" 외부 점검 완료 ")

    assert result["review_acknowledged"] is True
    assert result["needs_new_review"] is False
    assert result["latest_acknowledgment"]["note"] == "외부 점검 완료"
    with service.db.connect() as conn:
        row = conn.execute("SELECT * FROM regime_review_acknowledgments").fetchone()
    assert set(dict(row)) == {"id", "completed_at", "evaluation_id", "trigger_state_json", "note"}


async def test_refresh_persists_yfinance_market_history_in_regime_cache(tmp_path, monkeypatch):
    service = service_for(tmp_path)
    with service.db.connect() as conn:
        conn.execute("UPDATE regime_indicators SET enabled=0")
        conn.execute(
            "UPDATE regime_indicators SET enabled=1, source='yfinance', source_key='^KS11' "
            "WHERE id='market_kospi'"
        )

    class FinanceStub:
        async def get_ticker_history(self, ticker, days):
            assert (ticker, days) == ("^KS11", 550)
            return {"data": [
                {"date": "2026-08-13", "close": 3198.11},
                {"date": "2026-08-14", "close": 3225.66},
            ]}

    monkeypatch.setattr(regime_service_module.settings, "fred_api_key", "test-key")
    monkeypatch.setattr(regime_service_module, "get_finance_service", lambda: FinanceStub())

    result = await service.refresh(force=True)

    assert result["status"] == "success"
    assert result["saved"] == 2
    with service.db.connect() as conn:
        rows = conn.execute(
            "SELECT observation_date,value,source FROM regime_observations "
            "WHERE indicator_id='market_kospi' ORDER BY observation_date"
        ).fetchall()
    assert [tuple(row) for row in rows] == [
        ("2026-08-13", 3198.11, "yfinance"),
        ("2026-08-14", 3225.66, "yfinance"),
    ]
