"""Deterministic oil-price and supply-stress monitoring for the macro regime.

This module deliberately does not recommend an energy asset.  It separates a
market-price shock (WTI), uncertainty (OVX), and a physical confirmation proxy
(U.S. commercial crude inventories excluding the SPR) so a price move is not
mislabelled as a supply shortage on its own.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import settings
from app.services.regime_external import ExternalObservationRepository, utc_now


FEED_ID = "eia_oil_inventory"
DATASET = "petroleum_stocks_weekly"
INVENTORY_SERIES_ID = "us_crude_inventory_ex_spr"
EIA_SERIES_ID = "WCESTUS1"
EIA_DATA_URL = "https://api.eia.gov/v2/petroleum/stoc/wstk/data/"
ENERGY_RULE_VERSION = "2026-08-energy-v1"


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _history(signal: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not signal:
        return []
    rows: dict[str, float] = {}
    for item in signal.get("history") or []:
        value = _number(item.get("value"))
        if item.get("date") and value is not None:
            rows[str(item["date"])] = value
    return [{"date": key, "value": rows[key]} for key in sorted(rows)]


def _change(rows: list[dict[str, Any]], periods: int) -> float | None:
    if len(rows) <= periods:
        return None
    start, end = rows[-periods - 1]["value"], rows[-1]["value"]
    return (end / start - 1) * 100 if start else None


def _percentile(rows: list[dict[str, Any]], value: float | None) -> float | None:
    values = [float(item["value"]) for item in rows if item.get("value") is not None]
    if value is None or len(values) < 20:
        return None
    below_or_equal = sum(item <= value for item in values)
    return round(below_or_equal / len(values) * 100, 1)


def _fresh(observation_date: str | None, max_age_days: int) -> bool:
    if not observation_date:
        return False
    observed = datetime.fromisoformat(observation_date)
    if observed.tzinfo is None:
        observed = observed.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - observed).days <= max_age_days


def classify_energy_shock(
    *,
    wti: dict[str, Any] | None,
    ovx: dict[str, Any] | None,
    inventory: list[dict[str, Any]],
) -> dict[str, Any]:
    """Classify an energy shock without inferring causality from price alone."""

    wti_rows = _history(wti)
    ovx_rows = _history(ovx)
    inventory_rows = [
        {"date": str(item.get("observation_date") or item.get("date")), "value": value}
        for item in inventory
        if (value := _number(item.get("value"))) is not None
        and (item.get("observation_date") or item.get("date"))
    ]
    inventory_rows.sort(key=lambda item: item["date"])

    wti_value = _number((wti or {}).get("value"))
    ovx_value = _number((ovx or {}).get("value"))
    inventory_value = inventory_rows[-1]["value"] if inventory_rows else None
    wti_date = (wti or {}).get("observation_date")
    ovx_date = (ovx or {}).get("observation_date")
    inventory_date = inventory_rows[-1]["date"] if inventory_rows else None
    component_freshness = {
        "wti": _fresh(wti_date, 14),
        "ovx": _fresh(ovx_date, 14),
        "inventory": _fresh(inventory_date, 21),
    }
    available_count = sum(
        value is not None and component_freshness[key]
        for key, value in (
            ("wti", wti_value), ("ovx", ovx_value), ("inventory", inventory_value)
        )
    )

    wti_5d = _change(wti_rows, 5)
    wti_20d = _change(wti_rows, 20)
    wti_63d = _change(wti_rows, 63)
    # Display history is intentionally capped at 252 points, while the signal
    # already calculated its 252-observation return from the full cache.
    wti_12m = _number((wti or {}).get("change_12m"))
    if wti_12m is None:
        wti_12m = _change(wti_rows, 252)
    ovx_percentile = _percentile(ovx_rows[-252:], ovx_value)
    inventory_4w = _change(inventory_rows, 4)
    inventory_52w = _change(inventory_rows, 52)

    recent_price_impulse = (
        2 if (wti_5d is not None and wti_5d >= 10) or (wti_20d is not None and wti_20d >= 15)
        else 1 if (wti_5d is not None and wti_5d >= 5) or (wti_20d is not None and wti_20d >= 7.5)
        else 0
    )
    sustained_price_pressure = bool(wti_12m is not None and wti_12m >= 25)
    volatility_pressure = (
        2 if (ovx_value is not None and ovx_value >= 50) or (ovx_percentile is not None and ovx_percentile >= 90)
        else 1 if (ovx_value is not None and ovx_value >= 35) or (ovx_percentile is not None and ovx_percentile >= 75)
        else 0
    )
    physical_tightening = bool(
        (inventory_4w is not None and inventory_4w <= -3)
        or (inventory_52w is not None and inventory_52w <= -5)
    )
    inventory_build = bool(
        (inventory_4w is not None and inventory_4w >= 3)
        or (inventory_52w is not None and inventory_52w >= 5)
    )

    trigger: dict[str, Any] | None = None
    if available_count < 2 or wti_value is None:
        state = "판정 제한"
        tone = "neutral"
        severity = "none"
        reason = "WTI와 원유 변동성·상업용 재고 중 두 축 이상이 최신 상태여야 합니다."
    elif recent_price_impulse >= 2 and volatility_pressure >= 1 and physical_tightening:
        state = "공급충격 확인"
        tone = "negative"
        severity = "high"
        reason = "유가 급등과 높은 변동성, 상업용 원유재고 감소가 함께 확인됩니다."
        trigger = {
            "rule_id": "energy.supply_shock.confirmed",
            "rule_version": ENERGY_RULE_VERSION,
            "domain": "energy",
            "severity": "high",
            "direction": "worsening",
            "evidence_cluster": "energy_supply",
            "summary": reason,
            "evidence": {
                "wti_change_5d": wti_5d,
                "wti_change_20d": wti_20d,
                "ovx": ovx_value,
                "inventory_change_4w": inventory_4w,
                "inventory_change_52w": inventory_52w,
            },
        }
    elif (recent_price_impulse >= 1 or sustained_price_pressure) and volatility_pressure >= 1:
        state = "가격·변동성 경계"
        tone = "caution"
        severity = "medium"
        reason = (
            "유가와 원유 변동성은 부담을 가리키지만 미국 상업용 재고가 공급 부족을 확인하지 않습니다."
            if inventory_build
            else "유가와 원유 변동성이 높지만 상업용 재고 감소 확인은 부족합니다."
        )
        trigger = {
            "rule_id": "energy.price_volatility.watch",
            "rule_version": ENERGY_RULE_VERSION,
            "domain": "energy",
            "severity": "medium",
            "direction": "worsening",
            "evidence_cluster": "energy_supply",
            "summary": reason,
            "evidence": {
                "wti_change_5d": wti_5d,
                "wti_change_20d": wti_20d,
                "wti_change_12m": wti_12m,
                "ovx": ovx_value,
                "inventory_change_4w": inventory_4w,
                "inventory_change_52w": inventory_52w,
                "physical_confirmation": False,
            },
        }
    elif physical_tightening:
        state = "재고 감소 관찰"
        tone = "caution"
        severity = "medium"
        reason = "상업용 원유재고는 줄었지만 유가 급등·변동성 신호가 함께 확인되지 않았습니다."
    else:
        state = "추가 충격 없음"
        tone = "neutral"
        severity = "none"
        reason = "최근 가격·변동성·상업용 재고에서 새 공급충격 조합이 확인되지 않았습니다."

    dates = [item for item in (wti_date, ovx_date, inventory_date) if item]
    return {
        "state": state,
        "reason": reason,
        "tone": tone,
        "severity": severity,
        "role": "macro_early_warning",
        "asset_recommendation": False,
        "coverage": round(available_count / 3, 3),
        "as_of_date": max(dates) if dates else None,
        "methodology": (
            "WTI 5·20·63·252관측일 변화, OVX 절대수준·최근 1년 백분위, "
            "EIA 미국 상업용 원유재고(전략비축유 제외) 4·52주 변화를 분리 판정"
        ),
        "limitations": (
            "미국 재고는 글로벌 원유 수급의 일부이므로 가격과 변동성만으로 공급충격 원인을 확정하지 않습니다."
        ),
        "components": {
            "wti": {
                "value": wti_value, "observation_date": wti_date,
                "change_5d": wti_5d, "change_20d": wti_20d,
                "change_63d": wti_63d, "change_12m": wti_12m,
                "fresh": component_freshness["wti"],
            },
            "ovx": {
                "value": ovx_value, "observation_date": ovx_date,
                "percentile_1y": ovx_percentile,
                "fresh": component_freshness["ovx"],
            },
            "inventory": {
                "value": inventory_value, "unit": "thousand barrels",
                "observation_date": inventory_date,
                "change_4w": inventory_4w, "change_52w": inventory_52w,
                "physical_tightening": physical_tightening,
                "inventory_build": inventory_build,
                "fresh": component_freshness["inventory"],
            },
        },
        "trigger": trigger,
    }


class EnergyShockService:
    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        if not settings.eia_api_key:
            return {
                "status": "configuration_required", "saved": 0,
                "error": "EIA_API_KEY가 없습니다.",
            }
        if not force and not self.repo.is_due(FEED_ID, success_hours=18):
            return {"status": "cached", "saved": 0}
        attempted = utc_now()
        start = (date.today() - timedelta(days=800)).isoformat()
        params = [
            ("api_key", settings.eia_api_key),
            ("frequency", "weekly"),
            ("data[0]", "value"),
            ("facets[series][]", EIA_SERIES_ID),
            ("start", start),
            ("sort[0][column]", "period"),
            ("sort[0][direction]", "asc"),
            ("offset", "0"),
            ("length", "5000"),
        ]
        try:
            async with httpx.AsyncClient(timeout=45) as client:
                response = await client.get(EIA_DATA_URL, params=params)
                response.raise_for_status()
                rows = response.json().get("response", {}).get("data", [])
            observations = []
            for row in rows:
                value = _number(row.get("value"))
                if not row.get("period") or value is None:
                    continue
                observations.append({
                    "series_id": INVENTORY_SERIES_ID,
                    "observation_date": str(row["period"]),
                    "value": value,
                    "unit": "thousand barrels",
                    "source_url": EIA_DATA_URL,
                    "dimensions": {"eia_series_id": EIA_SERIES_ID, "scope": "excluding_spr"},
                })
            if len(observations) < 53:
                raise ValueError("EIA 상업용 원유재고의 52주 비교 이력이 부족합니다.")
            saved = self.repo.save_observations("eia", DATASET, observations)
            self.repo.save_status(
                FEED_ID, "eia", DATASET, attempted,
                success=True, item_count=saved,
            )
            return {"status": "success", "saved": saved}
        except Exception as exc:
            self.repo.save_status(
                FEED_ID, "eia", DATASET, attempted,
                success=False, error=f"{type(exc).__name__}: {exc}",
            )
            return {"status": "failed", "saved": 0, "error": str(exc)}

    def summary(self, signals: list[dict[str, Any]]) -> dict[str, Any]:
        signal_map = {item.get("id"): item for item in signals}
        return classify_energy_shock(
            wti=signal_map.get("market_wti"),
            ovx=signal_map.get("market_ovx"),
            inventory=self.repo.series(INVENTORY_SERIES_ID, limit=110),
        )

    def feed_health(self) -> dict[str, Any] | None:
        return self.repo.status(FEED_ID)
