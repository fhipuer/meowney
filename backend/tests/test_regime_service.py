from datetime import date, datetime, timedelta
import sqlite3

import pytest
from uuid import uuid4

from app.db.sqlite_client import SQLiteClient
from app.services.regime_service import RegimeService
import app.services.regime_service as regime_service_module


def service_for(tmp_path):
    service = RegimeService.__new__(RegimeService)
    service.db = SQLiteClient(tmp_path / "regime.db")
    return service


def test_thesis_snapshot_changes_compare_each_independent_stage():
    previous = {
        "ai_capex": {"state": "높은 투자 지속"},
        "memory_cycle": {"state": "가격 상승", "nand_state": "가격 유지"},
        "semiconductor_cycle": {
            "dram_bottleneck": {"state": "가격 상승 확인"},
            "hbm_server_proxy": {"state": "타이트 관찰"},
            "demand": {"state": "수출 증가"},
            "supply": {"state": "수급 개선"},
            "company_confirmation": {"state": "확장 확인"},
        },
        "power_cycle": {"state": "완만한 변화"},
    }
    current = {
        "ai_capex": {"state": "높은 투자 지속"},
        "memory_cycle": {"state": "가격 상승", "nand_state": "관측가격 상승"},
        "semiconductor_cycle": {
            "dram_bottleneck": {"state": "타이트 신호"},
            "hbm_server_proxy": {"state": "타이트 지속 신호"},
            "demand": {"state": "수출 증가"},
            "supply": {"state": "재고 부담"},
            "company_confirmation": {"state": "실적 둔화"},
        },
        "power_cycle": {"state": "완만한 변화"},
    }

    assert RegimeService._thesis_changes(previous, current) == [
        "NAND 가격 표본: 가격 유지 → 관측가격 상승",
        "DRAM 수급 핵심축: 가격 상승 확인 → 타이트 신호",
        "HBM·서버 DRAM 간접계측: 타이트 관찰 → 타이트 지속 신호",
        "완제품 재고 보조축: 수급 개선 → 재고 부담",
        "국내 기업 확인: 확장 확인 → 실적 둔화",
    ]


def test_decision_data_migration_uses_real_retail_and_adds_short_rate_proxy(tmp_path):
    service = service_for(tmp_path)
    with service.db.connect() as conn:
        retail = conn.execute(
            "SELECT source_key,name,unit FROM regime_indicators WHERE id='us_retail'"
        ).fetchone()
        short_rate = conn.execute(
            "SELECT source_key,domain FROM regime_indicators WHERE id='us3m'"
        ).fetchone()
        term_premium = conn.execute(
            "SELECT source_key,name,direction,weight FROM regime_indicators "
            "WHERE id='term_premium'"
        ).fetchone()
        leading_curve = conn.execute(
            "SELECT source_key,name,direction,weight FROM regime_indicators "
            "WHERE id='curve10y3m'"
        ).fetchone()
        corroborating_curve = conn.execute(
            "SELECT source_key,name FROM regime_indicators WHERE id='curve2s10s'"
        ).fetchone()

    assert tuple(retail) == ("RRSFS", "미국 실질 소매판매", "백만 1982-84 달러")
    assert tuple(short_rate) == ("DGS3MO", "rates")
    assert tuple(term_premium) == (
        "THREEFYTP10", "미국 10Y 기간 프리미엄 (Kim-Wright)", "neutral", 0.5,
    )
    assert tuple(leading_curve) == (
        "T10Y3M", "미국 10Y-3M 스프레드", "up_good", 2.0,
    )
    assert tuple(corroborating_curve) == ("T10Y2Y", "미국 10Y-2Y 스프레드")


def test_latest_projection_never_borrows_initial_vintage_provenance(tmp_path):
    service = service_for(tmp_path)
    service.db.table("regime_observations").insert({
        "id": str(uuid4()), "indicator_id": "core_cpi",
        "observation_date": date.today().isoformat(), "value": 330.0,
        "fetched_at": datetime.now().astimezone().isoformat(), "source": "fred",
    }).execute()
    with service.db.connect() as conn:
        conn.execute(
            "INSERT INTO regime_observation_vintages("
            "id,indicator_id,observation_date,value,available_from,fetched_at,source,vintage_kind"
            ") VALUES(?,?,?,?,?,?,?,'initial')",
            (str(uuid4()), "core_cpi", date.today().isoformat(), 329.0,
             date.today().isoformat(), datetime.now().astimezone().isoformat(), "fred"),
        )

    definition = next(item for item in service._indicator_rows() if item["id"] == "core_cpi")
    signal = service._signal(definition)

    assert signal["value"] == 330.0
    assert signal["vintage_kind"] == "latest_revised"
    assert signal["available_from"] is None
    assert signal["vintage_history_available"] is True


def add_series(service, indicator_id, values):
    start = date.today() - timedelta(days=len(values) * 31)
    for index, value in enumerate(values):
        service.db.table("regime_observations").insert({
            "id": str(uuid4()),
            "indicator_id": indicator_id,
            "observation_date": (start + timedelta(days=index * 31)).isoformat(),
            "value": value,
            "fetched_at": "2026-08-16T00:00:00+00:00",
            "source": "fred",
        }).execute()


def add_daily_series(service, indicator_id, values):
    start = date.today() - timedelta(days=len(values) - 1)
    for index, value in enumerate(values):
        service.db.table("regime_observations").insert({
            "id": str(uuid4()),
            "indicator_id": indicator_id,
            "observation_date": (start + timedelta(days=index)).isoformat(),
            "value": value,
            "fetched_at": datetime.now().astimezone().isoformat(),
            "source": "fred",
        }).execute()


def test_rate_model_is_connected_to_canonical_rate_domain(tmp_path):
    service = service_for(tmp_path)
    for indicator_id, values in {
        "tips10y": [2.39] * 90,
        "us10y": [4.63] * 90,
        "bei10y": [2.27] * 90,
        "us3m": [3.87] * 90,
        "term_premium": [0.83] * 90,
        "curve10y3m": [-0.50] * 50 + [0.80] * 40,
        "curve2s10s": [-0.25] * 50 + [0.50] * 40,
    }.items():
        add_daily_series(service, indicator_id, values)

    evaluation = service.evaluate(persist=False)
    conditions = evaluation["macro_quadrant"]["financial_conditions"]
    rates_domain = next(item for item in evaluation["domains"] if item["id"] == "rates")

    assert conditions["rates"]["version"] == "2026-08-rates-v2"
    assert conditions["rates"]["score"] == pytest.approx(53.4)
    assert conditions["long_rates"]["term_premium_role"] == "decomposition_context"
    assert conditions["yield_curve"]["evidence_cluster"] == "yield_curve"
    assert rates_domain["method"] == "three_layer_rate_model"
    assert rates_domain["state"] == "둔화"


def test_portfolio_context_does_not_mix_assets_from_other_portfolios(tmp_path):
    service = service_for(tmp_path)
    with service.db.connect() as conn:
        conn.execute("INSERT INTO assets(id,portfolio_id,name,asset_type) VALUES(?,?,?,'stock')",
                     ("main-asset", "00000000-0000-0000-0000-000000000010", "기준 자산"))
        conn.execute("INSERT INTO portfolios(id,name) VALUES('other-portfolio','다른 포트폴리오')")
        conn.execute("INSERT INTO assets(id,portfolio_id,name,asset_type) VALUES('other-asset','other-portfolio','제외 자산','stock')")

    portfolio, _ = service._portfolio_context()

    assert [item["name"] for item in portfolio["assets"]] == ["기준 자산"]


def test_same_data_produces_same_evaluation(tmp_path):
    service = service_for(tmp_path)
    add_series(service, "us_unemployment", [4.0, 4.0, 4.1, 4.5])

    first = service.evaluate()
    second = service.evaluate()

    assert first["id"] == second["id"]
    assert first["candidate_regime"] == "경계"
    assert first["automatic_regime"] == "유지"


def test_crossing_freshness_boundary_creates_new_evaluation_without_using_stale_signal(
    tmp_path, monkeypatch,
):
    service = service_for(tmp_path)
    for days_ago, value in ((183, 4.0), (152, 4.0), (121, 4.0), (90, 4.5)):
        service.db.table("regime_observations").insert({
            "id": str(uuid4()),
            "indicator_id": "us_unemployment",
            "observation_date": (date.today() - timedelta(days=days_ago)).isoformat(),
            "value": value,
            "fetched_at": datetime.now().astimezone().isoformat(),
            "source": "fred",
        }).execute()
    fresh = service.evaluate()
    real_datetime = datetime

    class FutureDateTime(real_datetime):
        @classmethod
        def now(cls, tz=None):
            return real_datetime.now(tz) + timedelta(days=10)

    monkeypatch.setattr(regime_service_module, "datetime", FutureDateTime)
    stale = service.evaluate()

    assert fresh["candidate_regime"] == "경계"
    assert stale["candidate_regime"] == "유지"
    assert stale["id"] != fresh["id"]
    signal = next(item for item in stale["signals"] if item["id"] == "us_unemployment")
    assert signal["is_stale"] is True


def test_hysteresis_requires_second_distinct_confirmation(tmp_path):
    service = service_for(tmp_path)
    add_series(service, "us_unemployment", [4.0, 4.0, 4.1, 4.5])
    first = service.evaluate()
    service.db.table("regime_observations").insert({
        "id": str(uuid4()), "indicator_id": "us_unemployment",
        "observation_date": date.today().isoformat(), "value": 4.6,
        "fetched_at": "2026-08-16T00:00:00+00:00", "source": "fred",
    }).execute()
    second = service.evaluate()

    assert first["candidate_regime"] == "경계"
    assert second["candidate_regime"] == "경계"
    assert second["automatic_regime"] == "경계"


def test_model_version_change_is_not_counted_as_second_data_confirmation(
    tmp_path, monkeypatch,
):
    service = service_for(tmp_path)
    add_series(service, "us_unemployment", [4.0, 4.0, 4.1, 4.5])
    first = service.evaluate()
    original = regime_service_module.calculate_us_macro_quadrant

    def changed_model(signals, financial_signals=None):
        result = original(signals, financial_signals)
        result["version"] = f"{result['version']}-changed"
        return result

    monkeypatch.setattr(regime_service_module, "calculate_us_macro_quadrant", changed_model)
    second = service.evaluate()

    assert first["candidate_regime"] == "경계"
    assert second["candidate_regime"] == "경계"
    assert first["automatic_regime"] == "유지"
    assert second["automatic_regime"] == "유지"


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
    snapshot = service.create_snapshot("경계", "정기 점검")

    assert snapshot["automatic_regime"] == "유지"
    assert snapshot["user_regime"] == "경계"
    assert snapshot["user_note"] == "정기 점검"
    assert snapshot["signals"] is not None
    assert snapshot["portfolio"] is not None
    assert snapshot["review_urgency"] in {"required", "watch", "not_needed"}
    assert snapshot["coverage"] is not None
    assert snapshot["rule_version"]
    assert snapshot["snapshot_schema_version"] == "3"
    assert snapshot["input_fingerprint"]
    assert snapshot["raw_data"]["schema_version"] == "2"
    assert any(item["id"] == "us_unemployment" for item in snapshot["raw_data"]["indicators"])
    with service.db.connect() as conn:
        acknowledgment = conn.execute("SELECT * FROM regime_review_acknowledgments").fetchone()
    assert acknowledgment is not None
    assert acknowledgment["evaluation_id"] == snapshot["evaluation_id"]


def test_history_omits_large_raw_payload_but_snapshot_detail_keeps_it(tmp_path):
    service = service_for(tmp_path)
    add_series(service, "us_unemployment", [4.0, 4.1, 4.2, 4.3])
    snapshot = service.create_snapshot(None, None)

    history_item = service.history()[0]

    assert "raw_data" not in history_item
    assert history_item["raw_data_available"] is True
    assert service.get_snapshot(snapshot["id"])["raw_data"]["indicators"]


def test_snapshot_and_review_acknowledgment_are_atomic(tmp_path, monkeypatch):
    service = service_for(tmp_path)
    monkeypatch.setattr(
        service,
        "_acknowledgment_payload",
        lambda current, note=None: {"unknown_column": "force rollback"},
    )

    with pytest.raises(sqlite3.OperationalError):
        service.create_snapshot(None, None)

    with service.db.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM regime_snapshots").fetchone()[0] == 0


def test_snapshot_acknowledges_current_alerts_without_separate_choice(tmp_path):
    service = service_for(tmp_path)
    snapshot = service.create_snapshot("유지", "상태만 기록")

    assert snapshot["review_completed"] == 1
    with service.db.connect() as conn:
        count = conn.execute("SELECT COUNT(*) FROM regime_review_acknowledgments").fetchone()[0]
    assert count == 1


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
    assert set(dict(row)) == {
        "id", "completed_at", "evaluation_id", "trigger_state_json", "note",
        "assessment_fingerprint", "candidate_regime", "urgency",
    }
    assert row["assessment_fingerprint"]


def test_display_only_liquidity_series_cannot_change_domain_or_candidate(tmp_path):
    service = service_for(tmp_path)
    add_series(service, "fed_assets", [100, 80, 60, 40])

    result = service.evaluate()
    liquidity = next(item for item in result["domains"] if item["id"] == "liquidity")

    assert liquidity["state"] == "데이터 없음"
    assert result["candidate_regime"] == "유지"


def test_historical_revision_changes_evaluation_fingerprint(tmp_path):
    service = service_for(tmp_path)
    add_series(service, "us_unemployment", [4.0, 4.0, 4.1, 4.5])
    first = service.evaluate()
    with service.db.connect() as conn:
        first_date = conn.execute(
            "SELECT MIN(observation_date) FROM regime_observations WHERE indicator_id='us_unemployment'"
        ).fetchone()[0]
        conn.execute(
            "UPDATE regime_observations SET value=3.9 WHERE indicator_id='us_unemployment' AND observation_date=?",
            (first_date,),
        )

    second = service.evaluate()

    assert second["id"] != first["id"]


def test_current_read_does_not_mutate_trigger_or_assessment_state(tmp_path):
    service = service_for(tmp_path)
    values = [3.5] * 12 + [4.1, 4.1, 4.1]
    add_series(service, "us_unemployment", values)
    service.evaluate(persist=True)
    service.current(persist_state=True)
    with service.db.connect() as conn:
        before_trigger = conn.execute(
            "SELECT rule_id,last_fired_at FROM regime_triggers ORDER BY rule_id"
        ).fetchall()
        before_assessments = conn.execute("SELECT COUNT(*) FROM review_assessments").fetchone()[0]

    service.current()

    with service.db.connect() as conn:
        after_trigger = conn.execute(
            "SELECT rule_id,last_fired_at FROM regime_triggers ORDER BY rule_id"
        ).fetchall()
        after_assessments = conn.execute("SELECT COUNT(*) FROM review_assessments").fetchone()[0]
    assert [tuple(row) for row in after_trigger] == [tuple(row) for row in before_trigger]
    assert after_assessments == before_assessments


def test_required_assessment_without_trigger_is_not_acknowledged_by_old_empty_ack():
    ack = {"trigger_state": {}, "assessment_fingerprint": None}

    assert not RegimeService._acknowledges(ack, [], "new-state", "required")


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
