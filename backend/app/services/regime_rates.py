"""Deterministic U.S. rate-regime model.

The model keeps four economically different questions separate:

1. current policy/real-rate restriction,
2. recent rate shock and its driver,
3. long-end duration/fiscal stress concentrated in the 30-year sector,
4. forward recession risk embedded in the yield curve.

Yield-curve probability follows the New York Fed's published 10Y-3M probit
parameters.  A rolling 21-observation mean lets the monthly model update every
business day without treating a one-day inversion as a monthly signal.
"""

from __future__ import annotations

import math
from typing import Any, Iterable


RATE_MODEL_VERSION = "2026-08-rates-v3"
NYFED_PROBIT_INTERCEPT = -0.5333
NYFED_PROBIT_SLOPE = -0.6330
MONTHLY_TRADING_DAYS = 21
INVERSION_CONFIRM_DAYS = 5
POST_INVERSION_MEMORY_DAYS = 252


def _clamp(value: float, low: float = -100.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _normal_cdf(value: float) -> float:
    return 0.5 * (1.0 + math.erf(value / math.sqrt(2.0)))


def recession_probability_12m(term_spread: float) -> float:
    """Return New York Fed-style 12-month-ahead recession probability.

    ``term_spread`` is the monthly-average 10Y minus 3M Treasury spread in
    percentage points.  The returned value is a percentage from 0 to 100.
    """

    z_score = NYFED_PROBIT_INTERCEPT + NYFED_PROBIT_SLOPE * term_spread
    return round(_normal_cdf(z_score) * 100, 4)


def _history(signal: dict[str, Any] | None) -> list[tuple[str, float]]:
    if not signal:
        return []
    # Keep the last value for duplicate dates and make every calculation
    # independent from input order.
    by_date: dict[str, float] = {}
    for row in signal.get("history", []):
        try:
            value = float(row["value"])
        except (KeyError, TypeError, ValueError):
            continue
        if math.isfinite(value) and row.get("date"):
            by_date[str(row["date"])] = value
    return sorted(by_date.items())


def _latest(signal: dict[str, Any] | None) -> float | None:
    rows = _history(signal)
    return rows[-1][1] if rows else None


def _delta(signal: dict[str, Any] | None, periods: int) -> float | None:
    rows = _history(signal)
    return rows[-1][1] - rows[-periods - 1][1] if len(rows) > periods else None


def _percent_change(signal: dict[str, Any] | None, periods: int) -> float | None:
    rows = _history(signal)
    if len(rows) <= periods or rows[-periods - 1][1] == 0:
        return None
    return (rows[-1][1] / rows[-periods - 1][1] - 1) * 100


def _rolling_mean(rows: list[tuple[str, float]], window: int) -> list[tuple[str, float]]:
    if window <= 0 or len(rows) < window:
        return []
    total = sum(value for _, value in rows[:window])
    result = [(rows[window - 1][0], total / window)]
    for index in range(window, len(rows)):
        total += rows[index][1] - rows[index - window][1]
        result.append((rows[index][0], total / window))
    return result


def _aligned_changes(
    signals: dict[str, dict[str, Any]], keys: Iterable[str], periods: int,
) -> dict[str, Any] | None:
    keys = tuple(keys)
    histories = {key: dict(_history(signals.get(key))) for key in keys}
    common_dates = sorted(set.intersection(*(set(rows) for rows in histories.values()))) if histories else []
    if len(common_dates) <= periods:
        return None
    start, end = common_dates[-periods - 1], common_dates[-1]
    return {
        "periods": periods,
        "start_date": start,
        "end_date": end,
        "changes": {
            key: round(histories[key][end] - histories[key][start], 4)
            for key in keys
        },
    }


def aligned_changes(
    signals: dict[str, dict[str, Any]], keys: Iterable[str], periods: int,
) -> dict[str, Any] | None:
    """Return observation changes on dates shared by every requested series."""

    return _aligned_changes(signals, keys, periods)


def aligned_ten_year_changes(
    signals: dict[str, dict[str, Any]], periods: int = 20,
) -> dict[str, Any] | None:
    """Align nominal, real and breakeven observations before differencing."""

    return _aligned_changes(signals, ("us10y", "tips10y", "bei10y"), periods)


def aligned_long_end_changes(
    signals: dict[str, dict[str, Any]], periods: int = 20,
) -> dict[str, Any] | None:
    """Align official 10Y/30Y nominal and real Treasury observations."""

    return _aligned_changes(
        signals, ("us10y", "us30y", "tips10y", "tips30y"), periods,
    )


def _percentile_rank(values: list[float], current: float | None) -> float | None:
    if current is None or len(values) < 60:
        return None
    return round(sum(value <= current for value in values) / len(values) * 100, 1)


def _restriction_label(score: float | None) -> str:
    if score is None:
        return "판정 불가"
    if score >= 65:
        return "매우 제한적"
    if score >= 25:
        return "제한적"
    if score >= -20:
        return "중립"
    return "완화적"


def _policy_layer(signals: dict[str, dict[str, Any]]) -> dict[str, Any]:
    fed = _latest(signals.get("fedfunds"))
    core_pce_yoy = _percent_change(signals.get("core_pce"), 12)
    real_policy = fed - core_pce_yoy if fed is not None and core_pce_yoy is not None else None
    score = None if real_policy is None else round(_clamp(real_policy * 50), 1)
    label = (
        "판정 불가" if real_policy is None
        else "제한적" if real_policy >= 1
        else "다소 제한적" if real_policy >= 0
        else "완화적"
    )
    return {
        "score": score,
        "label": label,
        "fed_funds": fed,
        "core_pce_yoy": round(core_pce_yoy, 2) if core_pce_yoy is not None else None,
        "real_policy_rate": round(real_policy, 2) if real_policy is not None else None,
        "semantics": "ex_post_real_policy_proxy",
    }


def _long_rate_layer(signals: dict[str, dict[str, Any]]) -> dict[str, Any]:
    nominal = _latest(signals.get("us10y"))
    tips = _latest(signals.get("tips10y"))
    breakeven = _latest(signals.get("bei10y"))
    term = _latest(signals.get("term_premium"))
    nominal_30y = _latest(signals.get("us30y"))
    real_30y = _latest(signals.get("tips30y"))
    # TIPS already contains the long real-rate burden.  The estimated nominal
    # term premium explains that burden but is not added again to the score.
    score = None if tips is None else round(_clamp((tips - 1.5) * 60), 1)
    term_values = [value for _, value in _history(signals.get("term_premium"))][-2520:]
    term_percentile = _percentile_rank(term_values, term)
    term_change_63d = _delta(signals.get("term_premium"), 63)
    if term_percentile is None:
        term_label = "판정 불가" if term is None else "표본 부족"
    elif term_percentile >= 90:
        term_label = "역사적 상단"
    elif term_percentile >= 75:
        term_label = "높은 편"
    else:
        term_label = "통상 범위"
    return {
        "score": score,
        "label": _restriction_label(score),
        "nominal_10y": nominal,
        "real_10y": tips,
        "breakeven_10y": breakeven,
        "nominal_30y": nominal_30y,
        "real_30y": real_30y,
        "spread_30y10y": round(nominal_30y - nominal, 3)
        if nominal_30y is not None and nominal is not None else None,
        "term_premium": term,
        "term_premium_percentile": term_percentile,
        "term_premium_change_63d": round(term_change_63d, 3) if term_change_63d is not None else None,
        "term_premium_label": term_label,
        "term_premium_role": "decomposition_context",
        "term_premium_model": "Kim-Wright THREEFYTP10",
    }


def _duration_stress_layer(signals: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Detect a persistent shock concentrated in the far end of the curve.

    The 30Y lane is bounded confirmation. It can raise review urgency and put
    a floor under the recent-shock layer, but cannot become a separate macro
    domain or create a severe rate score by itself.
    """

    nominal_10y = _latest(signals.get("us10y"))
    nominal_30y = _latest(signals.get("us30y"))
    real_30y = _latest(signals.get("tips30y"))
    spread = (
        nominal_30y - nominal_10y
        if nominal_30y is not None and nominal_10y is not None else None
    )
    change20 = aligned_long_end_changes(signals, 20)
    change63 = aligned_long_end_changes(signals, 63)

    histories = {
        key: dict(_history(signals.get(key)))
        for key in ("us10y", "us30y", "tips30y")
    }
    common_dates = sorted(set.intersection(*(set(rows) for rows in histories.values())))
    confirmation_dates = common_dates[-5:]
    confirmation_count = sum(
        histories["tips30y"][when] >= 3.0
        and histories["us30y"][when] - histories["us10y"][when] >= .50
        for when in confirmation_dates
    )
    confirmed = len(confirmation_dates) >= 3 and confirmation_count >= 3

    if not change20 or real_30y is None or spread is None:
        return {
            "score": None,
            "bounded_shock_floor": 0.0,
            "label": "판정 불가",
            "driver": "판정 불가",
            "nominal_10y": nominal_10y,
            "nominal_30y": nominal_30y,
            "real_30y": real_30y,
            "spread_30y10y": round(spread, 3) if spread is not None else None,
            "change_20d": change20,
            "change_63d": change63,
            "confirmation_count_5d": confirmation_count,
            "confirmed": False,
            "persistent": False,
            "role": "bounded_confirmation",
        }

    changes20 = change20["changes"]
    nominal_change = changes20["us30y"]
    real_change = changes20["tips30y"]
    bei_change = _delta(signals.get("bei10y"), 20)
    score = 0.0
    if confirmed and (
        real_change >= .25
        or (nominal_change >= .35 and real_change >= .15)
    ):
        score = 55.0
    elif confirmed and real_30y >= 3.0 and real_change >= .15 and spread >= .50:
        score = 35.0
    elif confirmed and nominal_change >= .25 and spread >= .50:
        score = 25.0

    changes63 = change63["changes"] if change63 else None
    persistent = bool(
        score > 0
        and changes63
        and changes63["tips30y"] >= .20
        and changes63["us30y"] >= .20
    )
    if persistent:
        score = min(60.0, score + 5.0)

    if real_change >= .15 and (bei_change is None or bei_change < .10):
        driver = "30Y 실질금리 주도"
    elif bei_change is not None and bei_change >= .15:
        driver = "인플레이션 기대 동반"
    else:
        driver = "장기금리 혼합"
    label = (
        "장기 듀레이션 충격" if score >= 50
        else "장기 듀레이션 부담 경계" if score >= 35
        else "장기금리 상승 관찰" if score >= 25
        else "장기 구간 추가 충격 없음"
    )
    return {
        "score": round(score, 1),
        "bounded_shock_floor": round(min(score, 40.0), 1),
        "label": label,
        "driver": driver,
        "nominal_10y": nominal_10y,
        "nominal_30y": nominal_30y,
        "real_30y": real_30y,
        "spread_30y10y": round(spread, 3),
        "change_20d": change20,
        "change_63d": change63,
        "breakeven_10y_change_20d": round(bei_change, 4)
        if bei_change is not None else None,
        "confirmation_count_5d": confirmation_count,
        "confirmed": confirmed,
        "persistent": persistent,
        "role": "bounded_confirmation",
        "thresholds": {
            "real_30y_level": 3.0,
            "real_30y_change_20d": .15,
            "spread_30y10y": .50,
            "confirmation_observations": "3_of_5",
        },
    }


def _shock_layer(
    signals: dict[str, dict[str, Any]],
    duration_stress: dict[str, Any],
) -> dict[str, Any]:
    change20 = aligned_ten_year_changes(signals, 20)
    change63 = aligned_ten_year_changes(signals, 63)
    if not change20:
        duration_floor = float(duration_stress.get("bounded_shock_floor") or 0)
        if duration_floor > 0:
            return {
                "score": duration_floor,
                "base_score": None,
                "duration_floor": duration_floor,
                "label": "긴축 충격" if duration_floor >= 35 else "상승 압력",
                "direction": "긴축",
                "persistent": bool(duration_stress.get("persistent")),
                "change_20d": None,
                "change_63d": None,
            }
        return {
            "score": None, "label": "판정 불가", "direction": "판정 불가",
            "persistent": False, "change_20d": None, "change_63d": None,
            "base_score": None, "duration_floor": 0.0,
        }

    c20 = change20["changes"]
    real20, nominal20, bei20 = c20["tips10y"], c20["us10y"], c20["bei10y"]
    pressure = 0.0
    if real20 >= .50:
        pressure = 80
    elif real20 >= .25:
        pressure = 45
    elif real20 >= .15:
        pressure = 25
    if nominal20 >= .50 and bei20 >= .30:
        pressure = max(pressure, 70)
    elif nominal20 >= .35 and bei20 >= .15:
        pressure = max(pressure, 40)

    c63 = change63["changes"] if change63 else None
    persistent = bool(
        c63 and real20 > .10 and c63["tips10y"] > .20
        and nominal20 > .10 and c63["us10y"] > .20
    )
    if persistent and 0 < pressure < 65:
        pressure = min(60, pressure + 10)

    base_pressure = pressure
    duration_floor = float(duration_stress.get("bounded_shock_floor") or 0)
    pressure = max(pressure, duration_floor)
    persistent = persistent or bool(
        duration_floor > 0 and duration_stress.get("persistent")
    )

    if duration_floor > 0:
        direction = "긴축"
    elif real20 <= -.15 and nominal20 <= -.15:
        direction = "완화"
    elif real20 >= .15 or nominal20 >= .25:
        direction = "긴축"
    elif real20 * nominal20 < 0:
        direction = "혼합"
    else:
        direction = "안정"
    label = (
        "급격한 긴축 충격" if pressure >= 65
        else "긴축 충격" if pressure >= 35
        else "상승 압력" if pressure >= 15
        else "완화 방향" if direction == "완화"
        else "변화 제한적"
    )
    return {
        "score": round(pressure, 1),
        "base_score": round(base_pressure, 1),
        "duration_floor": round(duration_floor, 1),
        "label": label,
        "direction": direction,
        "persistent": persistent,
        "change_20d": {**change20, "changes": c20},
        "change_63d": change63,
    }


def _negative_runs(rows: list[tuple[str, float]]) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start: int | None = None
    for index, (_, value) in enumerate(rows):
        if value < 0 and start is None:
            start = index
        elif value >= 0 and start is not None:
            runs.append((start, index - 1))
            start = None
    if start is not None:
        runs.append((start, len(rows) - 1))
    return runs


def _steepening_driver(signals: dict[str, dict[str, Any]]) -> dict[str, Any]:
    change = _aligned_changes(signals, ("us10y", "us3m"), 20)
    if not change:
        return {
            "state": "판정 불가", "long_change_20d": None,
            "short_change_20d": None, "spread_change_20d": None,
        }
    long_change = change["changes"]["us10y"]
    short_change = change["changes"]["us3m"]
    spread_change = long_change - short_change
    if spread_change >= .15 and short_change <= -.10 and short_change < long_change:
        state = "단기금리 하락 주도"
    elif spread_change >= .15 and long_change >= .10 and long_change > short_change:
        state = "장기금리 상승 주도"
    elif spread_change >= .15:
        state = "혼합 재가팔라짐"
    elif spread_change <= -.15:
        state = "평탄화·역전 심화"
    else:
        state = "변화 제한적"
    return {
        "state": state,
        "long_change_20d": round(long_change, 3),
        "short_change_20d": round(short_change, 3),
        "spread_change_20d": round(spread_change, 3),
        "start_date": change["start_date"],
        "end_date": change["end_date"],
    }


def _yield_curve_layer(signals: dict[str, dict[str, Any]]) -> dict[str, Any]:
    primary_rows = _history(signals.get("curve10y3m"))
    primary_rolling = _rolling_mean(primary_rows, MONTHLY_TRADING_DAYS)
    confirmation_rolling = _rolling_mean(
        _history(signals.get("curve2s10s")), MONTHLY_TRADING_DAYS,
    )
    if not primary_rolling:
        return {
            "score": None, "label": "판정 불가", "state": "판정 불가",
            "spread_10y3m": _latest(signals.get("curve10y3m")),
            "monthly_average_10y3m": None,
            "recession_probability_12m": None,
            "spread_10y2y": _latest(signals.get("curve2s10s")),
            "monthly_average_10y2y": None,
            "inversion_days": 0, "days_since_inversion": None,
            "last_inversion_date": None, "inversion_memory": False,
            "steepening": _steepening_driver(signals),
            "as_of_date": primary_rows[-1][0] if primary_rows else None,
            "evidence_cluster": "yield_curve",
        }

    current_average = primary_rolling[-1][1]
    probability = recession_probability_12m(current_average)
    runs = _negative_runs(primary_rolling)
    confirmed_runs = [run for run in runs if run[1] - run[0] + 1 >= INVERSION_CONFIRM_DAYS]
    current_run = runs[-1] if runs and runs[-1][1] == len(primary_rolling) - 1 else None
    current_confirmed = bool(
        current_run and current_run[1] - current_run[0] + 1 >= INVERSION_CONFIRM_DAYS
    )
    inversion_days = current_run[1] - current_run[0] + 1 if current_run else 0
    last_confirmed = confirmed_runs[-1] if confirmed_runs else None
    last_inversion_date = primary_rolling[last_confirmed[1]][0] if last_confirmed else None
    days_since = (
        0 if current_confirmed
        else len(primary_rolling) - 1 - last_confirmed[1] if last_confirmed
        else None
    )

    # Map the published probability to a bounded contribution.  Curve risk can
    # move the rates domain to watch, but cannot declare severe deterioration
    # by itself; it remains one leading evidence cluster.
    pressure = _clamp((probability - 10) / 40 * 60, 0, 60)
    confirmation_average = confirmation_rolling[-1][1] if confirmation_rolling else None
    if current_average < 0 and confirmation_average is not None and confirmation_average < 0:
        pressure = min(60, pressure + 5)

    inversion_memory = bool(
        not current_confirmed and days_since is not None
        and days_since <= POST_INVERSION_MEMORY_DAYS
    )
    if inversion_memory:
        memory_floor = 45 if days_since <= 63 else 35 if days_since <= 126 else 25
        pressure = max(pressure, memory_floor)

    if current_confirmed:
        state = "역전 지속"
    elif current_average < 0:
        state = "역전 확인 중"
    elif inversion_memory:
        state = "역전 후 관찰"
    elif current_average <= .25:
        state = "평탄화 경계"
    else:
        state = "정상 우상향"
    label = "선행위험 높음" if probability >= 50 else "선행위험 경계" if probability >= 30 or inversion_memory else "선행위험 낮음"

    return {
        "score": round(pressure, 1),
        "label": label,
        "state": state,
        "spread_10y3m": primary_rows[-1][1],
        "monthly_average_10y3m": round(current_average, 3),
        "recession_probability_12m": probability,
        "spread_10y2y": _latest(signals.get("curve2s10s")),
        "monthly_average_10y2y": round(confirmation_average, 3) if confirmation_average is not None else None,
        "confirmation": "동반 역전" if confirmation_average is not None and confirmation_average < 0 else "비역전",
        "inversion_days": inversion_days,
        "days_since_inversion": days_since,
        "last_inversion_date": last_inversion_date,
        "inversion_memory": inversion_memory,
        "steepening": _steepening_driver(signals),
        "as_of_date": primary_rows[-1][0],
        "evidence_cluster": "yield_curve",
        "probability_model": "NY Fed 10Y-3M probit (-0.5333, -0.6330)",
        "smoothing": "최근 21관측일 평균",
    }


def calculate_rate_model(signal_list: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate the layered rate model from cached signal histories."""

    signals = {item["id"]: item for item in signal_list}
    policy = _policy_layer(signals)
    long_rates = _long_rate_layer(signals)
    duration_stress = _duration_stress_layer(signals)
    recent_shock = _shock_layer(signals, duration_stress)
    yield_curve = _yield_curve_layer(signals)

    restriction_scores = [
        score for score in (policy["score"], long_rates["score"])
        if score is not None
    ]
    restriction_score = max(restriction_scores) if restriction_scores else None
    candidates: list[tuple[str, float]] = []
    if restriction_score is not None:
        candidates.append(("현재 제약 수준", restriction_score))
    if recent_shock["score"] is not None and recent_shock["score"] >= 15:
        candidates.append(("최근 긴축 충격", recent_shock["score"]))
    if yield_curve["score"] is not None and yield_curve["score"] >= 25:
        candidates.append(("수익률곡선 선행위험", yield_curve["score"]))
    if not candidates:
        fallback = [
            score for score in (recent_shock["score"], yield_curve["score"])
            if score is not None
        ]
        if fallback:
            candidates.append(("가용 금리 정보", max(fallback)))

    if candidates:
        driver, score = max(candidates, key=lambda item: item[1])
        score = round(score, 1)
    else:
        driver, score = "판정 불가", None
    coverage_inputs = {
        "policy": policy["score"] is not None,
        "long_rates": long_rates["score"] is not None,
        "recent_shock": recent_shock["score"] is not None,
        "yield_curve": yield_curve["score"] is not None,
    }
    as_of_dates = [
        rows[-1][0] for key in ("fedfunds", "tips10y", "tips30y", "curve10y3m")
        if (rows := _history(signals.get(key)))
    ]
    return {
        "version": RATE_MODEL_VERSION,
        "score": score,
        "label": _restriction_label(score),
        "driver": driver,
        "policy": policy,
        "long_rates": long_rates,
        "recent_shock": recent_shock,
        "duration_stress": duration_stress,
        "yield_curve": yield_curve,
        "coverage": round(sum(coverage_inputs.values()) / len(coverage_inputs), 3),
        "coverage_inputs": coverage_inputs,
        "as_of_date": max(as_of_dates) if as_of_dates else None,
        "methodology": (
            "현재 제약 수준·30년물 확인을 포함한 최근 금리 충격·"
            "10Y-3M 침체 선행위험의 최댓값"
        ),
    }
