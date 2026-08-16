"""투자 레짐 조기경보를 위한 순수 결정론적 규칙 함수."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


RULE_VERSION = "2026-08-p1.6.0"
SEVERITY_RANK = {"medium": 1, "high": 2, "critical": 3}
REGIME_RANK = {"유지": 0, "경계": 1, "약화": 2, "전환": 3}
FRESHNESS_DAYS = {"daily": 14, "weekly": 28, "monthly": 95, "quarterly": 200}


def _values(signal: dict[str, Any]) -> list[float]:
    return [float(item["value"]) for item in signal.get("history", [])]


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
    nominal = _absolute_change(signals.get("us10y", {}), periods)
    real = _absolute_change(signals.get("tips10y", {}), periods)
    breakeven = _absolute_change(signals.get("bei10y", {}), periods)
    if nominal is None or real is None or breakeven is None:
        return None
    residual = nominal - real - breakeven
    if abs(real - breakeven) <= .10:
        driver = "혼합"
    else:
        driver = "실질금리 주도" if abs(real) > abs(breakeven) else "기대인플레이션 주도"
    return {
        "periods": periods, "nominal_change": round(nominal, 3), "real_change": round(real, 3),
        "breakeven_change": round(breakeven, 3), "residual": round(residual, 3), "driver": driver,
    }


def evaluate_triggers(signal_list: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    signals = {item["id"]: item for item in signal_list if item.get("status") != "unavailable"}
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
    bei_change = _absolute_change(signals.get("bei10y", {}), 20)
    nominal_change = _absolute_change(signals.get("us10y", {}), 20)
    if bei_change is not None and nominal_change is not None and bei_change >= .30 - 1e-9 and nominal_change >= .50 - 1e-9:
        triggers.append(_trigger("tightening.inflation_expectation", "rates", "high", "inflation_expectation",
            f"BEI {bei_change:+.2f}%p와 10Y {nominal_change:+.2f}%p 동반 상승",
            {"bei_change": bei_change, "nominal_change": nominal_change}))

    # A stable but already-high real discount rate remains restrictive even
    # when its 20-day change is small. Level pressure and shock pressure are
    # deliberately separate rules.
    tips = signals.get("tips10y")
    term = signals.get("term_premium")
    fed = signals.get("fedfunds")
    core_pce = signals.get("core_pce")
    core_pce_yoy = _percent_change(core_pce or {}, 12)
    real_policy = (float(fed["value"]) - core_pce_yoy
                   if fed and fed.get("value") is not None and core_pce_yoy is not None else None)
    restrictive_level = bool(
        (tips and tips.get("value") is not None and float(tips["value"]) >= 2.25)
        or (term and term.get("value") is not None and float(term["value"]) >= 1.25)
    )
    if restrictive_level and (real_policy is None or real_policy >= 0):
        triggers.append(_trigger("tightening.restrictive_level", "rates", "high", "rate_level",
            f"긴축 수준 지속: 10Y TIPS {float(tips['value']):.2f}% / 실질 정책금리 {real_policy:+.2f}%p"
            if tips and tips.get("value") is not None and real_policy is not None
            else "장기 실질금리 또는 기간 프리미엄이 제한적 구간",
            {"tips10y": tips.get("value") if tips else None,
             "term_premium": term.get("value") if term else None,
             "real_policy_rate": real_policy, "tips_threshold": 2.25, "term_premium_threshold": 1.25}))

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
        items = [item for item in signals if item.get("domain") == domain and not item.get("id", "").startswith("kr_")]
        usable = []
        stale = []
        for item in items:
            if item.get("status") == "unavailable" or not item.get("observation_date"):
                continue
            observed = datetime.fromisoformat(item["observation_date"]).replace(tzinfo=timezone.utc)
            max_age = FRESHNESS_DAYS.get(item.get("frequency", "monthly"), 75)
            (stale if (now - observed).days > max_age else usable).append(item["id"])
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
