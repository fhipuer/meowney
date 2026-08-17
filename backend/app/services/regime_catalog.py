"""Regime indicator semantics shared by calculation and presentation."""

from __future__ import annotations

from typing import Any


DISPLAY_POINTS = {"daily": 252, "weekly": 104, "monthly": 60, "quarterly": 40}

RATE_IDS = {"fedfunds", "us3m", "us2y", "us10y", "us30y", "tips10y", "bei10y", "term_premium"}
SPREAD_IDS = {"curve10y3m", "curve2s10s", "hy_oas", "ig_oas"}
INFLATION_INDEX_IDS = {"cpi", "core_cpi", "pce", "core_pce", "ppi", "wages"}

CORE_IDS = {
    "us_unemployment", "us_claims", "us_payrolls", "us_indpro",
    "core_cpi", "core_pce", "tips10y", "us10y", "bei10y", "curve10y3m",
    "hy_oas", "ig_oas", "nfci",
}
TRIGGER_ONLY_IDS = {
    "market_sp500", "market_nasdaq", "market_vix", "market_usdkrw",
}
CONTEXT_IDS = {
    "fed_assets", "bank_reserves", "reverse_repo", "market_kospi",
    "market_dollar", "market_wti", "market_copper",
    "market_gold", "market_silver", "market_gold_silver_ratio",
    "us3m", "us2y", "us30y", "term_premium",
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


def decision_chart(indicator_id: str, observations: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Return the transformed series that explains the actual decision rule."""
    values = [float(row["value"]) for row in observations]
    dates = [row["observation_date"] for row in observations]
    points: list[dict[str, Any]] = []
    series: list[dict[str, str]] = []
    title, unit = "", "%"
    references: list[dict[str, Any]] = []

    if indicator_id in INFLATION_INDEX_IDS:
        title = "전년 대비와 최근 3개월 연율"
        series = [{"key": "yoy", "label": "YoY"}, {"key": "annualized_3m", "label": "3M 연율"}]
        references = [{"value": 2, "label": "물가 목표 2%"}]
        for index, current in enumerate(values):
            point: dict[str, Any] = {"date": dates[index]}
            if index >= 12 and values[index - 12]:
                point["yoy"] = round((current / values[index - 12] - 1) * 100, 3)
            if index >= 3 and values[index - 3] > 0:
                point["annualized_3m"] = round(((current / values[index - 3]) ** 4 - 1) * 100, 3)
            if len(point) > 1:
                points.append(point)
    elif indicator_id == "us_gdp":
        title, series = "실질 GDP 성장률", [{"key": "qoq_annualized", "label": "QoQ 연율"}, {"key": "yoy", "label": "YoY"}]
        for index, current in enumerate(values):
            point = {"date": dates[index]}
            if index >= 1 and values[index - 1] > 0:
                point["qoq_annualized"] = round(((current / values[index - 1]) ** 4 - 1) * 100, 3)
            if index >= 4 and values[index - 4]:
                point["yoy"] = round((current / values[index - 4] - 1) * 100, 3)
            if len(point) > 1:
                points.append(point)
    elif indicator_id == "us_payrolls":
        title, unit = "월간 고용 증가와 3개월 평균", "천 명"
        series = [{"key": "monthly_change", "label": "월간 증가"}, {"key": "average_3m", "label": "3M 평균"}]
        changes = [values[index] - values[index - 1] for index in range(1, len(values))]
        for index, change in enumerate(changes, start=1):
            point = {"date": dates[index], "monthly_change": round(change, 3)}
            if index >= 3:
                point["average_3m"] = round(sum(changes[index - 3:index]) / 3, 3)
            points.append(point)
    elif indicator_id in {"us_retail", "us_indpro"}:
        title = "최근 성장 모멘텀"
        series = [{"key": "annualized_3m", "label": "3M 연율"}, {"key": "yoy", "label": "YoY"}]
        for index, current in enumerate(values):
            point = {"date": dates[index]}
            if index >= 3 and values[index - 3] > 0:
                point["annualized_3m"] = round(((current / values[index - 3]) ** 4 - 1) * 100, 3)
            if index >= 12 and values[index - 12]:
                point["yoy"] = round((current / values[index - 12] - 1) * 100, 3)
            if len(point) > 1:
                points.append(point)
    elif indicator_id == "us_unemployment":
        title, unit = "실업률 3개월 변화", "%p"
        series = [{"key": "delta_3m", "label": "3M 변화"}]
        references = [
            {"value": .15, "label": "주의 +0.15%p"},
            {"value": .30, "label": "악화 +0.30%p"},
        ]
        points = [
            {"date": dates[index], "delta_3m": round(value - values[index - 3], 3)}
            for index, value in enumerate(values) if index >= 3
        ]
    elif indicator_id == "us_claims":
        title, unit = "신규실업수당 13주 변화율", "%"
        series = [{"key": "change_13w", "label": "13W 변화"}]
        references = [
            {"value": 7, "label": "주의 +7%"},
            {"value": 15, "label": "악화 +15%"},
        ]
        points = [
            {"date": dates[index], "change_13w": round((value / values[index - 13] - 1) * 100, 3)}
            for index, value in enumerate(values) if index >= 13 and values[index - 13]
        ]
    elif indicator_id in {"fed_assets", "bank_reserves"}:
        title = "전년 대비 유동성 변화"
        series = [{"key": "yoy", "label": "YoY"}]
        for index, current in enumerate(values):
            if index >= 52 and values[index - 52]:
                points.append({"date": dates[index], "yoy": round((current / values[index - 52] - 1) * 100, 3)})
    elif indicator_id in RATE_IDS | SPREAD_IDS | {"nfci"}:
        title = "절대수준과 판정 임계선"
        unit = "%p" if indicator_id in SPREAD_IDS else "%" if indicator_id in RATE_IDS else "지수"
        series = [{"key": "value", "label": "현재 수준"}]
        reference_map = {
            "tips10y": [(2.25, "제한적 2.25%")],
            "hy_oas": [(4, "주의 4%p"), (5, "악화 5%p")],
            "ig_oas": [(1.2, "주의 1.2%p"), (1.5, "악화 1.5%p")],
            "nfci": [(0, "긴축 전환 0"), (.5, "악화 0.5")],
            "curve2s10s": [(0, "역전 경계 0"), (-.5, "악화 -0.5%p")],
            "curve10y3m": [(0, "역전 경계 0"), (-.5, "깊은 역전 -0.5%p")],
        }
        references = [
            {"value": value, "label": label}
            for value, label in reference_map.get(indicator_id, [])
        ]
        points = [{"date": date, "value": value} for date, value in zip(dates, values)]
    else:
        return None

    return {
        "title": title,
        "unit": unit,
        "series": series,
        "points": points[-252:] if indicator_id in RATE_IDS | SPREAD_IDS | {"nfci"} else points[-60:],
        "reference_lines": references,
    } if points else None


def display_metrics(indicator_id: str, frequency: str, values: list[float]) -> list[dict[str, Any]]:
    if not values:
        return []
    if indicator_id == "us_unemployment":
        return [
            {"label": label, "value": round(values[-1] - values[-period - 1], 2), "unit": "%p", "kind": "delta"}
            for label, period in (("1개월", 1), ("3개월", 3), ("1년", 12))
            if len(values) > period
        ]
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
