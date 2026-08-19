"""투자 레짐 조기경보를 위한 순수 결정론적 규칙 함수."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from app.services.regime_rates import (
    aligned_changes,
    aligned_ten_year_changes,
    calculate_rate_model,
)


RULE_VERSION = "2026-08-p2.0.0-rates-v4"
SEVERITY_RANK = {"medium": 1, "high": 2, "critical": 3}
REGIME_RANK = {"유지": 0, "경계": 1, "약화": 2, "전환": 3}
FRESHNESS_DAYS = {"daily": 14, "weekly": 28, "monthly": 95, "quarterly": 200}


def signal_freshness(signal: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    """Return the freshness verdict shared by every decision path."""
    now = now or datetime.now(timezone.utc)
    observed_at = signal.get("observation_date")
    max_age = FRESHNESS_DAYS.get(signal.get("frequency", "monthly"), 95)
    if not observed_at:
        return {"fresh": False, "age_days": None, "max_age_days": max_age}
    observed = datetime.fromisoformat(observed_at)
    if observed.tzinfo is None:
        observed = observed.replace(tzinfo=timezone.utc)
    age_days = max(0, (now - observed).days)
    return {"fresh": age_days <= max_age, "age_days": age_days, "max_age_days": max_age}


def decision_usable(signal: dict[str, Any], now: datetime | None = None) -> bool:
    """Display-only, unavailable, and stale series cannot affect a decision."""
    if signal.get("status") == "unavailable":
        return False
    if signal.get("usage") not in {None, "regime", "trigger"}:
        return False
    if "is_stale" in signal:
        return not bool(signal["is_stale"])
    return signal_freshness(signal, now)["fresh"]


def _values(signal: dict[str, Any]) -> list[float]:
    by_date: dict[str, float] = {}
    for row in signal.get("history", []):
        try:
            value = float(row["value"])
        except (KeyError, TypeError, ValueError):
            continue
        if row.get("date") and math.isfinite(value):
            by_date[str(row["date"])] = value
    return [by_date[key] for key in sorted(by_date)]


def _absolute_change(signal: dict[str, Any], periods: int) -> float | None:
    values = _values(signal)
    return values[-1] - values[-periods - 1] if len(values) > periods else None


def _percent_change(signal: dict[str, Any], periods: int) -> float | None:
    values = _values(signal)
    if len(values) <= periods or values[-periods - 1] == 0:
        return None
    return (values[-1] / values[-periods - 1] - 1) * 100


def _annualized_3m(signal: dict[str, Any], offset: int = 0) -> float | None:
    values = _values(signal)
    end = len(values) - offset
    if end < 4 or values[end - 4] <= 0:
        return None
    return ((values[end - 1] / values[end - 4]) ** 4 - 1) * 100


def _trigger(rule_id: str, domain: str, severity: str, cluster: str, summary: str,
             evidence: dict[str, Any]) -> dict[str, Any]:
    return {
        "rule_id": rule_id, "rule_version": RULE_VERSION, "domain": domain,
        "severity": severity, "direction": "worsening", "evidence_cluster": cluster,
        "summary": summary, "evidence": evidence,
    }


def decompose_ten_year(signals: dict[str, dict[str, Any]], periods: int = 20) -> dict[str, Any] | None:
    aligned = aligned_ten_year_changes(signals, periods)
    if not aligned:
        return None
    nominal = aligned["changes"]["us10y"]
    real = aligned["changes"]["tips10y"]
    breakeven = aligned["changes"]["bei10y"]
    residual = nominal - real - breakeven
    if abs(real - breakeven) <= .10:
        driver = "혼합"
    else:
        driver = "실질금리 주도" if abs(real) > abs(breakeven) else "기대인플레이션 주도"
    return {
        "periods": periods, "start_date": aligned["start_date"], "end_date": aligned["end_date"],
        "nominal_change": round(nominal, 3), "real_change": round(real, 3),
        "breakeven_change": round(breakeven, 3), "residual": round(residual, 3), "driver": driver,
    }


def evaluate_triggers(
    signal_list: list[dict[str, Any]],
    now: datetime | None = None,
    rate_model: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    signals = {item["id"]: item for item in signal_list if decision_usable(item, now)}

    def rate_context_usable(item: dict[str, Any]) -> bool:
        if item.get("status") == "unavailable":
            return False
        if "is_stale" in item:
            return not bool(item["is_stale"])
        if item.get("observation_date"):
            return signal_freshness(item, now)["fresh"]
        return bool(item.get("history"))

    rate_inputs = [
        item for item in signal_list if rate_context_usable(item)
    ]
    rate_model = rate_model or calculate_rate_model(rate_inputs)
    triggers: list[dict[str, Any]] = []

    for key, label in (("core_cpi", "Core CPI"), ("core_pce", "Core PCE")):
        signal = signals.get(key)
        if not signal:
            continue
        current, previous = _annualized_3m(signal), _annualized_3m(signal, 1)
        if current is not None and previous is not None and current >= 4 and current - previous >= 1:
            triggers.append(_trigger(f"tightening.{key}.reacceleration", "inflation", "critical", "inflation",
                f"{label} 3개월 연율 {current:.1f}%, 직전 대비 {current - previous:+.1f}%p",
                {"current_3m_ann": current, "previous_3m_ann": previous, "threshold": 4.0}))
        elif current is not None and previous is not None and current >= 3 and previous >= 3:
            triggers.append(_trigger(f"tightening.{key}.persistent", "inflation", "high", "inflation",
                f"{label} 3개월 연율이 2회 연속 3% 이상", {"current_3m_ann": current, "previous_3m_ann": previous}))

    tips_change = _absolute_change(signals.get("tips10y", {}), 20)
    if tips_change is not None and tips_change >= .50:
        triggers.append(_trigger("tightening.real_yield.jump", "rates", "critical", "rates",
            f"10Y 실질금리 20관측일 {tips_change:+.2f}%p", {"change": tips_change, "threshold": .50}))
    inflation_rate_change = aligned_changes(signals, ("bei10y", "us10y"), 20)
    bei_change = (
        inflation_rate_change["changes"]["bei10y"]
        if inflation_rate_change else None
    )
    nominal_change = (
        inflation_rate_change["changes"]["us10y"]
        if inflation_rate_change else None
    )
    if bei_change is not None and nominal_change is not None and bei_change >= .30 - 1e-9 and nominal_change >= .50 - 1e-9:
        triggers.append(_trigger("tightening.inflation_expectation", "rates", "high", "inflation_expectation",
            f"BEI {bei_change:+.2f}%p와 10Y {nominal_change:+.2f}%p 동반 상승",
            {"bei_change": bei_change, "nominal_change": nominal_change,
             "start_date": inflation_rate_change["start_date"],
             "end_date": inflation_rate_change["end_date"]}))

    # A stable but already-high real discount rate remains restrictive even
    # when its 20-day change is small.  Term premium is decomposition context,
    # not a second additive restriction score, because TIPS already captures
    # the long real-rate burden.
    long_rates = rate_model["long_rates"]
    policy = rate_model["policy"]
    tips_value = long_rates.get("real_10y")
    real_policy = policy.get("real_policy_rate")
    restrictive_level = bool(
        tips_value is not None
        and (
            (tips_value >= 2.25 and real_policy is not None and real_policy >= 0)
            or (tips_value >= 2.75 and real_policy is None)
        )
    )
    if restrictive_level:
        triggers.append(_trigger("tightening.restrictive_level", "rates", "high", "rate_level",
            f"긴축 수준 지속: 10Y TIPS {tips_value:.2f}%"
            + (f" / 실질 정책금리 {real_policy:+.2f}%p" if real_policy is not None else " / 실질 정책금리 미확인"),
            {"tips10y": tips_value, "real_policy_rate": real_policy,
             "tips_threshold": 2.25, "missing_policy_threshold": 2.75,
             "term_premium_role": "decomposition_context"}))

    # Far-end stress is a bounded confirmation of the same rate-level cluster,
    # not a second independent macro domain. This prevents 10Y and 30Y from
    # being double-counted while still surfacing a duration/fiscal shock.
    duration = rate_model.get("duration_stress") or {}
    duration_score = duration.get("score")
    if duration_score is not None and duration_score >= 35:
        triggers.append(_trigger(
            "tightening.long_end_duration",
            "rates",
            "high",
            "rate_level",
            (
                f"30Y 실질금리 {duration.get('real_30y'):.2f}% · "
                f"20관측일 {duration['change_20d']['changes']['tips30y']:+.2f}%p · "
                f"30Y-10Y {duration.get('spread_30y10y'):+.2f}%p"
            ),
            {
                "score": duration_score,
                "label": duration.get("label"),
                "driver": duration.get("driver"),
                "nominal_30y": duration.get("nominal_30y"),
                "real_30y": duration.get("real_30y"),
                "spread_30y10y": duration.get("spread_30y10y"),
                "nominal_30y_change_20d": duration["change_20d"]["changes"]["us30y"],
                "real_30y_change_20d": duration["change_20d"]["changes"]["tips30y"],
                "confirmation_count_5d": duration.get("confirmation_count_5d"),
                "role": "bounded_confirmation",
            },
        ))
    elif duration_score is not None and duration_score >= 25:
        triggers.append(_trigger(
            "tightening.long_end_duration.watch",
            "rates",
            "medium",
            "rate_level",
            f"30년 장기금리 상승 관찰 · {duration.get('driver')}",
            {
                "score": duration_score,
                "nominal_30y": duration.get("nominal_30y"),
                "real_30y": duration.get("real_30y"),
                "spread_30y10y": duration.get("spread_30y10y"),
                "role": "bounded_confirmation",
            },
        ))

    # 10Y-3M is the primary recession-leading curve.  10Y-2Y only confirms
    # the same evidence cluster and therefore never creates a second trigger.
    curve = rate_model["yield_curve"]
    curve_state = curve.get("state")
    curve_probability = curve.get("recession_probability_12m")
    curve_score = curve.get("score")
    if curve_state == "역전 지속" and curve_probability is not None and curve_probability >= 30:
        triggers.append(_trigger(
            "recession.yield_curve", "rates", "high", "yield_curve",
            f"10Y-3M 월평균 역전 지속 · 12개월 침체확률 {curve_probability:.1f}%",
            {
                "state": curve_state,
                "probability_12m": curve_probability,
                "spread_10y3m_monthly_average": curve.get("monthly_average_10y3m"),
                "spread_10y2y_monthly_average": curve.get("monthly_average_10y2y"),
                "confirmation": curve.get("confirmation"),
                "evidence_cluster": "yield_curve",
            },
        ))
    elif curve_state == "역전 후 관찰" and curve_score is not None and curve_score >= 35:
        triggers.append(_trigger(
            "recession.yield_curve.post_inversion", "rates", "high", "yield_curve",
            f"10Y-3M 역전 해소 후 {curve.get('days_since_inversion')}관측일 · 선행위험 관찰",
            {
                "state": curve_state,
                "probability_12m": curve_probability,
                "days_since_inversion": curve.get("days_since_inversion"),
                "last_inversion_date": curve.get("last_inversion_date"),
                "steepening": curve.get("steepening"),
                "evidence_cluster": "yield_curve",
            },
        ))
    elif (
        curve_state in {"역전 확인 중", "평탄화 경계", "역전 후 관찰"}
        and curve_score is not None and curve_score >= 25
    ):
        triggers.append(_trigger(
            "recession.yield_curve.watch", "rates", "medium", "yield_curve",
            f"10Y-3M {curve_state} · 12개월 침체확률 {curve_probability:.1f}%"
            if curve_probability is not None else f"10Y-3M {curve_state}",
            {
                "state": curve_state,
                "probability_12m": curve_probability,
                "score": curve_score,
                "evidence_cluster": "yield_curve",
            },
        ))

    unemployment = signals.get("us_unemployment")
    if unemployment:
        values = _values(unemployment)
        if len(values) >= 15:
            current_average = sum(values[-3:]) / 3
            historical = [sum(values[index:index + 3]) / 3 for index in range(len(values) - 14, len(values) - 2)]
            sahm = current_average - min(historical)
            if sahm >= .50:
                triggers.append(_trigger("recession.sahm", "growth", "critical", "labor",
                    f"실업률 3개월 평균이 12개월 저점 대비 {sahm:+.2f}%p", {"sahm": sahm, "threshold": .50}))
            elif sahm >= .30:
                triggers.append(_trigger("recession.unemployment_watch", "growth", "high", "labor",
                    f"실업률 3개월 평균이 12개월 저점 대비 {sahm:+.2f}%p", {"sahm": sahm, "threshold": .30}))

    claims_yoy = _percent_change(signals.get("us_claims", {}), 52)
    if claims_yoy is not None and claims_yoy >= 15:
        triggers.append(_trigger("recession.claims", "growth", "high", "labor",
            f"신규실업수당 4주평균 전년 대비 {claims_yoy:+.1f}%", {"yoy": claims_yoy, "threshold": 15}))

    hy = signals.get("hy_oas")
    if hy:
        value, change10, change20 = hy.get("value"), _absolute_change(hy, 10), _absolute_change(hy, 20)
        if value is not None and (value >= 5 or (change10 is not None and change10 >= 1.5)):
            triggers.append(_trigger("credit.hy.critical", "liquidity", "critical", "credit",
                f"HY OAS {value:.2f}%p", {"value": value, "change_10": change10, "threshold": 5}))
        elif value is not None and (value >= 4 or (change20 is not None and change20 >= .75)):
            triggers.append(_trigger("credit.hy.high", "liquidity", "high", "credit",
                f"HY OAS {value:.2f}%p", {"value": value, "change_20": change20, "threshold": 4}))
    ig = signals.get("ig_oas")
    if ig and ig.get("value") is not None and ig["value"] >= 1.5:
        triggers.append(_trigger("credit.ig.high", "liquidity", "high", "credit",
            f"IG OAS {ig['value']:.2f}%p", {"value": ig["value"], "threshold": 1.5}))
    nfci = signals.get("nfci")
    if nfci and nfci.get("value") is not None:
        if nfci["value"] >= .5:
            triggers.append(_trigger("credit.nfci.critical", "liquidity", "critical", "financial_conditions",
                f"NFCI {nfci['value']:.2f}", {"value": nfci["value"], "threshold": .5}))
        elif nfci["value"] >= 0 and len(_values(nfci)) >= 2 and _values(nfci)[-2] >= 0:
            triggers.append(_trigger("credit.nfci.high", "liquidity", "high", "financial_conditions",
                "NFCI가 2주 연속 0 이상", {"value": nfci["value"]}))

    vix = signals.get("market_vix")
    if vix and vix.get("value") is not None:
        change5 = _absolute_change(vix, 5)
        if vix["value"] >= 30 or (change5 is not None and change5 >= 12):
            triggers.append(_trigger("market.vix.high", "market", "high", "market_price",
                f"VIX {vix['value']:.1f}", {"value": vix["value"], "change_5": change5}))
    for key, label in (("market_sp500", "S&P500"), ("market_nasdaq", "NASDAQ")):
        change20 = _percent_change(signals.get(key, {}), 20)
        if change20 is not None and change20 <= -10:
            triggers.append(_trigger(f"market.{key}.drawdown", "market", "high", "market_price",
                f"{label} 20관측일 {change20:.1f}%", {"change_20": change20, "threshold": -10}))
    fx_change = _percent_change(signals.get("market_usdkrw", {}), 20)
    if fx_change is not None and fx_change >= 7:
        triggers.append(_trigger("market.usdkrw.high", "market", "high", "currency",
            f"USD/KRW 20관측일 {fx_change:+.1f}%", {"change_20": fx_change, "threshold": 7}))

    triggers.sort(key=lambda item: (-SEVERITY_RANK[item["severity"]], item["rule_id"]))
    return triggers, decompose_ten_year(signals)


def calculate_coverage(signals: list[dict[str, Any]], now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    core = {"growth", "inflation", "rates", "liquidity"}
    summary: dict[str, Any] = {}
    for domain in core:
        items = [
            item for item in signals
            if item.get("domain") == domain
            and not item.get("id", "").startswith("kr_")
            and item.get("usage") in {None, "regime"}
        ]
        usable = []
        stale = []
        for item in items:
            if item.get("status") == "unavailable" or not item.get("observation_date"):
                continue
            freshness = signal_freshness(item, now)
            (usable if freshness["fresh"] else stale).append(item["id"])
        ratio = len(usable) / len(items) if items else 0
        summary[domain] = {"total": len(items), "usable": len(usable), "stale": stale,
                           "coverage": round(ratio, 3), "status": "충분" if ratio >= .7 else "부분" if ratio >= .4 else "판정 불가"}
    insufficient = sum(item["status"] == "판정 불가" for item in summary.values())
    return {"domains": summary, "insufficient_domains": insufficient,
            "overall": round(sum(item["coverage"] for item in summary.values()) / len(summary), 3)}


def calculate_review_urgency(confirmed: str, candidate: str, triggers: list[dict[str, Any]],
                             coverage: dict[str, Any], worsened_domains: int = 0,
                             confirmed_changed: bool = False) -> tuple[str, list[str]]:
    reasons: list[str] = []
    critical = [item for item in triggers if item["severity"] == "critical"]
    high_clusters = {item["evidence_cluster"] for item in triggers if item["severity"] == "high"}
    if confirmed_changed:
        reasons.append(f"확정 레짐이 {confirmed}(으)로 변경")
    if REGIME_RANK[candidate] >= REGIME_RANK["약화"]:
        reasons.append(f"후보 레짐 {candidate}")
    if critical:
        reasons.append(f"Critical trigger {len(critical)}개")
    if len(high_clusters) >= 2:
        reasons.append(f"독립 High cluster {len(high_clusters)}개")
    if worsened_domains >= 2:
        reasons.append(f"Snapshot 이후 {worsened_domains}개 영역 악화")
    if coverage["insufficient_domains"] >= 2:
        reasons.append("핵심 데이터 부족으로 판단 불가")
    if reasons:
        return "required", reasons
    if REGIME_RANK[candidate] > REGIME_RANK[confirmed]:
        reasons.append(f"후보 레짐이 {confirmed}에서 {candidate} 방향으로 악화")
    if any(item["severity"] == "high" for item in triggers):
        reasons.append("High trigger 활성")
    if any(item["status"] != "충분" for item in coverage["domains"].values()):
        reasons.append("일부 핵심 데이터가 오래되거나 부족")
    return ("watch", reasons) if reasons else ("not_needed", [])
