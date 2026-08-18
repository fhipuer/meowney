from datetime import date, datetime, timedelta, timezone

import pytest

from app.services.regime_rules import (
    calculate_coverage,
    calculate_review_urgency,
    decompose_ten_year,
    evaluate_triggers,
)


def signal(key, values, *, domain="rates", frequency="daily", start_day=1):
    start = date(2026, 7, start_day)
    history = [
        {"date": (start + timedelta(days=index)).isoformat(), "value": value}
        for index, value in enumerate(values)
    ]
    return {
        "id": key, "domain": domain, "name": key, "frequency": frequency,
        "status": "중립", "value": values[-1], "observation_date": "2026-08-15",
        "history": history,
    }


def trigger_ids(items):
    return {item["rule_id"] for item in items}


def test_trigger_result_is_deterministic_and_sorted_by_severity_then_id():
    signals = [signal("hy_oas", [3.0] * 20 + [5.1], domain="liquidity"), signal("tips10y", [1.0] * 20 + [1.6])]
    first, _ = evaluate_triggers(signals)
    second, _ = evaluate_triggers(list(reversed(signals)))
    assert first == second
    assert [item["rule_id"] for item in first] == sorted(item["rule_id"] for item in first)


def test_trigger_result_is_independent_from_history_order():
    original = signal("tips10y", [1.0] * 20 + [1.5])
    reversed_history = {**original, "history": list(reversed(original["history"]))}
    assert evaluate_triggers([original]) == evaluate_triggers([reversed_history])


def test_core_inflation_reacceleration_is_immediate_critical_trigger():
    core = signal("core_cpi", [100, 100.3, 100.6, 100.75, 101.4], domain="inflation", frequency="monthly")
    triggers, _ = evaluate_triggers([core])
    assert "tightening.core_cpi.reacceleration" in trigger_ids(triggers)
    assert triggers[0]["severity"] == "critical"


def test_persistent_inflation_needs_two_consecutive_high_windows():
    core = signal("core_pce", [100, 100.3, 100.6, 100.9, 101.2], domain="inflation", frequency="monthly")
    triggers, _ = evaluate_triggers([core])
    assert "tightening.core_pce.persistent" in trigger_ids(triggers)


@pytest.mark.parametrize("key,values,expected", [
    ("tips10y", [1.0] * 20 + [1.5], "tightening.real_yield.jump"),
    ("hy_oas", [3.0] * 10 + [4.6], "credit.hy.critical"),
    ("nfci", [-.1, .5], "credit.nfci.critical"),
    ("market_vix", [15.0] * 5 + [30.0], "market.vix.high"),
    ("market_sp500", [100.0] * 20 + [89.0], "market.market_sp500.drawdown"),
    ("market_usdkrw", [1300.0] * 20 + [1400.0], "market.usdkrw.high"),
])
def test_single_series_thresholds(key, values, expected):
    triggers, _ = evaluate_triggers([signal(key, values, domain="market" if key.startswith("market") else "liquidity")])
    assert expected in trigger_ids(triggers)


def test_breakeven_and_nominal_yield_must_rise_together():
    triggers, _ = evaluate_triggers([
        signal("bei10y", [2.0] * 20 + [2.3]), signal("us10y", [4.0] * 20 + [4.5]),
    ])
    assert "tightening.inflation_expectation" in trigger_ids(triggers)


def test_sahm_style_threshold_detects_labor_deterioration():
    values = [3.5] * 12 + [4.1, 4.1, 4.1]
    triggers, _ = evaluate_triggers([signal("us_unemployment", values, domain="growth", frequency="monthly")])
    assert "recession.sahm" in trigger_ids(triggers)


def test_rate_decomposition_identifies_real_yield_driver():
    result = decompose_ten_year({
        "us10y": signal("us10y", [4.0] * 20 + [4.8]),
        "tips10y": signal("tips10y", [1.5] * 20 + [2.2]),
        "bei10y": signal("bei10y", [2.5] * 20 + [2.6]),
    })
    assert result["driver"] == "실질금리 주도"
    assert result["nominal_change"] == pytest.approx(.8)
    assert result["start_date"] == "2026-07-01"
    assert result["end_date"] == "2026-07-21"


def test_term_premium_is_not_a_standalone_restrictive_trigger():
    triggers, _ = evaluate_triggers([signal("term_premium", [2.0] * 90)])
    assert "tightening.restrictive_level" not in trigger_ids(triggers)


def test_high_tips_and_nonnegative_real_policy_create_one_level_trigger():
    triggers, _ = evaluate_triggers([
        signal("tips10y", [2.30] * 30),
        signal("fedfunds", [4.0]),
        signal("core_pce", [100.0] * 12 + [103.0], domain="inflation", frequency="monthly"),
    ])
    assert "tightening.restrictive_level" in trigger_ids(triggers)


def test_long_end_duration_alert_shares_the_rate_level_evidence_cluster():
    triggers, _ = evaluate_triggers([
        signal("us10y", [4.55] * 70 + [4.72] * 20),
        signal("us30y", [5.06] * 70 + [5.31] * 20),
        signal("tips10y", [2.80] * 90),
        signal("tips30y", [2.87] * 70 + [3.06] * 20),
        signal("bei10y", [2.27] * 90),
    ])

    assert "tightening.restrictive_level" in trigger_ids(triggers)
    assert "tightening.long_end_duration" in trigger_ids(triggers)
    rate_level = [
        item for item in triggers
        if item["severity"] == "high" and item["evidence_cluster"] == "rate_level"
    ]
    assert len(rate_level) == 2
    assert {item["evidence_cluster"] for item in rate_level} == {"rate_level"}


def test_persistent_10y3m_inversion_creates_only_one_curve_cluster():
    triggers, _ = evaluate_triggers([
        signal("curve10y3m", [-0.50] * 50),
        signal("curve2s10s", [-0.25] * 50),
    ])
    curve_triggers = [
        item for item in triggers if item["evidence_cluster"] == "yield_curve"
    ]
    assert len(curve_triggers) == 1
    assert curve_triggers[0]["rule_id"] == "recession.yield_curve"
    assert curve_triggers[0]["severity"] == "high"
    assert curve_triggers[0]["evidence"]["confirmation"] == "동반 역전"


def test_stale_data_is_not_treated_as_neutral():
    stale = signal("us_gdp", [100, 101], domain="growth", frequency="quarterly")
    stale["observation_date"] = "2025-01-01"
    coverage = calculate_coverage([stale], datetime(2026, 8, 16, tzinfo=timezone.utc))
    assert coverage["domains"]["growth"]["status"] == "판정 불가"
    assert "us_gdp" in coverage["domains"]["growth"]["stale"]


def test_korean_auxiliary_series_does_not_reduce_us_macro_coverage():
    us = signal("us_unemployment", [4.0, 4.1], domain="growth", frequency="monthly")
    korea = signal("kr_indpro", [100, 99], domain="growth", frequency="monthly")
    korea["observation_date"] = "2024-01-01"
    coverage = calculate_coverage([us, korea], datetime(2026, 8, 16, tzinfo=timezone.utc))
    assert coverage["domains"]["growth"]["total"] == 1
    assert coverage["domains"]["growth"]["status"] == "충분"


def test_review_required_for_critical_even_when_confirmed_regime_is_hold():
    coverage = {"insufficient_domains": 0, "domains": {}}
    triggers = [{"severity": "critical", "evidence_cluster": "rates"}]
    urgency, reasons = calculate_review_urgency("유지", "유지", triggers, coverage)
    assert urgency == "required"
    assert reasons


def test_confirmed_regime_change_requires_review_without_market_trigger():
    coverage = {"insufficient_domains": 0, "domains": {}}
    urgency, reasons = calculate_review_urgency(
        "경계", "경계", [], coverage, confirmed_changed=True
    )
    assert urgency == "required"
    assert "확정 레짐" in reasons[0]


def test_two_independent_high_clusters_require_review_but_one_cluster_only_watches():
    coverage = {"insufficient_domains": 0, "domains": {}}
    one = [{"severity": "high", "evidence_cluster": "credit"}]
    two = one + [{"severity": "high", "evidence_cluster": "labor"}]
    assert calculate_review_urgency("유지", "유지", one, coverage)[0] == "watch"
    assert calculate_review_urgency("유지", "유지", two, coverage)[0] == "required"


def test_no_history_does_not_invent_a_trigger():
    unavailable = {"id": "tips10y", "status": "unavailable", "history": []}
    assert evaluate_triggers([unavailable])[0] == []
