"""Regime indicator semantics shared by calculation and presentation."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from app.services.regime_periods import (
    annualized_change,
    dated_values,
    period_delta,
    period_percent_change,
)


DISPLAY_POINTS = {"daily": 252, "weekly": 104, "monthly": 60, "quarterly": 40}

RATE_IDS = {
    "fedfunds", "us3m", "us2y", "us10y", "us30y",
    "tips10y", "tips30y", "bei10y", "term_premium",
    "fed_target_lower", "fed_target_upper",
}
SPREAD_IDS = {"curve10y3m", "curve2s10s", "hy_oas", "ig_oas"}
INFLATION_INDEX_IDS = {
    "cpi", "core_cpi", "pce", "core_pce", "ppi", "ppi_commodities", "wages",
}
OFFICIAL_CPI_IDS = {"cpi_nsa", "core_cpi_nsa"}

CORE_IDS = {
    "us_unemployment", "us_claims", "us_payrolls", "us_indpro",
    "core_cpi", "core_pce", "tips10y", "us10y", "bei10y", "curve10y3m",
    "hy_oas", "ig_oas", "nfci",
}
TRIGGER_ONLY_IDS = {
    "market_sp500", "market_nasdaq", "market_vix", "market_usdkrw",
    "us30y", "tips30y",
}
CONTEXT_IDS = {
    "fed_assets", "bank_reserves", "reverse_repo", "market_kospi",
    "market_dxy", "market_dollar", "market_wti", "market_ovx", "market_copper",
    "market_gold", "market_silver", "market_gold_silver_ratio",
    "us3m", "us2y", "term_premium", "pce", "cpi_nsa", "core_cpi_nsa",
    "fed_target_lower", "fed_target_upper",
}

US_INDICATOR_IDS = {
    "us_gdp", "us_unemployment", "us_claims", "us_payrolls", "us_retail",
    "us_indpro", "cpi", "core_cpi", "pce", "core_pce", "ppi", "wages",
    "fedfunds", "us3m", "us2y", "us10y", "us30y", "tips10y", "tips30y",
    "bei10y", "term_premium", "curve10y3m", "curve2s10s", "hy_oas",
    "ig_oas", "nfci", "fed_assets", "bank_reserves", "reverse_repo",
    "market_sp500", "market_nasdaq", "market_vix", "market_ovx",
    "cpi_nsa", "core_cpi_nsa", "fed_target_lower", "fed_target_upper",
}

HIGHER_SUPPORTIVE_IDS = {"us_gdp", "us_payrolls", "us_indpro", "kr_gdp", "kr_indpro"}
HIGHER_ADVERSE_IDS = {"us_unemployment", "us_claims", "hy_oas", "ig_oas"}


def indicator_role(indicator_id: str) -> dict[str, str]:
    if indicator_id in CORE_IDS:
        return {"decision_role": "core", "usage": "regime"}
    if indicator_id in TRIGGER_ONLY_IDS:
        return {"decision_role": "corroborative", "usage": "trigger"}
    if indicator_id in CONTEXT_IDS or indicator_id.startswith("kr_"):
        return {"decision_role": "context", "usage": "display"}
    return {"decision_role": "corroborative", "usage": "regime"}


def indicator_semantics(indicator_id: str) -> dict[str, Any]:
    """Return presentation metadata without encoding it in a display name.

    Raw direction and economic meaning are deliberately separate.  Market
    prices and rates need context before an increase can be called supportive
    or adverse, while a small group of growth/labor metrics is monotonic enough
    to receive a semantic tone directly.
    """

    if indicator_id.startswith("kr_") or indicator_id == "market_kospi":
        country = "한국"
    elif indicator_id in US_INDICATOR_IDS:
        country = "미국"
    else:
        country = "글로벌"

    if indicator_id.startswith("market_"):
        lens = "market_context"
    elif indicator_id in RATE_IDS | SPREAD_IDS | {"nfci"}:
        lens = "macro_context"
    else:
        lens = "macro"

    if indicator_id in HIGHER_SUPPORTIVE_IDS:
        tone_policy = "higher_supportive"
    elif indicator_id in HIGHER_ADVERSE_IDS:
        tone_policy = "higher_adverse"
    else:
        tone_policy = "semantic_only"

    series_contracts = {
        "cpi": ("seasonally_adjusted", "BLS CPI 계절조정 지수 · 단기 모멘텀"),
        "core_cpi": ("seasonally_adjusted", "BLS Core CPI 계절조정 지수 · 단기 모멘텀"),
        "cpi_nsa": ("not_seasonally_adjusted", "BLS 공식 CPI 전년동월비"),
        "core_cpi_nsa": ("not_seasonally_adjusted", "BLS 공식 Core CPI 전년동월비"),
        "ppi": ("seasonally_adjusted", "BLS 최종수요 PPI"),
        "ppi_commodities": ("not_seasonally_adjusted", "BLS 원자재 단계 상품 PPI"),
        "us_payrolls": ("seasonally_adjusted", "BLS 비농업 고용 수준"),
    }
    seasonal_adjustment, statistical_scope = series_contracts.get(
        indicator_id, (None, None)
    )
    result = {
        "country": country,
        "interpretation_lens": lens,
        "tone_policy": tone_policy,
        "proxy_for": "SGOV 단기국채 금리환경" if indicator_id == "us3m" else None,
        "seasonal_adjustment": seasonal_adjustment,
        "statistical_scope": statistical_scope,
    }
    if indicator_id in {"cpi_nsa", "core_cpi_nsa", "fed_target_lower", "fed_target_upper"}:
        result["presentation_hidden"] = True
    return result


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


def _coerce_observations(
    observations: list[dict[str, Any]] | list[float], frequency: str,
) -> list[dict[str, Any]]:
    """Keep the historical helper API while making production rows date-aware."""

    if not observations or isinstance(observations[0], dict):
        return observations  # type: ignore[return-value]
    rows: list[dict[str, Any]] = []
    for index, value in enumerate(observations):
        if frequency in {"monthly", "quarterly"}:
            month_offset = index * (3 if frequency == "quarterly" else 1)
            ordinal = 2000 * 12 + month_offset
            year, month_index = divmod(ordinal, 12)
            when = date(year, month_index + 1, 1)
        else:
            when = date(2000, 1, 1) + timedelta(days=index * (7 if frequency == "weekly" else 1))
        rows.append({"date": when.isoformat(), "value": float(value)})
    return rows


def decision_chart(indicator_id: str, observations: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Return the transformed series that explains the actual decision rule."""
    normalized = [
        {"date": when.isoformat(), "value": value}
        for when, value in dated_values(observations)
    ]
    values = [row["value"] for row in normalized]
    dates = [row["date"] for row in normalized]
    points: list[dict[str, Any]] = []
    series: list[dict[str, str]] = []
    title, unit = "", "%"
    references: list[dict[str, Any]] = []

    if indicator_id in INFLATION_INDEX_IDS | OFFICIAL_CPI_IDS:
        official_only = indicator_id in OFFICIAL_CPI_IDS
        title = "공식 전년동월비" if official_only else "전년 대비와 최근 3개월 연율"
        series = [{"key": "yoy", "label": "YoY"}]
        if not official_only:
            series.append({"key": "annualized_3m", "label": "3M 연율"})
        references = [{"value": 2, "label": "물가 목표 2%"}]
        for index, _current in enumerate(values):
            point: dict[str, Any] = {"date": dates[index]}
            yoy = period_percent_change(normalized, "monthly", 12, end_index=index)
            annualized = annualized_change(normalized, "monthly", 3, end_index=index)
            if yoy is not None:
                point["yoy"] = round(yoy, 3)
            if not official_only and annualized is not None:
                point["annualized_3m"] = round(annualized, 3)
            if len(point) > 1:
                points.append(point)
    elif indicator_id == "us_gdp":
        title, series = "실질 GDP 성장률", [{"key": "qoq_annualized", "label": "QoQ 연율"}, {"key": "yoy", "label": "YoY"}]
        for index, _current in enumerate(values):
            point = {"date": dates[index]}
            qoq = annualized_change(normalized, "quarterly", 1, end_index=index)
            yoy = period_percent_change(normalized, "quarterly", 4, end_index=index)
            if qoq is not None:
                point["qoq_annualized"] = round(qoq, 3)
            if yoy is not None:
                point["yoy"] = round(yoy, 3)
            if len(point) > 1:
                points.append(point)
    elif indicator_id == "us_payrolls":
        title, unit = "월간 고용 증가와 3개월 평균", "천 명"
        series = [{"key": "monthly_change", "label": "월간 증가"}, {"key": "average_3m", "label": "3M 평균"}]
        changes = [period_delta(normalized, "monthly", 1, end_index=index) for index in range(1, len(values))]
        for index, change in enumerate(changes, start=1):
            if change is None:
                continue
            point = {"date": dates[index], "monthly_change": round(change, 3)}
            recent = [item for item in changes[max(0, index - 3):index] if item is not None]
            if len(recent) == 3:
                point["average_3m"] = round(sum(recent) / 3, 3)
            points.append(point)
    elif indicator_id in {"us_retail", "us_indpro"}:
        title = "최근 성장 모멘텀"
        series = [{"key": "annualized_3m", "label": "3M 연율"}, {"key": "yoy", "label": "YoY"}]
        for index, _current in enumerate(values):
            point = {"date": dates[index]}
            annualized = annualized_change(normalized, "monthly", 3, end_index=index)
            yoy = period_percent_change(normalized, "monthly", 12, end_index=index)
            if annualized is not None:
                point["annualized_3m"] = round(annualized, 3)
            if yoy is not None:
                point["yoy"] = round(yoy, 3)
            if len(point) > 1:
                points.append(point)
    elif indicator_id == "us_unemployment":
        title, unit = "실업률 3개월 변화", "%p"
        series = [{"key": "delta_3m", "label": "3M 변화"}]
        references = [
            {"value": .15, "label": "주의 +0.15%p"},
            {"value": .30, "label": "악화 +0.30%p"},
        ]
        points = []
        for index, _value in enumerate(values):
            delta = period_delta(normalized, "monthly", 3, end_index=index)
            if delta is not None:
                points.append({"date": dates[index], "delta_3m": round(delta, 3)})
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


def display_metrics(
    indicator_id: str,
    frequency: str,
    observations: list[dict[str, Any]] | list[float],
) -> list[dict[str, Any]]:
    observations = _coerce_observations(observations, frequency)
    normalized = [
        {"date": when.isoformat(), "value": value}
        for when, value in dated_values(observations)
    ]
    values = [row["value"] for row in normalized]
    if not normalized:
        return []
    if indicator_id == "us_unemployment":
        result = []
        for label, period in (("1개월", 1), ("3개월", 3), ("1년", 12)):
            value = period_delta(normalized, frequency, period)
            if value is not None:
                result.append({"label": label, "value": round(value, 2), "unit": "%p", "kind": "delta"})
        return result
    if indicator_id == "us_payrolls":
        latest_change = period_delta(normalized, "monthly", 1)
        if latest_change is None:
            return []
        result = [{
            "label": "최근 월 증가", "value": round(latest_change, 1),
            "unit": "천명", "kind": "delta",
        }]
        recent_changes = [
            period_delta(normalized, "monthly", 1, end_index=index)
            for index in range(max(0, len(values) - 3), len(values))
        ]
        if len(recent_changes) == 3 and all(value is not None for value in recent_changes):
            result.append({
                "label": "3개월 평균",
                "value": round(sum(float(value) for value in recent_changes if value is not None) / 3, 1),
                "unit": "천명", "kind": "delta",
            })
        return result
    if indicator_id in RATE_IDS or indicator_id in SPREAD_IDS:
        periods = (21, 63, 252) if frequency == "daily" else (1, 3, 12)
        labels = ("1개월", "3개월", "1년")
        result = []
        for label, period in zip(labels, periods):
            value = period_delta(normalized, frequency, period)
            if value is not None:
                result.append({
                    "label": label, "value": round(value * 100, 1),
                    "unit": "bp", "kind": "delta",
                })
        return result
    if indicator_id == "nfci":
        return [
            {"label": label, "value": round(value, 3), "unit": "지수p", "kind": "delta"}
            for label, period in (("1개월", 4), ("3개월", 13), ("1년", 52))
            if (value := period_delta(normalized, frequency, period)) is not None
        ]
    if indicator_id in INFLATION_INDEX_IDS | OFFICIAL_CPI_IDS:
        result = []
        yoy = period_percent_change(normalized, "monthly", 12)
        annualized = annualized_change(normalized, "monthly", 3)
        if yoy is not None:
            label = "공식 전년동월비" if indicator_id in OFFICIAL_CPI_IDS else "전년 대비"
            digits = 1 if indicator_id in OFFICIAL_CPI_IDS else 2
            result.append({"label": label, "value": round(yoy, digits), "unit": "%", "kind": "rate"})
        if indicator_id not in OFFICIAL_CPI_IDS and annualized is not None:
            result.append({"label": "3개월 연율", "value": round(annualized, 2), "unit": "%", "kind": "rate"})
        monthly = period_percent_change(normalized, "monthly", 1)
        if indicator_id not in OFFICIAL_CPI_IDS and monthly is not None:
            result.append({"label": "직전 발표", "value": round(monthly, 2), "unit": "%", "kind": "rate"})
        return result
    periods = {"daily": (21, 63, 252), "weekly": (4, 13, 52), "monthly": (1, 3, 12), "quarterly": (1, 4, 4)}[frequency]
    labels = ("1개월", "3개월", "1년") if frequency != "quarterly" else ("전분기", "전년", "전년")
    metrics = []
    seen: set[tuple[str, int]] = set()
    for label, period in zip(labels, periods):
        if (label, period) in seen:
            continue
        seen.add((label, period))
        value = period_percent_change(normalized, frequency, period)
        if value is not None:
            metrics.append({"label": label, "value": round(value, 2), "unit": "%", "kind": "return"})
    return metrics
