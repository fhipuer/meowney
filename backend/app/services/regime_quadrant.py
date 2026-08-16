"""Point-in-time aware US macro environment model.

The chart coordinates are momentum, while level and financial transmission are
kept as separate outputs.  This prevents "inflation is cooling" from being
misread as "inflation is low" and keeps slow regimes separate from fast alerts.
"""

from __future__ import annotations

import math
import statistics
from datetime import date
from typing import Any, Callable


QUADRANT_VERSION = "2026-08-us-macro-q2"
FRESHNESS_DAYS = {"daily": 14, "weekly": 28, "monthly": 95, "quarterly": 200}


def _pct(values: list[float], periods: int) -> float | None:
    if len(values) <= periods or values[-periods - 1] == 0:
        return None
    return (values[-1] / values[-periods - 1] - 1) * 100


def _delta(values: list[float], periods: int) -> float | None:
    return values[-1] - values[-periods - 1] if len(values) > periods else None


def _annualized(values: list[float], periods: int) -> float | None:
    if len(values) <= periods or values[-periods - 1] <= 0:
        return None
    return ((values[-1] / values[-periods - 1]) ** (12 / periods) - 1) * 100


def _quarterly_annualized(values: list[float], periods: int = 1) -> float | None:
    if len(values) <= periods or values[-periods - 1] <= 0:
        return None
    return ((values[-1] / values[-periods - 1]) ** (4 / periods) - 1) * 100


def _payroll_impulse(values: list[float]) -> float | None:
    """Recent three-month average monthly job gain, in thousands."""
    if len(values) < 4:
        return None
    return sum(values[index] - values[index - 1] for index in range(len(values) - 3, len(values))) / 3


def _negative_delta(periods: int) -> Callable[[list[float]], float | None]:
    return lambda values: -value if (value := _delta(values, periods)) is not None else None


def _negative_pct(periods: int) -> Callable[[list[float]], float | None]:
    return lambda values: -value if (value := _pct(values, periods)) is not None else None


# Equal-cluster weighting limits duplicated evidence. CPI/PCE trend is one
# cluster, labor inflation another; labor and real activity are also separated.
GROWTH_MOMENTUM_RULES: dict[str, tuple[str, float, Callable[[list[float]], float | None]]] = {
    "us_unemployment": ("labor", .50, _negative_delta(3)),
    "us_claims": ("labor", .50, _negative_pct(13)),
    "us_payrolls": ("labor", .50, _payroll_impulse),
    "us_retail": ("activity", .50, lambda values: _annualized(values, 3)),
    "us_indpro": ("activity", .50, lambda values: _annualized(values, 3)),
    "us_gdp": ("activity", .50, _quarterly_annualized),
}
INFLATION_MOMENTUM_RULES: dict[str, tuple[str, float, Callable[[list[float]], float | None]]] = {
    "core_cpi": ("underlying", .50, lambda values: _annualized(values, 3)),
    "core_pce": ("underlying", .50, lambda values: _annualized(values, 3)),
    "cpi": ("supply", .25, lambda values: _annualized(values, 3)),
    "ppi": ("supply", .25, lambda values: _annualized(values, 3)),
    "wages": ("wages", 1.0, lambda values: _annualized(values, 3)),
}


def _robust_z(current: float, history: list[float]) -> float | None:
    window = history[-180:]
    if len(window) < 12:
        return None
    median = statistics.median(window)
    mad = statistics.median(abs(value - median) for value in window)
    scale = 1.4826 * mad
    if scale < 1e-9:
        scale = statistics.pstdev(window)
    if scale < 1e-9:
        return None
    return max(-3.0, min(3.0, (current - median) / scale))


def _metric_history(values: list[float], transform: Callable[[list[float]], float | None]) -> list[float]:
    result = []
    for end in range(2, len(values) + 1):
        transformed = transform(values[:end])
        if transformed is not None and math.isfinite(transformed):
            result.append(transformed)
    return result


def _rows_until(signal: dict[str, Any], cutoff: date | None) -> list[dict[str, Any]]:
    rows = signal.get("history", [])
    if cutoff is None:
        return rows
    return [row for row in rows if date.fromisoformat(row["date"]) <= cutoff
            and row.get("available_at") and date.fromisoformat(row["available_at"][:10]) <= cutoff]


def _momentum_axis(signals: dict[str, dict[str, Any]], rules: dict, cutoff: date | None) -> dict[str, Any]:
    by_cluster: dict[str, list[dict[str, Any]]] = {}
    total_clusters = len({rule[0] for rule in rules.values()})
    usable_indicators = 0
    fresh_clusters: set[str] = set()
    for key, (cluster, weight, transform) in rules.items():
        signal = signals.get(key)
        rows = _rows_until(signal, cutoff) if signal else []
        values = [float(row["value"]) for row in rows]
        transformed = transform(values)
        history = _metric_history(values, transform)
        z = _robust_z(transformed, history[:-1]) if transformed is not None else None
        if z is None or not rows:
            continue
        usable_indicators += 1
        latest = date.fromisoformat(rows[-1]["date"])
        fresh = cutoff is None or (cutoff - latest).days <= FRESHNESS_DAYS.get(signal.get("frequency", "monthly"), 95)
        if fresh:
            fresh_clusters.add(cluster)
        by_cluster.setdefault(cluster, []).append({
            "id": key, "name": signal.get("name", key), "cluster": cluster,
            "z": round(z, 3), "weighted_z": weight * z, "weight": weight,
            "latest_date": latest.isoformat(), "fresh": fresh,
        })
    if not by_cluster:
        return {"coordinate": None, "data_quality_score": 0, "data_quality_label": "판정 불가",
                "confidence": 0, "confidence_label": "판정 불가", "contributors": []}
    cluster_scores = {key: sum(row["weighted_z"] for row in rows) / sum(row["weight"] for row in rows)
                      for key, rows in by_cluster.items()}
    composite = sum(cluster_scores.values()) / len(cluster_scores)
    coordinate = round(100 * math.tanh(composite / 2), 1)
    agreement = sum((score > 0) == (composite > 0) for score in cluster_scores.values()) / len(cluster_scores)
    coverage = usable_indicators / len(rules)
    freshness = len(fresh_clusters) / len(by_cluster)
    quality = round(100 * (.55 * coverage + .30 * freshness + .15 * agreement))
    if coverage < .5:
        quality = min(quality, 39)
    label = "높음" if quality >= 80 else "보통" if quality >= 60 else "낮음" if quality >= 40 else "판정 불가"
    contributors = sorted((row for rows in by_cluster.values() for row in rows),
                          key=lambda row: (-abs(row["weighted_z"]), row["id"]))[:4]
    for row in contributors:
        row["weighted_z"] = round(row["weighted_z"], 3)
    return {"coordinate": coordinate, "data_quality_score": quality, "data_quality_label": label,
            "coverage": round(coverage, 3), "contributors": contributors,
            # Compatibility aliases; UI labels these as data quality, never accuracy.
            "confidence": quality, "confidence_label": label}


def _last_values(signals: dict[str, dict[str, Any]], key: str) -> list[float]:
    return [float(row["value"]) for row in signals.get(key, {}).get("history", [])]


def _level_component(key: str, label: str, value: float | None, neutral: float, scale: float,
                     direction: int, weight: float) -> dict[str, Any] | None:
    if value is None:
        return None
    normalized = max(-2.0, min(2.0, direction * (value - neutral) / scale))
    return {"id": key, "name": label, "value": round(value, 3), "normalized": round(normalized, 3), "weight": weight}


def _level_axis(signals: dict[str, dict[str, Any]], kind: str) -> dict[str, Any]:
    components: list[dict[str, Any] | None]
    if kind == "growth":
        unemployment = _last_values(signals, "us_unemployment")
        claims = _last_values(signals, "us_claims")
        payrolls = _last_values(signals, "us_payrolls")
        components = [
            _level_component("us_unemployment", "실업률", unemployment[-1] if unemployment else None, 4.5, 1.0, -1, .30),
            _level_component("us_claims", "신규실업수당", claims[-1] if claims else None, 260000, 80000, -1, .20),
            _level_component("us_payrolls", "월간 고용 3개월 평균", _payroll_impulse(payrolls), 100, 150, 1, .20),
            _level_component("us_gdp", "실질 GDP 성장률", _quarterly_annualized(_last_values(signals, "us_gdp")), 1.5, 2.0, 1, .20),
            _level_component("us_indpro", "산업생산 YoY", _pct(_last_values(signals, "us_indpro"), 12), 0, 3.0, 1, .10),
        ]
    else:
        components = [
            _level_component("core_pce", "Core PCE YoY", _pct(_last_values(signals, "core_pce"), 12), 2.0, 1.5, 1, .35),
            _level_component("core_cpi", "Core CPI YoY", _pct(_last_values(signals, "core_cpi"), 12), 2.0, 1.5, 1, .30),
            _level_component("wages", "임금 YoY", _pct(_last_values(signals, "wages"), 12), 3.5, 1.5, 1, .20),
            _level_component("cpi", "CPI YoY", _pct(_last_values(signals, "cpi"), 12), 2.0, 2.0, 1, .10),
            _level_component("ppi", "PPI YoY", _pct(_last_values(signals, "ppi"), 12), 2.0, 4.0, 1, .05),
        ]
    usable = [item for item in components if item]
    if not usable:
        return {"score": None, "label": "판정 불가", "coverage": 0, "contributors": []}
    score = sum(item["normalized"] * item["weight"] for item in usable) / sum(item["weight"] for item in usable)
    coordinate = round(100 * math.tanh(score / 1.5), 1)
    if kind == "growth":
        label = "확장" if coordinate >= 20 else "완만한 확장" if coordinate >= 0 else "취약" if coordinate > -35 else "약함"
    else:
        label = "매우 높음" if coordinate >= 60 else "높음" if coordinate >= 25 else "다소 높음" if coordinate >= 0 else "목표 부근"
    usable.sort(key=lambda item: -abs(item["normalized"] * item["weight"]))
    return {"score": coordinate, "label": label, "coverage": round(len(usable) / len(components), 3), "contributors": usable[:4]}


def _financial_conditions(signals: dict[str, dict[str, Any]]) -> dict[str, Any]:
    def latest(key: str) -> float | None:
        values = _last_values(signals, key)
        return values[-1] if values else None
    core_pce_yoy = _pct(_last_values(signals, "core_pce"), 12)
    fed, tips, term, hy, ig, nfci = (latest(key) for key in ("fedfunds", "tips10y", "term_premium", "hy_oas", "ig_oas", "nfci"))
    real_policy = fed - core_pce_yoy if fed is not None and core_pce_yoy is not None else None
    policy_score = None if real_policy is None else round(max(-100, min(100, real_policy / 1.0 * 50)), 1)
    rates_score = None if tips is None else round(max(-100, min(100, (tips - 1.5) / 1.0 * 60 + ((term or .5) - .5) * 20)), 1)
    credit_parts = [value for value in (
        None if hy is None else (hy - 3.5) / 1.5,
        None if ig is None else (ig - 1.2) / .6,
        None if nfci is None else nfci / .5,
    ) if value is not None]
    credit_score = round(max(-100, min(100, sum(credit_parts) / len(credit_parts) * 50)), 1) if credit_parts else None
    def state(score: float | None) -> str:
        if score is None:
            return "판정 불가"
        return "매우 제한적" if score >= 65 else "제한적" if score >= 25 else "중립" if score >= -20 else "완화적"
    policy_label = ("판정 불가" if real_policy is None else "제한적" if real_policy >= 1
                    else "다소 제한적" if real_policy >= 0 else "완화적")
    return {
        "policy": {"score": policy_score, "label": policy_label, "fed_funds": fed,
                   "core_pce_yoy": round(core_pce_yoy, 2) if core_pce_yoy is not None else None, "real_policy_rate": round(real_policy, 2) if real_policy is not None else None},
        "long_rates": {"score": rates_score, "label": state(rates_score), "nominal_10y": latest("us10y"),
                       "real_10y": tips, "breakeven_10y": latest("bei10y"), "term_premium": term},
        "credit": {"score": credit_score, "label": state(credit_score), "hy_oas": hy, "ig_oas": ig, "nfci": nfci},
    }


def _quadrant_label(growth: float | None, inflation: float | None) -> str:
    if growth is None or inflation is None:
        return "판정 불가"
    if abs(growth) < 15 or abs(inflation) < 15:
        return "경계대"
    if growth > 0 and inflation < 0:
        return "골디락스 방향"
    if growth > 0 and inflation > 0:
        return "리플레이션·긴축 위험"
    if growth < 0 and inflation > 0:
        return "스태그플레이션 위험"
    return "디스인플레이션·성장 둔화"


def _environment_quadrant(growth: float | None, inflation: float | None) -> tuple[str, str]:
    """Classify the current *level*, independently from recent momentum.

    Names are deliberately descriptive rather than prescriptive: this output
    does not claim that a quadrant is good/bad or forecast the next regime.
    """
    if growth is None or inflation is None:
        return "unavailable", "판정 불가"
    growth_label = "성장 확장" if growth >= 20 else "완만한 확장" if growth >= 0 else "성장 취약"
    inflation_label = ("물가 매우 높음" if inflation >= 60 else "물가 높음" if inflation >= 25
                       else "물가 다소 높음" if inflation >= 0 else "물가 목표 부근")
    if growth >= 0 and inflation >= 0:
        return "firm_growth_elevated_inflation", f"{growth_label}·{inflation_label}"
    if growth < 0 <= inflation:
        return "soft_growth_elevated_inflation", f"{growth_label}·{inflation_label}"
    if growth < 0 and inflation < 0:
        return "soft_growth_near_target_inflation", f"{growth_label}·{inflation_label}"
    return "firm_growth_near_target_inflation", f"{growth_label}·{inflation_label}"


def _momentum_vector(growth: dict[str, Any], inflation: dict[str, Any]) -> dict[str, Any]:
    """Describe a bounded glyph direction, not an observed displacement.

    dx/dy retain the existing standardized momentum coordinates so consumers
    can determine direction.  ``strength_score`` is normalized only for glyph
    styling and must not be added to an absolute level coordinate.
    """
    dx, dy = growth.get("coordinate"), inflation.get("coordinate")
    if dx is None or dy is None:
        return {
            "dx": dx, "dy": dy, "direction": "판정 불가", "strength": "판정 불가",
            "strength_score": None, "semantics": "relative_recent_pressure",
            "is_displacement": False, "trajectory_available": False,
        }
    norm = math.hypot(dx, dy)
    strength_score = round(min(1.0, norm / (100 * math.sqrt(2))), 3)
    if norm < 15:
        direction = "방향 불명확"
        strength = "미약"
    else:
        horizontal = "성장 개선" if dx > 0 else "성장 둔화"
        vertical = "물가 재가속" if dy > 0 else "물가 완화"
        if abs(dx) >= abs(dy) * 2:
            direction = f"{horizontal} 중심"
        elif abs(dy) >= abs(dx) * 2:
            direction = f"{vertical} 중심"
        else:
            direction = f"{horizontal}·{vertical}"
        strength = "강함" if strength_score >= .45 else "보통"
    quality = min(growth.get("data_quality_score", 0), inflation.get("data_quality_score", 0))
    return {
        "dx": dx, "dy": dy, "direction": direction, "strength": strength,
        "strength_score": strength_score, "data_quality_score": quality,
        "semantics": "relative_recent_pressure", "is_displacement": False,
        "trajectory_available": False,
    }


def calculate_us_macro_quadrant(signal_list: list[dict[str, Any]]) -> dict[str, Any]:
    signals = {item["id"]: item for item in signal_list}
    relevant = set(GROWTH_MOMENTUM_RULES) | set(INFLATION_MOMENTUM_RULES)
    dates = [date.fromisoformat(row["date"]) for key, signal in signals.items() if key in relevant for row in signal.get("history", [])]
    if not dates:
        unavailable_vector = _momentum_vector({}, {})
        return {"version": QUADRANT_VERSION, "scope": "미국", "scope_status": "macro_only", "as_of_date": None,
                "points": [], "label": "판정 불가", "environment_quadrant": "unavailable",
                "environment_label": "판정 불가",
                "environment_point": {"growth": None, "inflation": None, "quadrant": "unavailable",
                                      "label": "판정 불가", "semantics": "absolute_macro_level"},
                "momentum_vector": unavailable_vector, "pressure_vector": unavailable_vector,
                "trajectory_status": "unavailable_until_pit_history"}
    latest = max(dates)
    growth = _momentum_axis(signals, GROWTH_MOMENTUM_RULES, None)
    inflation = _momentum_axis(signals, INFLATION_MOMENTUM_RULES, None)
    point = {"label": "현재", "as_of_date": latest.isoformat(), "growth": growth, "inflation": inflation,
             "quadrant": _quadrant_label(growth["coordinate"], inflation["coordinate"])}
    growth_level, inflation_level = _level_axis(signals, "growth"), _level_axis(signals, "inflation")
    environment_quadrant, environment_label = _environment_quadrant(
        growth_level["score"], inflation_level["score"]
    )
    environment_point = {
        "growth": growth_level["score"], "inflation": inflation_level["score"],
        "quadrant": environment_quadrant, "label": environment_label,
        "semantics": "absolute_macro_level",
    }
    pressure_vector = _momentum_vector(growth, inflation)
    return {
        "version": QUADRANT_VERSION, "scope": "미국", "scope_status": "macro_only", "as_of_date": latest.isoformat(),
        "points": [point], "label": point["quadrant"],
        "growth_level": growth_level, "inflation_level": inflation_level,
        "environment_quadrant": environment_quadrant, "environment_label": environment_label,
        "environment_point": environment_point,
        "momentum_vector": pressure_vector, "pressure_vector": pressure_vector,
        "financial_conditions": _financial_conditions(signals),
        "growth_motion": {"delta": None, "direction": "현재 모멘텀", "speed": "실시간 이력 축적 전"},
        "inflation_motion": {"delta": None, "direction": "현재 모멘텀", "speed": "실시간 이력 축적 전"},
        "history_basis": "발표시점 빈티지 이력 축적 전 — 미래정보 누수를 막기 위해 과거 궤적 숨김",
        "trajectory_status": "unavailable_until_pit_history",
    }
