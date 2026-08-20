"""Deterministic semiconductor and power thesis summaries."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean, median
from typing import Any

from app.services.regime_customs import (
    CustomsMemoryExportService,
    aggregate_customs_exports,
)
from app.services.regime_dart import DartSemiconductorService
from app.services.regime_eia import (
    AI_POWER_PROXY_REGIONS,
    EIA_860M_URL,
    EIA_DOC_URL,
    EIA_GRID_URL,
    PIPELINE_FEED_ID,
    RTO_REGIONS,
    EiaPowerService,
)
from app.services.regime_external import ExternalObservationRepository
from app.services.regime_grid import (
    LBNL_FEED_ID,
    PUDL_FEED_ID,
    GridInfrastructureService,
)
from app.services.regime_kosis import KOSIS_TABLE_URL, KosisSemiconductorService
from app.services.regime_memory import MemoryPriceService


def _prior_year_date(value: str) -> str:
    return f"{int(value[:4]) - 1}{value[4:]}"


def history_with_yoy(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_date = {point["date"]: float(point["value"]) for point in points}
    history = []
    for point in points:
        value = float(point["value"])
        prior = by_date.get(_prior_year_date(point["date"]))
        history.append({
            "date": point["date"], "value": value,
            "yoy": (value / prior - 1) * 100 if prior not in (None, 0) else None,
        })
    return history


def metric_summary(points: list[dict[str, Any]], *, unit: str) -> dict[str, Any]:
    history = history_with_yoy(points)
    latest = history[-1] if history else None
    recent_yoy = [item["yoy"] for item in history[-3:] if item["yoy"] is not None]
    mom = (
        (float(history[-1]["value"]) / float(history[-2]["value"]) - 1) * 100
        if len(history) >= 2 and history[-2]["value"] else None
    )
    sequential_3m = (
        (mean(float(item["value"]) for item in history[-3:])
         / mean(float(item["value"]) for item in history[-6:-3]) - 1) * 100
        if len(history) >= 6
        and mean(float(item["value"]) for item in history[-6:-3]) != 0 else None
    )
    return {
        "latest": latest["value"] if latest else None,
        "observation_date": latest["date"] if latest else None,
        "yoy": latest["yoy"] if latest else None,
        "yoy_3m_avg": mean(recent_yoy) if len(recent_yoy) == 3 else None,
        "mom": mom,
        "sequential_3m": sequential_3m,
        "unit": unit, "history": history,
    }


def _repo_points(repo: ExternalObservationRepository, series_id: str) -> list[dict[str, Any]]:
    return [
        {"date": row["observation_date"], "value": row["value"]}
        for row in repo.series(series_id)
    ]


def _period_change(points: list[dict[str, Any]], periods: int = 3) -> float | None:
    if len(points) <= periods or not points[-(periods + 1)]["value"]:
        return None
    return (
        float(points[-1]["value"]) / float(points[-(periods + 1)]["value"]) - 1
    ) * 100


def _percentile_rank(values: list[float], current: float | None) -> float | None:
    """Return a midpoint percentile only when a useful history exists."""
    if current is None or len(values) < 36:
        return None
    below = sum(value < current for value in values)
    equal = sum(value == current for value in values)
    return (below + equal * 0.5) / len(values) * 100


def build_kosis_supply_context(
    metrics: dict[str, dict[str, Any]],
    shipment_sa: list[dict[str, Any]],
    inventory_sa: list[dict[str, Any]],
) -> dict[str, Any]:
    """Describe broad finished-goods inventory without treating it as DRAM stock."""
    shipment_by_date = {
        point["date"]: float(point["value"])
        for point in shipment_sa
        if point.get("value") not in (None, 0)
    }
    ratio_history = [
        {
            "date": point["date"],
            "value": float(point["value"]) / shipment_by_date[point["date"]] * 100,
        }
        for point in inventory_sa
        if point.get("value") is not None and point["date"] in shipment_by_date
    ]
    inventory_values = [float(point["value"]) for point in inventory_sa]
    latest_inventory = inventory_values[-1] if inventory_values else None
    latest_ratio = ratio_history[-1]["value"] if ratio_history else None

    shipment_yoy = {
        item["date"]: item.get("yoy") for item in metrics["shipments"].get("history", [])
    }
    inventory_gap_history = [
        {
            "date": item["date"],
            "value": float(item["yoy"]) - float(shipment_yoy[item["date"]]),
        }
        for item in metrics["inventory"].get("history", [])
        if item.get("yoy") is not None and shipment_yoy.get(item["date"]) is not None
    ]
    return {
        "history_months": min(len(inventory_values), len(ratio_history)),
        "inventory_percentile": _percentile_rank(inventory_values, latest_inventory),
        "inventory_shipments_ratio": latest_ratio,
        "inventory_shipments_ratio_percentile": _percentile_rank(
            [float(point["value"]) for point in ratio_history], latest_ratio
        ),
        "inventory_change_3m": _period_change(inventory_sa),
        "inventory_shipments_ratio_change_3m": _period_change(ratio_history),
        "inventory_shipment_yoy_gap": inventory_gap_history[-1]["value"]
        if inventory_gap_history else None,
        "inventory_shipment_yoy_gap_last_two": [
            float(item["value"]) for item in inventory_gap_history[-2:]
        ],
        "ratio_history": ratio_history,
    }


def classify_kosis_supply(
    metrics: dict[str, dict[str, Any]], context: dict[str, Any] | None = None
) -> tuple[str, str]:
    production = metrics["production"]
    shipments = metrics["shipments"]
    inventory = metrics["inventory"]
    values = (production.get("yoy"), shipments.get("yoy"), inventory.get("yoy"))
    if any(value is None for value in values):
        return "판정 불가", "생산·출하·재고의 최신 전년동월 비교가 모두 필요합니다."
    production_yoy, shipment_yoy, inventory_yoy = (float(value) for value in values)
    context = context or {}
    inventory_gap = float(
        context.get("inventory_shipment_yoy_gap", inventory_yoy - shipment_yoy)
    )
    production_change = production.get("change_3m")
    shipment_change = shipments.get("change_3m")
    inventory_change = context.get("inventory_change_3m")
    ratio_change = context.get("inventory_shipments_ratio_change_3m")
    inventory_percentile = context.get("inventory_percentile")
    ratio_percentile = context.get("inventory_shipments_ratio_percentile")
    last_two_gaps = context.get("inventory_shipment_yoy_gap_last_two") or []

    elevated_inventory = (
        inventory_percentile is not None and ratio_percentile is not None
        and inventory_percentile >= 70 and ratio_percentile >= 70
    )
    persistent_accumulation = (
        len(last_two_gaps) == 2 and all(float(gap) >= 10 for gap in last_two_gaps)
    )
    ratio_is_rising = ratio_change is not None and float(ratio_change) >= 5
    if elevated_inventory and persistent_accumulation and (
        ratio_is_rising or inventory_gap >= 15
    ):
        return "재고 부담", (
            f"완제품 재고 수준은 {inventory_percentile:.0f}백분위, 재고/출하 비율은 "
            f"{ratio_percentile:.0f}백분위이며 재고 증가율이 출하를 2개월 연속 크게 웃돕니다."
        )
    low_absolute_level = (
        inventory_percentile is not None and ratio_percentile is not None
        and (inventory_percentile < 50 or ratio_percentile < 50)
    )
    if (
        inventory_change is not None and float(inventory_change) >= 8
        and inventory_gap < 10 and low_absolute_level
    ):
        return "재고 반등 관찰", (
            f"완제품 재고가 3개월간 {float(inventory_change):+.1f}% 반등했지만 "
            f"재고 수준은 {inventory_percentile:.0f}백분위, 재고/출하 비율은 "
            f"{ratio_percentile:.0f}백분위로 낮습니다."
        )
    if (
        production_yoy <= -5 and shipment_yoy <= -5
        or (
            production_change is not None and shipment_change is not None
            and production_yoy < 0 and shipment_yoy < 0
            and production_change <= -3 and shipment_change <= -3
        )
    ):
        return "생산·출하 둔화", "생산과 출하의 전년비 또는 계절조정 3개월 변화가 함께 둔화 조건입니다."
    momentum_supportive = (
        production_change is None or shipment_change is None
        or (production_change >= -3 and shipment_change >= -3)
    )
    ratio_not_elevated = ratio_percentile is None or ratio_percentile < 70
    if (
        production_yoy > 0 and shipment_yoy > 0 and inventory_gap <= 5
        and momentum_supportive and ratio_not_elevated
    ):
        return "수급 개선", "생산·출하 전년비가 증가하고 완제품 재고가 출하 대비 높지 않습니다."
    return "혼조", "광의 완제품 생산·출하·재고가 같은 방향을 가리키지 않습니다."


def classify_exports(metric: dict[str, Any]) -> tuple[str, str]:
    history = [item for item in metric["history"] if item.get("yoy") is not None]
    latest = metric.get("yoy")
    average = metric.get("yoy_3m_avg")
    if latest is None or average is None or len(history) < 3:
        return "판정 불가", "최신 3개월과 전년동월 수출 비교가 필요합니다."
    last_two = [float(item["yoy"]) for item in history[-2:]]
    if average >= 15 and all(value > 0 for value in last_two):
        return "수출 확장 강함", f"최근 3개월 평균 YoY가 {average:+.1f}%이고 2개월 연속 증가했습니다."
    if average > 0 and sum(float(item["yoy"]) > 0 for item in history[-3:]) >= 2:
        return "수출 증가", f"최근 3개월 평균 YoY가 {average:+.1f}%입니다."
    if average < 0 and all(value < 0 for value in last_two):
        return "수출 감소 지속", f"최근 3개월 평균 YoY가 {average:+.1f}%이고 2개월 연속 감소했습니다."
    if latest < 0:
        return "감속 관찰", f"최근월 YoY가 {latest:+.1f}%로 낮아졌지만 지속성 확인이 필요합니다."
    return "혼조", "월별 수출 방향이 엇갈립니다."


def _recent_yoy(metric: dict[str, Any], months: int = 2) -> list[float]:
    history = [
        float(item["yoy"])
        for item in metric.get("history", [])
        if item.get("yoy") is not None
    ]
    return history[-months:]


def classify_dram_export_decomposition(
    value_metric: dict[str, Any],
    weight_metric: dict[str, Any],
    unit_value_metric: dict[str, Any],
    mcp_metric: dict[str, Any] | None = None,
    module_metric: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Classify DRAM exports without treating customs weight as bit volume.

    DRAM-chip export value is the primary demand lane. MCP and DRAM-module
    exports provide independent downstream confirmation. Customs-declared net
    weight and USD/kg remain product-mix context and cannot create a negative
    conflict by themselves.
    """
    averages = {
        "value": value_metric.get("yoy_3m_avg"),
        "weight": weight_metric.get("yoy_3m_avg"),
        "unit_value": unit_value_metric.get("yoy_3m_avg"),
    }
    coverage = sum(value is not None for value in averages.values()) / len(averages)
    if coverage < 1:
        return {
            "state": "판정 불가",
            "reason": "DRAM 칩 수출액·신고중량·단위중량당 수출액의 최근 3개월 전년비가 모두 필요합니다.",
            "coverage": coverage,
            "driver": "unknown",
            "conflicts": [],
            "confirmations": [],
            "context": {},
        }

    value_yoy = float(averages["value"])
    weight_yoy = float(averages["weight"])
    unit_yoy = float(averages["unit_value"])
    value_persistent = len(_recent_yoy(value_metric)) == 2 and all(
        value > 0 for value in _recent_yoy(value_metric)
    )
    value_persistent_down = len(_recent_yoy(value_metric)) == 2 and all(
        value < 0 for value in _recent_yoy(value_metric)
    )
    unit_persistent_up = len(_recent_yoy(unit_value_metric)) == 2 and all(
        value > 0 for value in _recent_yoy(unit_value_metric)
    )
    unit_persistent_down = len(_recent_yoy(unit_value_metric)) == 2 and all(
        value < 0 for value in _recent_yoy(unit_value_metric)
    )
    value_expanding = value_yoy >= 15 and value_persistent
    unit_expanding = unit_yoy >= 15 and unit_persistent_up
    unit_contracting = unit_yoy <= -10 and unit_persistent_down
    recent_sequential = value_metric.get("sequential_3m")
    recent_weak = recent_sequential is not None and float(recent_sequential) <= -10

    def downstream_state(metric: dict[str, Any] | None) -> tuple[bool, bool]:
        if not metric or metric.get("yoy_3m_avg") is None:
            return False, False
        recent = _recent_yoy(metric)
        average = float(metric["yoy_3m_avg"])
        return (
            average >= 15 and len(recent) == 2 and all(value > 0 for value in recent),
            average <= -10 and len(recent) == 2 and all(value < 0 for value in recent),
        )

    mcp_positive, mcp_negative = downstream_state(mcp_metric)
    module_positive, module_negative = downstream_state(module_metric)
    downstream_positive = mcp_positive or module_positive
    downstream_negative = mcp_negative or module_negative
    confirmations: list[str] = []
    if mcp_positive:
        confirmations.append("MCP 수출액 증가")
    if module_positive:
        confirmations.append("DRAM 모듈 수출액 증가")
    conflicts: list[str] = []
    if value_expanding and mcp_negative:
        conflicts.append("MCP 수출액 감소")
    if value_expanding and module_negative:
        conflicts.append("DRAM 모듈 수출액 감소")

    if value_expanding and unit_expanding and downstream_positive:
        state, driver = "단가·믹스 주도 확장", "unit_value_mix"
    elif value_expanding and unit_expanding:
        state, driver = "단가·믹스 주도 확장", "unit_value_mix"
    elif value_expanding and downstream_positive:
        state, driver = "수출액·후공정 동반 확장", "value_and_downstream"
    elif value_expanding:
        state, driver = "수출액 확장", "export_value"
    elif value_yoy < 0 and value_persistent_down and recent_weak and (
        unit_contracting or downstream_negative
    ):
        state, driver = "수출 약화", "contraction"
    else:
        state, driver = "혼조", "mixed"
    mcp_yoy = mcp_metric.get("yoy_3m_avg") if mcp_metric else None
    module_yoy = module_metric.get("yoy_3m_avg") if module_metric else None
    return {
        "state": state,
        "reason": (
            f"DRAM 칩 수출액 3개월 평균 YoY {value_yoy:+.1f}%, "
            f"최근 3개월 평균은 직전 3개월 대비 "
            f"{float(recent_sequential):+.1f}%이며, 단위중량당 수출액은 "
            f"YoY {unit_yoy:+.1f}%입니다."
            if recent_sequential is not None else
            f"DRAM 칩 수출액 3개월 평균 YoY {value_yoy:+.1f}%, "
            f"단위중량당 수출액은 YoY {unit_yoy:+.1f}%입니다."
        ),
        "coverage": coverage,
        "driver": driver,
        "conflicts": conflicts,
        "confirmations": confirmations,
        "context": {
            "declared_weight_yoy_3m_avg": weight_yoy,
            "declared_weight_role": "declared_packaging_mass_context",
            "mcp_export_yoy_3m_avg": mcp_yoy,
            "dram_module_export_yoy_3m_avg": module_yoy,
            "export_value_mom": value_metric.get("mom"),
            "export_value_sequential_3m": recent_sequential,
        },
    }


def build_supplier_inventory_efficiency(companies: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a seasonally comparable inventory-to-quarterly-revenue proxy.

    SK hynix is the primary observation because its consolidated figures are
    substantially more memory-pure.  Samsung remains visible as context only.
    Falling ratios mean revenue is absorbing inventory faster; they do not mean
    absolute inventory necessarily declined.
    """
    observations: list[dict[str, Any]] = []
    for company in companies:
        histories = company.get("histories") or {}
        revenue = {
            item["period"]: float(item["value"])
            for item in histories.get("revenue", [])
            if item.get("value") not in (None, 0)
        }
        inventory = {
            item["period"]: float(item["value"])
            for item in histories.get("inventory", [])
            if item.get("value") is not None
        }
        ratio_history = [
            {
                "period": period,
                "value": inventory[period] / revenue[period] * 100,
            }
            for period in sorted(set(revenue) & set(inventory))
        ]
        latest = ratio_history[-1] if ratio_history else None
        prior_period = (
            f"{int(latest['period'][:4]) - 1}{latest['period'][4:]}"
            if latest else None
        )
        prior = next(
            (item for item in ratio_history if item["period"] == prior_period), None
        )
        ratio_change_yoy = (
            (float(latest["value"]) / float(prior["value"]) - 1) * 100
            if latest and prior and prior.get("value") else None
        )
        ratio_change_pp = (
            float(latest["value"]) - float(prior["value"])
            if latest and prior else None
        )
        revenue_yoy = company.get("revenue_yoy")
        inventory_yoy = company.get("inventory_yoy")
        usable = (
            ratio_change_yoy is not None
            and revenue_yoy is not None
            and inventory_yoy is not None
            and latest is not None
            and latest.get("period") == company.get("latest_period")
            and not company.get("is_stale")
        )
        if not usable:
            state = "판정 불가"
        elif ratio_change_yoy <= -20 and float(revenue_yoy) >= 10:
            state = "상대 재고부담 크게 완화"
        elif ratio_change_yoy <= -5 and float(revenue_yoy) > 0:
            state = "상대 재고부담 완화"
        elif (
            ratio_change_yoy >= 20
            and float(inventory_yoy) >= float(revenue_yoy) + 10
        ):
            state = "상대 재고부담 크게 확대"
        elif ratio_change_yoy >= 10:
            state = "상대 재고부담 확대"
        else:
            state = "안정"
        observations.append({
            "id": company.get("id"),
            "name": company.get("name"),
            "state": state,
            "period": latest.get("period") if latest else None,
            "inventory_to_revenue": latest.get("value") if latest else None,
            "prior_inventory_to_revenue": prior.get("value") if prior else None,
            "ratio_change_yoy": ratio_change_yoy,
            "ratio_change_pp": ratio_change_pp,
            "revenue_yoy": revenue_yoy,
            "inventory_yoy": inventory_yoy,
            "is_stale": bool(company.get("is_stale", True)),
            "history": ratio_history,
        })

    primary = next((item for item in observations if item["id"] == "sk_hynix"), None)
    usable_count = sum(item["state"] != "판정 불가" for item in observations)
    coverage = usable_count / len(observations) if observations else 0
    if not primary or primary["state"] == "판정 불가":
        return {
            "state": "판정 제한",
            "reason": "SK하이닉스의 최신·전년동기 매출과 재고 공시가 필요합니다.",
            "coverage": coverage,
            "primary_company": "sk_hynix",
            "companies": observations,
        }
    direction = "낮아졌고" if float(primary["ratio_change_pp"]) < 0 else "높아졌고"
    return {
        "state": primary["state"],
        "reason": (
            f"SK하이닉스 분기 매출 대비 재고가 {primary['inventory_to_revenue']:.1f}%로 "
            f"전년동기보다 {abs(float(primary['ratio_change_pp'])):.1f}%p {direction} "
            f"비율 YoY는 {float(primary['ratio_change_yoy']):+.1f}%입니다."
        ),
        "coverage": coverage,
        "primary_company": "sk_hynix",
        "companies": observations,
    }


def build_server_rdimm_proxy(memory_cycle: dict[str, Any]) -> dict[str, Any]:
    item = next(
        (
            row for row in memory_cycle.get("series", [])
            if row.get("series_id") == "dram_module_spot_ddr5_rdimm_32gb"
        ),
        None,
    )
    if not item or item.get("change_percent") is None or item.get("is_stale"):
        return {
            "state": "판정 제한",
            "reason": "유효기간 안의 공개 DDR5 RDIMM 가격 표본이 필요합니다.",
            "observation_date": item.get("observation_date") if item else None,
            "price": item.get("price_average") if item else None,
            "change_percent": item.get("change_percent") if item else None,
            "is_stale": bool(item.get("is_stale", True)) if item else True,
        }
    change = float(item["change_percent"])
    if change >= 3:
        state = "가격 급등"
    elif change >= 1:
        state = "가격 상승"
    elif change <= -3:
        state = "가격 급락"
    elif change <= -1:
        state = "가격 하락"
    else:
        state = "보합"
    return {
        "state": state,
        "reason": f"공개 DDR5 RDIMM 모듈 평균가격의 최근 표기 변화율은 {change:+.2f}%입니다.",
        "observation_date": item.get("observation_date"),
        "price": item.get("price_average"),
        "change_percent": change,
        "is_stale": False,
    }


def classify_hbm_server_proxy(
    rdimm: dict[str, Any],
    export_decomposition: dict[str, Any],
    supplier_inventory: dict[str, Any],
) -> dict[str, Any]:
    """Classify an HBM/server-memory proxy without claiming direct HBM data."""
    unavailable = {"판정 불가", "판정 제한"}
    classification_states = (
        rdimm.get("state", "판정 제한"),
        export_decomposition.get("state", "판정 불가"),
    )
    coverage = sum(state not in unavailable for state in classification_states) / 2
    rdimm_positive = rdimm.get("state") in {"가격 급등", "가격 상승"}
    rdimm_negative = rdimm.get("state") in {"가격 급락", "가격 하락"}
    export_positive = export_decomposition.get("state") in {
        "단가·믹스 주도 확장", "수출액·후공정 동반 확장", "수출액 확장",
    }
    export_negative = export_decomposition.get("state") in {
        "수출 약화",
    }
    supplier_negative = supplier_inventory.get("state") in {
        "상대 재고부담 크게 확대", "상대 재고부담 확대",
    }
    conflicts = list(export_decomposition.get("conflicts") or [])
    if supplier_negative:
        conflicts.append("SK하이닉스 매출 대비 재고비율 악화")

    if rdimm.get("state") in unavailable:
        state = "판정 제한"
        reason = "서버용 RDIMM 가격 표본이 오래됐거나 없어 수출·공시만으로 HBM 병목을 확정하지 않습니다."
    elif rdimm_positive and export_positive:
        state = "타이트 지속 신호"
        reason = "서버용 RDIMM 가격 상승과 DRAM 칩·MCP·모듈 수출 강세가 서로 다른 자료에서 함께 확인됩니다."
    elif rdimm_positive:
        state = "타이트 관찰"
        reason = "서버용 RDIMM 가격은 상승했지만 DRAM 수출 구조의 동반 확인은 충분하지 않습니다."
    elif rdimm_negative and export_negative:
        state = "병목 완화 경계"
        reason = "서버용 RDIMM 가격과 DRAM 수출 구조가 함께 약화 방향입니다."
    elif rdimm_negative:
        state = "완화 관찰"
        reason = "서버용 RDIMM 가격은 하락했지만 DRAM 수출 구조의 동반 약화는 확인되지 않았습니다."
    elif export_positive:
        state = "수요 강세·서버 가격 대기"
        reason = "DRAM 수출 구조는 강하지만 서버용 RDIMM 가격은 상승 조건이 아닙니다."
    else:
        state = "혼조"
        reason = "서버용 RDIMM·수출 단가와 물량·공급사 재고 효율의 방향이 엇갈립니다."
    return {
        "state": state,
        "reason": reason,
        "coverage": coverage,
        "confidence": "부분",
        "direct_hbm_data": False,
        "conflicts": conflicts,
        "components": {
            "server_rdimm": rdimm,
            "export_decomposition": export_decomposition,
            "supplier_inventory": supplier_inventory,
        },
        "methodology": "서버용 DDR5 RDIMM 공개가격과 한국 DRAM 칩 수출액을 판정축으로 사용하고 MCP·DRAM 모듈 수출을 확인축으로 둠. 신고중량과 공급사 매출 대비 재고는 맥락이라 점수에 중복 반영하지 않음",
        "limitations": "HBM 계약가격·공급충족률·bit 출하량을 직접 수집하지 않으며 신고중량은 bit 출하량이 아니고 단위중량당 금액에는 제품 믹스 변화가 포함됨",
    }


def classify_dram_bottleneck(
    price_state: str,
    export_state: str,
    supply_state: str,
    company_state: str,
    hbm_server_state: str | None = None,
) -> tuple[str, str, float, list[str]]:
    """Use DRAM pricing as the primary proxy and broad inventory as context.

    Public DDR5 pricing is more direct than the C261 finished-goods index, but
    it is not HBM or server DRAM.  Exports and company filings therefore
    confirm the direction; the broad KOSIS lane can only create a conflict,
    never overturn the primary lane on its own.
    """
    unavailable = {"판정 불가", "판정 제한"}
    confirmation_state = hbm_server_state or export_state
    states = (price_state, confirmation_state, supply_state, company_state)
    coverage = sum(state not in unavailable for state in states) / len(states)
    price_positive = price_state in {"가격 확장", "가격 상승"}
    price_negative = price_state == "하락 관찰"
    export_positive = export_state in {"수출 확장 강함", "수출 증가"}
    export_negative = export_state == "수출 감소 지속"
    company_positive = company_state == "확장 확인"
    company_negative = company_state in {"실적 둔화", "재고 부담"}
    hbm_positive = hbm_server_state in {
        "타이트 지속 신호", "타이트 관찰", "수요 강세·서버 가격 대기",
    }
    hbm_negative = hbm_server_state in {"병목 완화 경계", "완화 관찰"}
    conflicts: list[str] = []
    if supply_state in {"재고 부담", "생산·출하 둔화"}:
        conflicts.append(f"한국 반도체 완제품 {supply_state}")
    if export_negative:
        conflicts.append("DRAM 수출 감소 지속")
    if company_negative:
        conflicts.append(f"국내 기업 {company_state}")
    if hbm_negative:
        conflicts.append(f"HBM·서버 DRAM 간접계측 {hbm_server_state}")

    if price_state in unavailable:
        return (
            "판정 제한",
            "주 판정축인 공개 DDR5 계약가격을 확인하지 못해 보조지표만으로 DRAM 수급을 확정하지 않습니다.",
            coverage,
            conflicts,
        )
    if price_positive:
        confirmations = []
        if hbm_positive:
            confirmations.append("HBM·서버 DRAM 간접계측 강세")
        else:
            if export_positive:
                confirmations.append("DRAM 수출 증가")
            if company_positive:
                confirmations.append("국내 기업 실적 확장")
        if confirmations:
            return (
                "타이트 신호",
                f"공개 DDR5 가격이 상승하고 {'·'.join(confirmations)} 신호가 함께 확인됩니다.",
                coverage,
                conflicts,
            )
        if hbm_negative or (export_negative and company_negative):
            return (
                "가격 강세·수요 경계",
                "공개 DDR5 가격은 상승하지만 HBM·서버 메모리 확인축이 약해 후행 가격일 가능성을 경계합니다.",
                coverage,
                conflicts,
            )
        return (
            "가격 상승 확인",
            "공개 DDR5 가격은 상승했지만 수출 또는 기업 확인이 충분하지 않습니다.",
            coverage,
            conflicts,
        )
    if price_negative:
        if export_negative or company_negative:
            return (
                "병목 완화 경계",
                "공개 DDR5 가격 하락과 수요 또는 기업 약화가 함께 확인됩니다.",
                coverage,
                conflicts,
            )
        return (
            "가격 하락 관찰",
            "공개 DDR5 가격이 하락했지만 수요와 기업 축의 동반 약화는 아직 확인되지 않았습니다.",
            coverage,
            conflicts,
        )
    if export_positive and company_positive:
        return (
            "수요 강세·가격 대기",
            "DRAM 수출과 국내 기업 실적은 확장 방향이나 공개 DDR5 가격 확인이 더 필요합니다.",
            coverage,
            conflicts,
        )
    if export_negative and company_negative:
        return (
            "수급 약화 경계",
            "DRAM 수출과 국내 기업 실적이 함께 약화 방향입니다.",
            coverage,
            conflicts,
        )
    return "혼조", "DRAM 가격·수출·기업 확인의 방향이 엇갈립니다.", coverage, conflicts


def classify_semiconductor_cycle(
    dram_state: str, supply_state: str, company_state: str, coverage: float
) -> tuple[str, str]:
    """Let the DRAM lane lead while requiring two corroborative negatives to veto it."""
    if coverage < 0.5 or dram_state == "판정 제한":
        return "판정 불가", "DRAM 주 판정축과 보조 확인자료가 충분하지 않습니다."
    dram_positive = dram_state in {
        "타이트 신호", "가격 상승 확인", "수요 강세·가격 대기",
    }
    dram_negative = dram_state in {
        "병목 완화 경계", "가격 하락 관찰", "수급 약화 경계",
    }
    corroborative_negative = sum((
        supply_state in {"재고 부담", "생산·출하 둔화"},
        company_state in {"실적 둔화", "재고 부담"},
    ))
    if dram_positive:
        if corroborative_negative >= 2:
            return "경계", "DRAM 주축은 강하지만 완제품 재고와 기업 실적이 함께 악화 방향입니다."
        return "확장 확인", "DRAM 주축이 확장 방향이며 두 보조축의 동시 악화는 확인되지 않았습니다."
    if dram_negative:
        if corroborative_negative >= 1 or dram_state in {"병목 완화 경계", "수급 약화 경계"}:
            return "경계", "DRAM 주축 약화와 하나 이상의 보조 악화가 확인됩니다."
        return "감속 관찰", "DRAM 가격 약화가 시작됐지만 광의 재고와 기업 실적의 동반 악화는 아직 없습니다."
    if corroborative_negative >= 2:
        return "경계", "DRAM 주축은 혼조이고 완제품 재고와 기업 실적이 함께 악화 방향입니다."
    return "혼조", "DRAM 주축의 방향이 아직 확정되지 않았습니다."


def classify_power_demand(total: dict[str, Any], commercial: dict[str, Any]) -> tuple[str, str]:
    total_yoy = total.get("yoy_3m_avg")
    commercial_yoy = commercial.get("yoy_3m_avg")
    if total_yoy is None or commercial_yoy is None:
        return "판정 불가", "총판매와 상업용 판매의 3개월 평균 YoY가 필요합니다."
    if total_yoy >= 3 and commercial_yoy >= 3:
        return "수요 확장", f"총판매 {total_yoy:+.1f}%, 상업용 {commercial_yoy:+.1f}%로 함께 증가했습니다."
    if total_yoy < 0 and commercial_yoy < 0:
        return "수요 둔화", f"총판매 {total_yoy:+.1f}%, 상업용 {commercial_yoy:+.1f}%로 함께 감소했습니다."
    if commercial_yoy > 0 and commercial_yoy - total_yoy >= 2:
        return "상업용 수요 우세", f"상업용 판매 증가율이 전체보다 {commercial_yoy - total_yoy:.1f}%p 높습니다."
    return "완만한 변화", "총수요와 상업용 수요가 강한 확장 또는 동반 둔화 조건에 해당하지 않습니다."


def aligned_daily_yoy(
    points: list[dict[str, Any]],
    *,
    window_days: int,
    prior_offset_days: int = 364,
    minimum_coverage: float = 0.8,
) -> dict[str, Any]:
    """Compare aligned weekday windows while tolerating sparse EIA-930 corrections."""
    values: dict[date, float] = {}
    for point in points:
        try:
            values[date.fromisoformat(point["date"])] = float(point["value"])
        except (KeyError, TypeError, ValueError):
            continue
    if not values:
        return {"value": None, "sample_days": 0, "from": None, "to": None}
    end = max(values)
    pairs = [
        (end - timedelta(days=offset), end - timedelta(days=offset + prior_offset_days))
        for offset in range(window_days)
    ]
    pairs = [pair for pair in pairs if pair[0] in values and pair[1] in values]
    if len(pairs) < window_days * minimum_coverage:
        return {"value": None, "sample_days": len(pairs), "from": None, "to": end.isoformat()}
    prior = sum(values[old] for _, old in pairs)
    current = sum(values[new] for new, _ in pairs)
    return {
        "value": (current / prior - 1) * 100 if prior else None,
        "sample_days": len(pairs),
        "from": min(new for new, _ in pairs).isoformat(),
        "to": max(new for new, _ in pairs).isoformat(),
    }


def aggregate_daily_series(
    series: Iterable[list[dict[str, Any]]],
    *,
    expected_series_count: int | None = None,
) -> list[dict[str, Any]]:
    """Sum dates shared by every expected constituent region.

    A missing region must not silently shrink a fixed geographic basket.  That
    would make, for example, five available AI proxy regions look like the
    intended six-region aggregate.
    """
    mappings: list[dict[str, float]] = []
    for points in series:
        mapping = {
            str(point["date"]): float(point["value"])
            for point in points if point.get("date") and point.get("value") is not None
        }
        if mapping:
            mappings.append(mapping)
    if not mappings or (
        expected_series_count is not None and len(mappings) != expected_series_count
    ):
        return []
    common_dates = set(mappings[0])
    for mapping in mappings[1:]:
        common_dates &= set(mapping)
    return [
        {"date": observed, "value": sum(mapping[observed] for mapping in mappings)}
        for observed in sorted(common_dates)
    ]


def rolling_power_yoy_history(
    national: list[dict[str, Any]],
    ai_regions: list[dict[str, Any]],
    *,
    window_days: int = 28,
    prior_offset_days: int = 364,
    limit: int = 180,
) -> list[dict[str, Any]]:
    """Build rolling weekday-aligned YoY history for both demand lanes."""

    def rolling(points: list[dict[str, Any]]) -> dict[str, float]:
        values = dict(
            (date.fromisoformat(point["date"]), float(point["value"]))
            for point in points if point.get("date") and point.get("value") is not None
        )
        result: dict[str, float] = {}
        for end in sorted(values):
            pairs = [
                (end - timedelta(days=offset), end - timedelta(days=offset + prior_offset_days))
                for offset in range(window_days)
            ]
            pairs = [pair for pair in pairs if pair[0] in values and pair[1] in values]
            if len(pairs) < window_days * 0.8:
                continue
            prior = sum(values[old] for _, old in pairs)
            current = sum(values[new] for new, _ in pairs)
            if prior:
                result[end.isoformat()] = (current / prior - 1) * 100
        return result

    national_rolling = rolling(national)
    ai_rolling = rolling(ai_regions)
    dates = sorted(set(national_rolling) & set(ai_rolling))[-limit:]
    return [
        {
            "date": observed,
            "national": national_rolling[observed],
            "ai_regions": ai_rolling[observed],
        }
        for observed in dates
    ]


def classify_power_demand_axis(
    *,
    national_yoy_84d: float | None,
    ai_regions_yoy_84d: float | None,
    commercial_yoy_3m: float | None,
    regional_expansion_share: float | None,
    ai_regions_acceleration_pp: float | None,
    ai_excess_growth_pp: float | None = None,
    region_coverage: float = 1.0,
) -> tuple[str, str, int, float]:
    """Use primary and confirming lanes instead of correlated vote counting."""
    required = [national_yoy_84d, ai_regions_yoy_84d]
    optional = [commercial_yoy_3m, regional_expansion_share, ai_regions_acceleration_pp]
    coverage = (
        (sum(value is not None for value in required) + sum(value is not None for value in optional))
        / (len(required) + len(optional))
    ) * min(max(region_coverage, 0.0), 1.0)
    if any(value is None for value in required) or region_coverage < 1:
        return (
            "자료 부족",
            "미국 전체 또는 고정된 AI 관찰지역 바스켓의 일간 수요가 빠져 방향을 판정하지 않습니다.",
            0,
            coverage,
        )

    national = float(national_yoy_84d)
    ai_growth = float(ai_regions_yoy_84d)
    ai_excess = ai_excess_growth_pp
    if ai_excess is None:
        # Compatibility for callers that do not yet provide the non-AI basket.
        ai_excess = ai_growth - national

    if national <= -1 and (
        regional_expansion_share is None or regional_expansion_share <= 0.4
    ):
        state, score = "전력 수요 감소", -2
    elif ai_growth >= 2 and ai_excess >= 1:
        state, score = "AI 관찰지역 중심 확대", 2
    elif national >= 2:
        state, score = "전력 수요 빠르게 확대", 2
    elif national >= 0.75:
        state, score = "전력 수요 확대", 1
    else:
        state, score = "방향 엇갈림", 0
    values = []
    if national_yoy_84d is not None:
        values.append(f"미국 84일 {national_yoy_84d:+.1f}%")
    if ai_regions_yoy_84d is not None:
        values.append(f"AI 인프라 관찰지역 84일 {ai_regions_yoy_84d:+.1f}%")
    values.append(f"비AI 지역 대비 {ai_excess:+.1f}%p")
    if commercial_yoy_3m is not None:
        values.append(f"상업용 월간 {commercial_yoy_3m:+.1f}%")
    if regional_expansion_share is not None:
        values.append(f"지역 확산 {regional_expansion_share * 100:.0f}%")
    return state, " · ".join(values), score, coverage


def window_grid_operations(
    demand: list[dict[str, Any]],
    forecast: list[dict[str, Any]],
    generation: list[dict[str, Any]],
    interchange: list[dict[str, Any]],
    *,
    window_days: int = 28,
    minimum_coverage: float = 0.8,
) -> dict[str, Any]:
    """Calculate matched EIA-930 operating-pressure proxies.

    EIA defines negative total interchange as net inflow.  Both interchange and
    forecast error are context signals—not direct measures of reserve margin or
    a transmission bottleneck.
    """

    def mapping(points: list[dict[str, Any]]) -> dict[str, float]:
        result: dict[str, float] = {}
        for point in points:
            try:
                result[str(point["date"])] = float(point["value"])
            except (KeyError, TypeError, ValueError):
                continue
        return result

    lanes = [mapping(points) for points in (demand, forecast, generation, interchange)]
    empty = {
        "observation_date": None, "sample_days": 0, "coverage": 0.0,
        "forecast_surprise_pct": None, "forecast_abs_error_pct": None,
        "generation_coverage_pct": None, "net_import_share_pct": None,
    }
    if any(not lane for lane in lanes):
        return empty
    common = set(lanes[0])
    for lane in lanes[1:]:
        common &= set(lane)
    selected = sorted(common)[-window_days:]
    coverage = len(selected) / window_days
    if coverage < minimum_coverage:
        return {
            **empty,
            "observation_date": selected[-1] if selected else None,
            "sample_days": len(selected),
            "coverage": coverage,
        }
    demand_sum = sum(lanes[0][day] for day in selected)
    forecast_sum = sum(lanes[1][day] for day in selected)
    generation_sum = sum(lanes[2][day] for day in selected)
    interchange_sum = sum(lanes[3][day] for day in selected)
    abs_errors = [
        abs(lanes[0][day] - lanes[1][day]) / lanes[1][day] * 100
        for day in selected if lanes[1][day]
    ]
    return {
        "observation_date": selected[-1],
        "sample_days": len(selected),
        "coverage": coverage,
        "forecast_surprise_pct": (
            (demand_sum - forecast_sum) / forecast_sum * 100 if forecast_sum else None
        ),
        "forecast_abs_error_pct": median(abs_errors) if abs_errors else None,
        "generation_coverage_pct": generation_sum / demand_sum * 100 if demand_sum else None,
        "net_import_share_pct": max(0.0, -interchange_sum) / demand_sum * 100 if demand_sum else None,
    }


def classify_grid_operations_axis(
    *,
    load_yoy_28d: float | None,
    forecast_surprise_pct: float | None,
    forecast_abs_error_pct: float | None,
    net_import_share_pct: float | None,
    pressure_region_count: int | None,
    expected_region_count: int,
    coverage: float,
) -> tuple[str, str]:
    if (
        load_yoy_28d is None
        or forecast_surprise_pct is None
        or net_import_share_pct is None
        or pressure_region_count is None
        or coverage < 0.8
    ):
        return "자료 부족", "수요·익일예측·순발전·지역간 전력교환의 공통 28일 자료가 부족합니다."
    high_load = load_yoy_28d >= 3
    expanding_load = load_yoy_28d >= 2
    forecast_pressure = forecast_surprise_pct >= 1.5
    import_context = net_import_share_pct >= 5
    broad_pressure = pressure_region_count >= max(2, expected_region_count // 2)
    if high_load and forecast_pressure and (import_context or broad_pressure):
        state = "운영 부담 높음"
    elif (expanding_load and (forecast_pressure or import_context)) or broad_pressure:
        state = "부담 신호 관찰"
    else:
        state = "운영 여유"
    error_text = (
        f" · 절대오차 중앙값 {forecast_abs_error_pct:.1f}%"
        if forecast_abs_error_pct is not None else ""
    )
    return (
        state,
        f"AI 관찰지역 28일 수요 {load_yoy_28d:+.1f}% · 실제-익일예측 "
        f"{forecast_surprise_pct:+.1f}%{error_text} · 순유입 의존 {net_import_share_pct:.1f}% · "
        f"부담 관찰지역 {pressure_region_count}/{expected_region_count}",
    )


def rolling_grid_operations_history(
    demand: list[dict[str, Any]],
    forecast: list[dict[str, Any]],
    generation: list[dict[str, Any]],
    interchange: list[dict[str, Any]],
    *,
    window_days: int = 28,
    limit: int = 180,
) -> list[dict[str, Any]]:
    """Build a bounded history from the same matched-window formulas."""

    def mapping(points: list[dict[str, Any]]) -> dict[str, float]:
        return {
            str(point["date"]): float(point["value"])
            for point in points if point.get("date") and point.get("value") is not None
        }

    lanes = [mapping(points) for points in (demand, forecast, generation, interchange)]
    if any(not lane for lane in lanes):
        return []
    common = set(lanes[0])
    for lane in lanes[1:]:
        common &= set(lane)
    dates = sorted(common)
    history: list[dict[str, Any]] = []
    for index in range(window_days - 1, len(dates)):
        selected = dates[index - window_days + 1:index + 1]
        demand_sum = sum(lanes[0][day] for day in selected)
        forecast_sum = sum(lanes[1][day] for day in selected)
        generation_sum = sum(lanes[2][day] for day in selected)
        interchange_sum = sum(lanes[3][day] for day in selected)
        if not demand_sum or not forecast_sum:
            continue
        abs_errors = [
            abs(lanes[0][day] - lanes[1][day]) / lanes[1][day] * 100
            for day in selected if lanes[1][day]
        ]
        history.append({
            "date": selected[-1],
            "forecast_surprise_pct": (demand_sum - forecast_sum) / forecast_sum * 100,
            "forecast_abs_error_pct": median(abs_errors) if abs_errors else None,
            "generation_coverage_pct": generation_sum / demand_sum * 100,
            "net_import_share_pct": max(0.0, -interchange_sum) / demand_sum * 100,
        })
    return history[-limit:]


def classify_power_supply_axis(
    net_pipeline_ratio_24m: float | None,
    variable_storage_share: float | None,
) -> tuple[str, str]:
    if net_pipeline_ratio_24m is None:
        return "자료 부족", "월간 가동·건설·은퇴 설비 자료가 더 필요합니다."
    if net_pipeline_ratio_24m >= 6:
        state = "건설 확대"
    elif net_pipeline_ratio_24m >= 3:
        state = "건설 진행"
    elif net_pipeline_ratio_24m >= 0:
        state = "건설 미약"
    else:
        state = "지연·순감소"
    mix = (
        f" 태양광·풍력·배터리 비중은 {variable_storage_share:.0f}%로 명목 MW가 확정 공급력을 뜻하지 않습니다."
        if variable_storage_share is not None else ""
    )
    return state, f"향후 24개월 순확충은 현재 가동용량의 {net_pipeline_ratio_24m:.1f}%입니다.{mix}"


def classify_interconnection_axis(
    *,
    active_queue_gw: float | None,
    operating_capacity_gw: float | None,
    ia_executed_share_pct: float | None,
    median_active_age_years: float | None,
    ir_to_cod_median_years: float | None,
    usable: bool,
) -> tuple[str, str]:
    """Classify supply-side interconnection friction, never load connections."""
    required = [
        active_queue_gw, operating_capacity_gw, ia_executed_share_pct,
        median_active_age_years,
    ]
    if not usable or any(value is None for value in required):
        return "자료 부족", "발전·저장 접속 대기열의 규모·진행단계·대기기간 자료가 부족합니다."
    queue_ratio = float(active_queue_gw) / float(operating_capacity_gw) * 100
    friction_count = sum((
        float(ia_executed_share_pct) < 30,
        round(float(median_active_age_years), 1) >= 3,
        ir_to_cod_median_years is not None
        and round(float(ir_to_cod_median_years), 1) >= 5,
    ))
    if queue_ratio >= 100 and friction_count >= 2:
        state = "접속 대기 부담 높음"
    elif queue_ratio >= 60 and friction_count >= 1:
        state = "접속 대기 부담"
    else:
        state = "부담 완화"
    cod_text = (
        f" · 최근 접수→상업운전 {float(ir_to_cod_median_years):.1f}년"
        if ir_to_cod_median_years is not None else ""
    )
    return (
        state,
        f"활성 대기용량은 현재 가동용량의 {queue_ratio:.0f}% · 연결계약 체결 단계 "
        f"{float(ia_executed_share_pct):.1f}% · 활성 프로젝트 중앙 대기 "
        f"{float(median_active_age_years):.1f}년{cod_text}",
    )


def classify_transmission_investment_axis(
    *,
    additions_usd: float | None,
    like_for_like_cagr_pct: float | None,
    reporter_count: float | None,
    reporter_coverage_pct: float | None,
    usable: bool,
) -> tuple[str, str]:
    """Classify nominal FERC Form 1 transmission additions with a coverage gate."""
    if (
        not usable
        or additions_usd is None
        or like_for_like_cagr_pct is None
        or reporter_count is None
        or reporter_coverage_pct is None
    ):
        return "자료 부족", "송전설비 추가액과 동일 보고자 비교자료가 부족합니다."
    if reporter_count < 50 or reporter_coverage_pct < 85:
        return (
            "표본 제한",
            f"보고 사업자 {int(reporter_count)}곳 · 전년 보고자 연결률 {reporter_coverage_pct:.1f}%로 비교 표본이 불안정합니다.",
        )
    if like_for_like_cagr_pct >= 8:
        state = "송전 투자 확대"
    elif like_for_like_cagr_pct >= 0:
        state = "투자 유지"
    else:
        state = "투자 둔화"
    return (
        state,
        f"최근 명목 송전설비 추가액 ${additions_usd / 1_000_000_000:.1f}B · "
        f"동일 보고자 3년 CAGR {like_for_like_cagr_pct:+.1f}% · "
        f"보고 사업자 {int(reporter_count)}곳",
    )


def classify_power_investment_thesis(
    demand_state: str,
    supply_state: str | None = None,
    *,
    operations_state: str | None = None,
    interconnection_state: str | None = None,
    transmission_state: str | None = None,
) -> tuple[str, str]:
    """Pass independent evidence gates instead of summing correlated scores."""
    if demand_state in {"자료 부족", "판정 제한"}:
        return "판정 제한", "현재 전력수요 자료가 부족해 후속 인프라 투자 근거를 판정하지 않습니다."
    if demand_state in {"전력 수요 감소", "수요 둔화"}:
        return "전력 투자 근거 약화", "전력수요가 감소해 후속 전력 인프라 투자 근거가 약해졌습니다."

    demand_expanding = demand_state in {
        "전력 수요 빠르게 확대", "전력 수요 확대", "AI 관찰지역 중심 확대",
        "광범위한 수요 가속", "수요 확장",
    }
    grid_pressure = operations_state in {"부담 신호 관찰", "운영 부담 높음"} or (
        interconnection_state in {"접속 대기 부담", "접속 대기 부담 높음"}
    )
    transmission_expanding = transmission_state in {"송전 투자 확대", "투자 유지"}
    if demand_expanding and grid_pressure and transmission_expanding:
        return "전력망 투자 가설 강화", "수요 확대와 계통 부담, 실제 송전투자 집행이 서로 다른 자료에서 함께 확인됩니다."
    if demand_expanding and grid_pressure:
        return "계통 부담 확인·투자 반응 대기", "수요 확대와 계통 부담은 확인됐지만 실제 송전투자 확대는 아직 확인이 부족합니다."
    if demand_expanding:
        return "전력수요 확대·병목 미확인", "전력수요는 확대 중이지만 계통 운영·접속 자료만으로 병목을 확정하지 않습니다."
    if transmission_expanding:
        return "투자 선행·수요 확인 필요", "송전투자는 늘고 있으나 최근 전력수요 방향이 뚜렷하지 않습니다."
    construction = f" 발전·저장설비는 {supply_state}입니다." if supply_state else ""
    return "근거 혼조", f"수요와 계통·투자 실행의 방향이 일치하지 않습니다.{construction}"


class RegimeThesisDataService:
    FEEDS = (
        "kosis_semiconductor", "customs_memory_exports", "opendart_semiconductor",
        "eia_power", LBNL_FEED_ID, PUDL_FEED_ID,
    )

    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        jobs = {
            "kosis": KosisSemiconductorService().refresh(force=force),
            "customs": CustomsMemoryExportService().refresh(force=force),
            "opendart": DartSemiconductorService().refresh(force=force),
            "eia": EiaPowerService().refresh(force=force),
            "grid": GridInfrastructureService().refresh(force=force),
        }
        raw = await asyncio.gather(*jobs.values(), return_exceptions=True)
        results: dict[str, Any] = {}
        for name, value in zip(jobs, raw):
            results[name] = (
                {"status": "failed", "saved": 0, "error": str(value)}
                if isinstance(value, Exception) else value
            )
        statuses = [item.get("status", "failed") for item in results.values()]
        healthy = {"success", "cached"}
        status = (
            "success" if all(value in healthy for value in statuses)
            else "failed" if all(value not in healthy and value != "partial" for value in statuses)
            else "partial"
        )
        return {
            "status": status, "feeds": results,
            "semiconductor_cycle": self.semiconductor_summary(),
            "power_cycle": self.power_summary(),
        }

    def semiconductor_summary(
        self, memory_cycle: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        production_points = _repo_points(self.repo, "kr_semiconductor_production_original")
        shipment_points = _repo_points(self.repo, "kr_semiconductor_shipments_original")
        inventory_points = _repo_points(self.repo, "kr_semiconductor_inventory_original")
        production_sa = _repo_points(self.repo, "kr_semiconductor_production_sa")
        shipment_sa = _repo_points(self.repo, "kr_semiconductor_shipments_sa")
        inventory_sa = _repo_points(self.repo, "kr_semiconductor_inventory_sa")
        supply_metrics = {
            "production": metric_summary(production_points, unit="2020=100"),
            "shipments": metric_summary(shipment_points, unit="2020=100"),
            "inventory": metric_summary(inventory_points, unit="2020=100"),
        }
        supply_metrics["production"]["change_3m"] = _period_change(production_sa)
        supply_metrics["shipments"]["change_3m"] = _period_change(shipment_sa)
        supply_metrics["inventory"]["change_3m"] = _period_change(inventory_sa)
        supply_context = build_kosis_supply_context(
            supply_metrics, shipment_sa, inventory_sa
        )
        supply_state, supply_reason = classify_kosis_supply(
            supply_metrics, supply_context
        )

        export_rows = self.repo.matching_series("kr_customs_hs_")
        aggregates = aggregate_customs_exports(export_rows)
        export_metrics = {
            "memory": metric_summary(aggregates["memory"], unit="USD"),
            "dram": metric_summary(aggregates["dram"], unit="USD"),
            "flash": metric_summary(aggregates["flash"], unit="USD"),
            "mcp": metric_summary(aggregates["mcp"], unit="USD"),
            "dram_module": metric_summary(aggregates["dram_module"], unit="USD"),
            "dram_weight": metric_summary(aggregates["dram_weight"], unit="kg"),
            "dram_unit_value": metric_summary(
                aggregates["dram_unit_value"], unit="USD/kg"
            ),
        }
        export_state, export_reason = classify_exports(export_metrics["dram"])
        company_confirmation = DartSemiconductorService().summary()
        memory_cycle = memory_cycle or MemoryPriceService().summary()
        export_decomposition = classify_dram_export_decomposition(
            export_metrics["dram"],
            export_metrics["dram_weight"],
            export_metrics["dram_unit_value"],
            export_metrics["mcp"],
            export_metrics["dram_module"],
        )
        supplier_inventory = build_supplier_inventory_efficiency(
            company_confirmation["companies"]
        )
        server_rdimm = build_server_rdimm_proxy(memory_cycle)
        hbm_server_proxy = classify_hbm_server_proxy(
            server_rdimm, export_decomposition, supplier_inventory
        )
        dram_state, dram_reason, dram_coverage, dram_conflicts = classify_dram_bottleneck(
            memory_cycle.get("state", "판정 불가"),
            export_state,
            supply_state,
            company_confirmation["state"],
            hbm_server_proxy["state"],
        )

        lane_states = [
            memory_cycle.get("state", "판정 불가"), hbm_server_proxy["state"],
            supply_state, company_confirmation["state"],
        ]
        lane_coverage = sum(
            state not in {"판정 불가", "판정 제한"} for state in lane_states
        ) / len(lane_states)
        state, reason = classify_semiconductor_cycle(
            dram_state, supply_state, company_confirmation["state"], lane_coverage
        )
        dates = [
            metric.get("observation_date") for metric in (*supply_metrics.values(), *export_metrics.values())
            if metric.get("observation_date")
        ]
        dates += [
            item["observation_date"] for item in memory_cycle.get("series", [])
            if item.get("observation_date") and not item.get("is_stale")
        ]
        dates += [company["latest_period"] for company in company_confirmation["companies"] if company.get("latest_period")]
        decision_as_of = memory_cycle.get("decision_as_of")
        return {
            "state": state, "reason": reason, "coverage": lane_coverage,
            "role": "corroborative", "as_of_date": max(dates) if dates else None,
            "decision_as_of_date": decision_as_of,
            "supporting_as_of_range": {
                "from": min(dates) if dates else None,
                "to": max(dates) if dates else None,
            },
            "dram_bottleneck": {
                "state": dram_state,
                "reason": dram_reason,
                "coverage": dram_coverage,
                "confidence": "부분",
                "primary_signal": memory_cycle.get("state", "판정 불가"),
                "decision_as_of_date": decision_as_of,
                "conflicts": dram_conflicts,
                "methodology": "공개 DDR5 계약가격을 주축으로 두고 서버 RDIMM 및 DRAM 칩·MCP·모듈 수출을 HBM·서버 수요 확인축으로 사용",
                "limitations": "HBM·Server DRAM 계약가격·공급충족률을 직접 측정하지 않아 수급 타이트 여부는 프록시 판정",
            },
            "demand": {
                "state": export_state, "reason": export_reason,
                "decomposition": export_decomposition,
                "metrics": export_metrics,
                "source": "관세청 품목별 수출입실적", "source_url": export_rows[-1]["source_url"] if export_rows else None,
                "fetch_status": self.repo.status("customs_memory_exports"),
            },
            "supply": {
                "state": supply_state, "reason": supply_reason, "metrics": supply_metrics,
                "context": supply_context,
                "seasonally_adjusted_history": {
                    "production": production_sa, "shipments": shipment_sa, "inventory": inventory_sa,
                },
                "source": "KOSIS 광업제조업동향조사", "source_url": KOSIS_TABLE_URL,
                "fetch_status": self.repo.status("kosis_semiconductor"),
            },
            "company_confirmation": company_confirmation,
            "hbm_server_proxy": hbm_server_proxy,
            "methodology": "공개 DDR5 가격을 DRAM 주축으로 두고 서버 RDIMM·DRAM 칩·MCP·모듈 수출과 SK하이닉스 재고 효율을 HBM 간접 확인축으로 사용하며 KOSIS 완제품 재고는 광의 보조신호로만 반영",
            "limitations": "HBM 계약가격·공급충족률·bit 출하 가이던스는 직접 수집하지 않으며 관세청 신고중량을 bit 출하량으로 해석하지 않고 이 판정만으로 자동 거시 레짐을 변경하지 않음",
        }

    def power_summary(self) -> dict[str, Any]:
        metrics = {
            "total_sales": metric_summary(_repo_points(self.repo, "us_electricity_sales_all"), unit="million kWh"),
            "commercial_sales": metric_summary(_repo_points(self.repo, "us_electricity_sales_commercial"), unit="million kWh"),
            "industrial_sales": metric_summary(_repo_points(self.repo, "us_electricity_sales_industrial"), unit="million kWh"),
            "generation": metric_summary(_repo_points(self.repo, "us_electricity_net_generation"), unit="thousand MWh"),
            "capacity": metric_summary(_repo_points(self.repo, "us_electricity_net_summer_capacity"), unit="MW"),
        }
        # Capacity is annual. A three-observation average is not a three-month
        # momentum and must not be exposed under the monthly field name.
        metrics["capacity"]["yoy_3m_avg"] = None
        legacy_state, legacy_reason = classify_power_demand(
            metrics["total_sales"], metrics["commercial_sales"]
        )

        daily_by_region = {
            respondent: _repo_points(
                self.repo, f"us_electricity_daily_demand_{respondent.lower()}"
            )
            for respondent in ("US48", *RTO_REGIONS)
        }
        daily_forecast_by_region = {
            respondent: _repo_points(
                self.repo, f"us_electricity_daily_demand_forecast_{respondent.lower()}"
            )
            for respondent in ("US48", *RTO_REGIONS)
        }
        daily_generation_by_region = {
            respondent: _repo_points(
                self.repo, f"us_electricity_daily_net_generation_{respondent.lower()}"
            )
            for respondent in ("US48", *RTO_REGIONS)
        }
        daily_interchange_by_region = {
            respondent: _repo_points(
                self.repo, f"us_electricity_daily_total_interchange_{respondent.lower()}"
            )
            for respondent in ("US48", *RTO_REGIONS)
        }
        national_daily = daily_by_region["US48"]
        ai_region_daily = aggregate_daily_series(
            (daily_by_region[respondent] for respondent in AI_POWER_PROXY_REGIONS),
            expected_series_count=len(AI_POWER_PROXY_REGIONS),
        )
        non_ai_regions = tuple(
            respondent for respondent in RTO_REGIONS
            if respondent not in AI_POWER_PROXY_REGIONS
        )
        non_ai_region_daily = aggregate_daily_series(
            (daily_by_region[respondent] for respondent in non_ai_regions),
            expected_series_count=len(non_ai_regions),
        )
        national_28d = aligned_daily_yoy(national_daily, window_days=28)
        national_84d = aligned_daily_yoy(national_daily, window_days=84)
        ai_regions_28d = aligned_daily_yoy(ai_region_daily, window_days=28)
        ai_regions_84d = aligned_daily_yoy(ai_region_daily, window_days=84)
        non_ai_regions_84d = aligned_daily_yoy(non_ai_region_daily, window_days=84)
        ai_excess_growth = (
            ai_regions_84d["value"] - non_ai_regions_84d["value"]
            if ai_regions_84d["value"] is not None and non_ai_regions_84d["value"] is not None
            else None
        )
        region_details = []
        for respondent, name in RTO_REGIONS.items():
            recent = aligned_daily_yoy(daily_by_region[respondent], window_days=28)
            structural = aligned_daily_yoy(daily_by_region[respondent], window_days=84)
            operations = window_grid_operations(
                daily_by_region[respondent],
                daily_forecast_by_region[respondent],
                daily_generation_by_region[respondent],
                daily_interchange_by_region[respondent],
            )
            pressure = bool(
                recent["value"] is not None
                and recent["value"] >= 2
                and (
                    (operations["forecast_surprise_pct"] is not None and operations["forecast_surprise_pct"] >= 1.5)
                    or (operations["net_import_share_pct"] is not None and operations["net_import_share_pct"] >= 5)
                )
            )
            region_details.append({
                "id": respondent,
                "name": name,
                "yoy_28d": recent["value"],
                "yoy_84d": structural["value"],
                "observation_date": structural["to"],
                "is_ai_proxy": respondent in AI_POWER_PROXY_REGIONS,
                "forecast_surprise_pct": operations["forecast_surprise_pct"],
                "forecast_abs_error_pct": operations["forecast_abs_error_pct"],
                "generation_coverage_pct": operations["generation_coverage_pct"],
                "net_import_share_pct": operations["net_import_share_pct"],
                "operating_pressure": pressure,
            })
        available_regions = [
            item for item in region_details if item["yoy_84d"] is not None
        ]
        region_coverage = len(available_regions) / len(RTO_REGIONS)
        regional_expansion_share = (
            sum(item["yoy_84d"] >= 2 for item in available_regions) / len(RTO_REGIONS)
            if len(available_regions) == len(RTO_REGIONS) else None
        )
        ai_acceleration = (
            ai_regions_28d["value"] - ai_regions_84d["value"]
            if ai_regions_28d["value"] is not None and ai_regions_84d["value"] is not None
            else None
        )
        demand_state, demand_reason, demand_score, demand_coverage = classify_power_demand_axis(
            national_yoy_84d=national_84d["value"],
            ai_regions_yoy_84d=ai_regions_84d["value"],
            commercial_yoy_3m=metrics["commercial_sales"].get("yoy_3m_avg"),
            regional_expansion_share=regional_expansion_share,
            ai_regions_acceleration_pp=ai_acceleration,
            ai_excess_growth_pp=ai_excess_growth,
            region_coverage=region_coverage,
        )
        demand_model = "eia930+monthly"
        if demand_state in {"자료 부족", "판정 제한"} and legacy_state != "판정 불가":
            demand_state, demand_reason = legacy_state, legacy_reason
            demand_model = "monthly_fallback"

        def aggregate_kind(
            lane: dict[str, list[dict[str, Any]]],
            regions: tuple[str, ...],
        ) -> list[dict[str, Any]]:
            return aggregate_daily_series(
                (lane[respondent] for respondent in regions),
                expected_series_count=len(regions),
            )

        ai_forecast_daily = aggregate_kind(daily_forecast_by_region, AI_POWER_PROXY_REGIONS)
        ai_generation_daily = aggregate_kind(daily_generation_by_region, AI_POWER_PROXY_REGIONS)
        ai_interchange_daily = aggregate_kind(daily_interchange_by_region, AI_POWER_PROXY_REGIONS)
        operations_metrics = window_grid_operations(
            ai_region_daily, ai_forecast_daily, ai_generation_daily, ai_interchange_daily
        )
        ai_operating_regions = [
            item for item in region_details if item["is_ai_proxy"]
        ]
        operations_region_coverage = (
            sum(item["forecast_surprise_pct"] is not None for item in ai_operating_regions)
            / len(AI_POWER_PROXY_REGIONS)
        )
        pressure_region_count = (
            sum(item["operating_pressure"] for item in ai_operating_regions)
            if operations_region_coverage == 1 else None
        )
        operations_coverage = min(
            operations_metrics["coverage"], operations_region_coverage
        )
        operations_state, operations_reason = classify_grid_operations_axis(
            load_yoy_28d=ai_regions_28d["value"],
            forecast_surprise_pct=operations_metrics["forecast_surprise_pct"],
            forecast_abs_error_pct=operations_metrics["forecast_abs_error_pct"],
            net_import_share_pct=operations_metrics["net_import_share_pct"],
            pressure_region_count=pressure_region_count,
            expected_region_count=len(AI_POWER_PROXY_REGIONS),
            coverage=operations_coverage,
        )

        def latest(series_id: str) -> dict[str, Any]:
            # Some read-only test/adaptor repositories intentionally expose the
            # minimal ``series(series_id)`` protocol.  The production repository
            # is already date-sorted, so selecting the last row here keeps that
            # protocol small without changing the result.
            rows = self.repo.series(series_id)
            return rows[-1] if rows else {}

        pipeline_rows = {
            "operating_capacity_mw": latest("us_power_operating_capacity_mw"),
            "committed_additions_24m_mw": latest("us_power_committed_additions_24m_mw"),
            "retirements_24m_mw": latest("us_power_planned_retirements_24m_mw"),
            "net_additions_24m_mw": latest("us_power_net_committed_additions_24m_mw"),
            "net_pipeline_ratio_24m_pct": latest("us_power_net_pipeline_ratio_24m_pct"),
            "variable_storage_share_24m_pct": latest("us_power_variable_storage_share_24m_pct"),
            "delayed_committed_capacity_mw": latest("us_power_delayed_committed_capacity_mw"),
        }
        pipeline_mix = []
        for group in ("solar", "battery", "wind", "gas", "other"):
            row = latest(f"us_power_committed_pipeline_{group}_mw")
            pipeline_mix.append({
                "id": group,
                "value_gw": float(row["value"]) / 1000 if row.get("value") is not None else None,
            })
        pipeline_date = next((
            row.get("observation_date") for row in pipeline_rows.values()
            if row.get("observation_date")
        ), None)
        net_pipeline_ratio = pipeline_rows["net_pipeline_ratio_24m_pct"].get("value")
        variable_storage_share = pipeline_rows["variable_storage_share_24m_pct"].get("value")
        supply_state, supply_reason = classify_power_supply_axis(
            float(net_pipeline_ratio) if net_pipeline_ratio is not None else None,
            float(variable_storage_share) if variable_storage_share is not None else None,
        )
        grid_service = GridInfrastructureService()
        grid_service.repo = self.repo
        grid_summary = grid_service.summary()
        interconnection_axis = grid_summary["interconnection_axis"]
        transmission_axis = grid_summary["transmission_investment_axis"]

        def grid_value(axis: dict[str, Any], key: str) -> float | None:
            metric = (axis.get("metrics") or {}).get(key) or {}
            value = metric.get("value")
            return float(value) if value is not None else None

        operating_capacity_mw = pipeline_rows["operating_capacity_mw"].get("value")
        operating_capacity_gw = (
            float(operating_capacity_mw) / 1000
            if operating_capacity_mw is not None else None
        )
        interconnection_state, interconnection_reason = classify_interconnection_axis(
            active_queue_gw=grid_value(interconnection_axis, "active_queue_gw"),
            operating_capacity_gw=operating_capacity_gw,
            ia_executed_share_pct=grid_value(interconnection_axis, "ia_executed_share_pct"),
            median_active_age_years=grid_value(interconnection_axis, "median_active_age_years"),
            ir_to_cod_median_years=grid_value(
                interconnection_axis, "recent_ir_to_cod_median_years"
            ),
            usable=not bool((interconnection_axis.get("freshness") or {}).get("is_stale", True)),
        )
        transmission_state, transmission_reason = classify_transmission_investment_axis(
            additions_usd=grid_value(transmission_axis, "annual_additions_usd"),
            like_for_like_cagr_pct=grid_value(
                transmission_axis, "like_for_like_three_year_cagr_pct"
            ),
            reporter_count=grid_value(transmission_axis, "reporter_count"),
            reporter_coverage_pct=grid_value(
                transmission_axis, "current_reporter_prior_year_coverage_pct"
            ),
            usable=not bool((transmission_axis.get("freshness") or {}).get("is_stale", True)),
        )
        daily_date = national_84d.get("to")
        latest_monthly = metrics["total_sales"].get("observation_date")
        demand_date = daily_date or latest_monthly
        age_days = (date.today() - date.fromisoformat(demand_date)).days if demand_date else None
        pipeline_age_days = (
            (date.today() - date.fromisoformat(pipeline_date)).days if pipeline_date else None
        )
        demand_is_stale = age_days is None or age_days > (7 if daily_date else 150)
        operations_date = operations_metrics.get("observation_date")
        operations_age_days = (
            (date.today() - date.fromisoformat(operations_date)).days
            if operations_date else None
        )
        operations_is_stale = operations_age_days is None or operations_age_days > 7
        supply_is_stale = pipeline_age_days is None or pipeline_age_days > 90
        effective_demand_state = "자료 부족" if demand_is_stale else demand_state
        effective_operations_state = (
            "자료 부족" if operations_is_stale else operations_state
        )
        state, reason = classify_power_investment_thesis(
            effective_demand_state,
            supply_state,
            operations_state=effective_operations_state,
            interconnection_state=interconnection_state,
            transmission_state=transmission_state,
        )
        dates = [
            *[metric["observation_date"] for metric in metrics.values() if metric.get("observation_date")],
            *([daily_date] if daily_date else []),
            *([pipeline_date] if pipeline_date else []),
        ]
        supply_values = [
            pipeline_rows[key].get("value") for key in (
                "operating_capacity_mw", "committed_additions_24m_mw",
                "retirements_24m_mw", "net_additions_24m_mw",
            )
        ]
        supply_coverage = sum(value is not None for value in supply_values) / len(supply_values)
        interconnection_metrics = interconnection_axis.get("metrics") or {}
        transmission_metrics = transmission_axis.get("metrics") or {}
        interconnection_coverage = (
            sum(value is not None for value in interconnection_metrics.values())
            / len(interconnection_metrics) if interconnection_metrics else 0.0
        )
        transmission_coverage = (
            sum(value is not None for value in transmission_metrics.values())
            / len(transmission_metrics) if transmission_metrics else 0.0
        )
        interconnection_freshness = interconnection_axis.get("freshness") or {}
        transmission_freshness = transmission_axis.get("freshness") or {}
        interconnection_is_stale = bool(interconnection_freshness.get("is_stale", True))
        transmission_is_stale = bool(transmission_freshness.get("is_stale", True))
        dates.extend([
            observed for observed in (
                interconnection_freshness.get("observation_date"),
                transmission_freshness.get("observation_date"),
            ) if observed
        ])
        return {
            "state": state,
            "reason": reason,
            "coverage": (
                demand_coverage + operations_coverage + supply_coverage
                + interconnection_coverage + transmission_coverage
            ) / 5,
            "role": "context", "as_of_date": max(dates) if dates else None,
            "decision_as_of_date": demand_date,
            "age_days": age_days,
            "is_stale": (
                demand_is_stale or operations_is_stale or supply_is_stale
                or interconnection_is_stale or transmission_is_stale
            ),
            "metrics": metrics, "source": "U.S. EIA Electricity Data", "source_url": EIA_DOC_URL,
            "fetch_status": self.repo.status("eia_power"),
            "demand_axis": {
                "state": demand_state,
                "reason": demand_reason,
                "score": demand_score,
                "coverage": demand_coverage,
                "model": demand_model,
                "observation_date": demand_date,
                "age_days": age_days,
                "is_stale": demand_is_stale,
                "national_yoy_28d": national_28d["value"],
                "national_yoy_84d": national_84d["value"],
                "ai_regions_yoy_28d": ai_regions_28d["value"],
                "ai_regions_yoy_84d": ai_regions_84d["value"],
                "ai_regions_acceleration_pp": ai_acceleration,
                "ai_excess_growth_pp": ai_excess_growth,
                "regional_expansion_share": regional_expansion_share,
                "region_coverage": region_coverage,
                "expected_region_count": len(RTO_REGIONS),
                "available_region_count": len(available_regions),
                "commercial_yoy_3m": metrics["commercial_sales"].get("yoy_3m_avg"),
                "regions": sorted(
                    region_details,
                    key=lambda item: item["yoy_84d"] if item["yoy_84d"] is not None else -999,
                    reverse=True,
                ),
                "yoy_history": rolling_power_yoy_history(national_daily, ai_region_daily),
                "source_url": EIA_GRID_URL,
            },
            "operations_axis": {
                "state": operations_state,
                "reason": operations_reason,
                "coverage": operations_coverage,
                "observation_date": operations_date,
                "age_days": operations_age_days,
                "is_stale": operations_is_stale,
                "window_days": 28,
                "forecast_surprise_pct": operations_metrics["forecast_surprise_pct"],
                "forecast_abs_error_pct": operations_metrics["forecast_abs_error_pct"],
                "generation_coverage_pct": operations_metrics["generation_coverage_pct"],
                "net_import_share_pct": operations_metrics["net_import_share_pct"],
                "pressure_region_count": pressure_region_count,
                "expected_region_count": len(AI_POWER_PROXY_REGIONS),
                "history": rolling_grid_operations_history(
                    ai_region_daily,
                    ai_forecast_daily,
                    ai_generation_daily,
                    ai_interchange_daily,
                ),
                "source_url": EIA_GRID_URL,
                "limitations": "익일예측 오차는 날씨·예측 품질을 함께 반영하고 순유입은 정상적인 지역간 거래일 수 있어, 단독으로 계통 병목이나 예비율 부족을 뜻하지 않습니다.",
            },
            "supply_axis": {
                "state": supply_state,
                "reason": supply_reason,
                "coverage": supply_coverage,
                "observation_date": pipeline_date,
                "age_days": pipeline_age_days,
                "is_stale": supply_is_stale,
                "operating_capacity_gw": (
                    float(pipeline_rows["operating_capacity_mw"]["value"]) / 1000
                    if pipeline_rows["operating_capacity_mw"].get("value") is not None else None
                ),
                "committed_additions_24m_gw": (
                    float(pipeline_rows["committed_additions_24m_mw"]["value"]) / 1000
                    if pipeline_rows["committed_additions_24m_mw"].get("value") is not None else None
                ),
                "retirements_24m_gw": (
                    float(pipeline_rows["retirements_24m_mw"]["value"]) / 1000
                    if pipeline_rows["retirements_24m_mw"].get("value") is not None else None
                ),
                "net_additions_24m_gw": (
                    float(pipeline_rows["net_additions_24m_mw"]["value"]) / 1000
                    if pipeline_rows["net_additions_24m_mw"].get("value") is not None else None
                ),
                "net_pipeline_ratio_24m_pct": (
                    float(net_pipeline_ratio) if net_pipeline_ratio is not None else None
                ),
                "variable_storage_share_24m_pct": (
                    float(variable_storage_share) if variable_storage_share is not None else None
                ),
                "delayed_committed_capacity_gw": (
                    float(pipeline_rows["delayed_committed_capacity_mw"]["value"]) / 1000
                    if pipeline_rows["delayed_committed_capacity_mw"].get("value") is not None else None
                ),
                "mix": pipeline_mix,
                "source_url": EIA_860M_URL,
                "fetch_status": self.repo.status(PIPELINE_FEED_ID),
            },
            "interconnection_axis": {
                **interconnection_axis,
                "state": interconnection_state,
                "reason": interconnection_reason,
                "coverage": interconnection_coverage,
                "observation_date": interconnection_freshness.get("observation_date"),
                "is_stale": interconnection_is_stale,
            },
            "transmission_investment_axis": {
                **transmission_axis,
                "state": transmission_state,
                "reason": transmission_reason,
                "coverage": transmission_coverage,
                "observation_date": transmission_freshness.get("observation_date"),
                "is_stale": transmission_is_stale,
            },
            "methodology": "EIA-930 수요를 전국 주축과 AI·비AI 지역 초과성장 확인축으로 분리하고, 익일예측·순발전·지역간 전력교환은 별도 운영 압력 프록시로 계산합니다. EIA-860M은 발전·저장 건설활동으로만 판정합니다.",
            "limitations": "고빈도 수요는 날씨 보정 전이며 AI 관찰지역도 데이터센터 전용 부하가 아닙니다. 익일예측 오차·순유입과 EIA-860M 순하계 명목 MW는 공인 공급력·예비율·송전 가능량이나 데이터센터 연결 대기열을 직접 뜻하지 않습니다.",
        }

    def feed_health(self) -> dict[str, dict[str, Any] | None]:
        return self.repo.statuses(self.FEEDS)
