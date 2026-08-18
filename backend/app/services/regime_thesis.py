"""Deterministic semiconductor and power thesis summaries."""

from __future__ import annotations

import asyncio
from datetime import date
from statistics import mean
from typing import Any

from app.services.regime_customs import (
    CustomsMemoryExportService,
    aggregate_customs_exports,
)
from app.services.regime_dart import DartSemiconductorService
from app.services.regime_eia import EIA_DOC_URL, EiaPowerService
from app.services.regime_external import ExternalObservationRepository
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


class RegimeThesisDataService:
    FEEDS = ("kosis_semiconductor", "customs_memory_exports", "opendart_semiconductor", "eia_power")

    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        jobs = {
            "kosis": KosisSemiconductorService().refresh(force=force),
            "customs": CustomsMemoryExportService().refresh(force=force),
            "opendart": DartSemiconductorService().refresh(force=force),
            "eia": EiaPowerService().refresh(force=force),
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
        return {
            "state": state, "reason": reason, "coverage": lane_coverage,
            "role": "corroborative", "as_of_date": max(dates) if dates else None,
            "dram_bottleneck": {
                "state": dram_state,
                "reason": dram_reason,
                "coverage": dram_coverage,
                "confidence": "부분",
                "primary_signal": memory_cycle.get("state", "판정 불가"),
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
        state, reason = classify_power_demand(metrics["total_sales"], metrics["commercial_sales"])
        dates = [metric["observation_date"] for metric in metrics.values() if metric.get("observation_date")]
        latest_monthly = metrics["total_sales"].get("observation_date")
        age_days = (date.today() - date.fromisoformat(latest_monthly)).days if latest_monthly else None
        return {
            "state": state, "reason": reason, "coverage": (
                sum(metrics[key]["latest"] is not None for key in ("total_sales", "commercial_sales", "generation")) / 3
            ),
            "role": "context", "as_of_date": max(dates) if dates else None,
            "age_days": age_days, "is_stale": age_days is None or age_days > 150,
            "metrics": metrics, "source": "U.S. EIA Electricity Data", "source_url": EIA_DOC_URL,
            "fetch_status": self.repo.status("eia_power"),
            "methodology": "계절성이 큰 월간 전력판매는 전년동월 YoY와 최근 3개월 평균으로 판정하고 발전량·연간 순하계 설비용량은 공급 맥락으로 표시",
            "limitations": "상업용 전력판매는 데이터센터 전용 수요가 아니며 EIA 전력량만으로 계통 연결 지연·변압기 리드타임·전력망 병목을 판정하지 않음",
        }

    def feed_health(self) -> dict[str, dict[str, Any] | None]:
        return self.repo.statuses(self.FEEDS)
