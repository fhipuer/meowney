"""Regime indicator semantics shared by calculation and presentation."""

from __future__ import annotations

from typing import Any


DISPLAY_POINTS = {"daily": 252, "weekly": 104, "monthly": 60, "quarterly": 40}

RATE_IDS = {"fedfunds", "us2y", "us10y", "us30y", "tips10y", "bei10y", "term_premium"}
SPREAD_IDS = {"curve2s10s", "hy_oas", "ig_oas"}
INFLATION_INDEX_IDS = {"cpi", "core_cpi", "pce", "core_pce", "ppi"}

CORE_IDS = {
    "us_unemployment", "us_claims", "us_payrolls", "us_indpro",
    "core_cpi", "core_pce", "tips10y", "us10y", "bei10y",
    "hy_oas", "ig_oas", "nfci",
}
TRIGGER_ONLY_IDS = {
    "market_sp500", "market_nasdaq", "market_vix", "market_usdkrw",
}
CONTEXT_IDS = {
    "fed_assets", "bank_reserves", "reverse_repo", "market_kospi",
    "market_dollar", "market_wti", "market_copper",
    "market_gold", "market_silver", "market_gold_silver_ratio",
}


def indicator_role(indicator_id: str) -> dict[str, str]:
    if indicator_id in CORE_IDS:
        return {"decision_role": "core", "usage": "regime"}
    if indicator_id in TRIGGER_ONLY_IDS:
        return {"decision_role": "corroborative", "usage": "trigger"}
    if indicator_id in CONTEXT_IDS or indicator_id.startswith("kr_"):
        return {"decision_role": "context", "usage": "display"}
    return {"decision_role": "corroborative", "usage": "regime"}


def display_history(observations: list[dict[str, Any]], frequency: str) -> list[dict[str, Any]]:
    count = DISPLAY_POINTS.get(frequency, 60)
    return [
        {"date": row["observation_date"], "value": float(row["value"])}
        for row in observations[-count:]
    ]


def display_period(frequency: str) -> str:
    return {
        "daily": "최근 1년", "weekly": "최근 2년",
        "monthly": "최근 5년", "quarterly": "최근 10년",
    }.get(frequency, "최근 자료")


def _percent_change(values: list[float], periods: int) -> float | None:
    if len(values) <= periods or values[-periods - 1] == 0:
        return None
    return (values[-1] / values[-periods - 1] - 1) * 100


def _annualized(values: list[float], periods: int = 3) -> float | None:
    if len(values) <= periods or values[-periods - 1] <= 0:
        return None
    return ((values[-1] / values[-periods - 1]) ** (12 / periods) - 1) * 100


def display_metrics(indicator_id: str, frequency: str, values: list[float]) -> list[dict[str, Any]]:
    if not values:
        return []
    if indicator_id in RATE_IDS or indicator_id in SPREAD_IDS:
        periods = (21, 63, 252) if frequency == "daily" else (1, 3, 12)
        labels = ("1개월", "3개월", "1년")
        return [
            {"label": label, "value": round((values[-1] - values[-period - 1]) * 100, 1), "unit": "bp", "kind": "delta"}
            for label, period in zip(labels, periods) if len(values) > period
        ]
    if indicator_id in INFLATION_INDEX_IDS:
        result = []
        yoy = _percent_change(values, 12)
        annualized = _annualized(values)
        if yoy is not None:
            result.append({"label": "전년 대비", "value": round(yoy, 2), "unit": "%", "kind": "rate"})
        if annualized is not None:
            result.append({"label": "3개월 연율", "value": round(annualized, 2), "unit": "%", "kind": "rate"})
        if len(values) > 1:
            result.append({"label": "직전 발표", "value": round((values[-1] / values[-2] - 1) * 100, 2), "unit": "%", "kind": "rate"})
        return result
    periods = {"daily": (21, 63, 252), "weekly": (4, 13, 52), "monthly": (1, 3, 12), "quarterly": (1, 4, 4)}[frequency]
    labels = ("1개월", "3개월", "1년") if frequency != "quarterly" else ("전분기", "전년", "전년")
    metrics = []
    seen: set[tuple[str, int]] = set()
    for label, period in zip(labels, periods):
        if (label, period) in seen:
            continue
        seen.add((label, period))
        value = _percent_change(values, period)
        if value is not None:
            metrics.append({"label": label, "value": round(value, 2), "unit": "%", "kind": "return"})
    return metrics
