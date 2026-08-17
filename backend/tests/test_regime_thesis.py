import pytest

from app.services.regime_thesis import (
    build_server_rdimm_proxy,
    build_supplier_inventory_efficiency,
    build_kosis_supply_context,
    classify_dram_bottleneck,
    classify_dram_export_decomposition,
    classify_exports,
    classify_hbm_server_proxy,
    classify_kosis_supply,
    classify_semiconductor_cycle,
    history_with_yoy,
    metric_summary,
)


def monthly_points(values):
    return [
        {
            "date": f"{2021 + index // 12}-{index % 12 + 1:02d}-01",
            "value": value,
        }
        for index, value in enumerate(values)
    ]


def yoy_metric(values_2025, values_2026):
    points = []
    for year, values in ((2025, values_2025), (2026, values_2026)):
        for month, value in enumerate(values, 1):
            points.append({"date": f"{year}-{month:02d}-01", "value": value})
    return metric_summary(points, unit="test")


def test_history_yoy_compares_same_month_not_previous_observation():
    history = history_with_yoy([
        {"date": "2025-06-01", "value": 100},
        {"date": "2026-05-01", "value": 150},
        {"date": "2026-06-01", "value": 120},
    ])

    assert history[-2]["yoy"] is None
    assert history[-1]["yoy"] == pytest.approx(20)


def test_export_signal_requires_persistence_and_three_month_average():
    points = []
    for year, values in [(2025, [100, 100, 100]), (2026, [120, 125, 130])]:
        for month, value in zip((1, 2, 3), values):
            points.append({"date": f"{year}-{month:02d}-01", "value": value})
    state, _ = classify_exports(metric_summary(points, unit="USD"))
    assert state == "수출 확장 강함"


def test_supply_signal_uses_inventory_minus_shipments_gap():
    metrics = {
        "production": {"yoy": 3},
        "shipments": {"yoy": 2},
        "inventory": {"yoy": 20},
    }
    context = {
        "inventory_percentile": 85,
        "inventory_shipments_ratio_percentile": 90,
        "inventory_shipments_ratio_change_3m": 8,
        "inventory_shipment_yoy_gap": 18,
        "inventory_shipment_yoy_gap_last_two": [14, 18],
    }
    state, _ = classify_kosis_supply(metrics, context)
    assert state == "재고 부담"


def test_low_level_inventory_rebound_does_not_become_dram_inventory_burden():
    metrics = {
        "production": {"yoy": 2.2478, "change_3m": -3.05},
        "shipments": {"yoy": 3.1132, "change_3m": -0.72},
        "inventory": {"yoy": 3.0162, "change_3m": 9.77},
    }
    context = {
        "inventory_percentile": 20,
        "inventory_shipments_ratio_percentile": 13.3,
        "inventory_change_3m": 9.77,
        "inventory_shipments_ratio_change_3m": 10.6,
        "inventory_shipment_yoy_gap": -0.097,
        "inventory_shipment_yoy_gap_last_two": [-1.2, -0.097],
    }

    state, reason = classify_kosis_supply(metrics, context)

    assert state == "재고 반등 관찰"
    assert "20백분위" in reason
    assert "13백분위" in reason


def test_one_month_inventory_spike_is_not_persistent_burden():
    metrics = {
        "production": {"yoy": 3},
        "shipments": {"yoy": 2},
        "inventory": {"yoy": 20},
    }
    context = {
        "inventory_percentile": 85,
        "inventory_shipments_ratio_percentile": 90,
        "inventory_shipments_ratio_change_3m": 8,
        "inventory_shipment_yoy_gap": 18,
        "inventory_shipment_yoy_gap_last_two": [2, 18],
    }

    state, _ = classify_kosis_supply(metrics, context)

    assert state != "재고 부담"


def test_kosis_context_uses_absolute_history_and_inventory_shipments_ratio():
    shipment_sa = monthly_points([200] * 60)
    inventory_sa = monthly_points(range(100, 160))
    metrics = {
        "production": {"history": []},
        "shipments": {
            "history": [
                {**point, "yoy": 1.0} for point in shipment_sa
            ],
        },
        "inventory": {
            "history": [
                {**point, "yoy": 12.0} for point in inventory_sa
            ],
        },
    }

    context = build_kosis_supply_context(metrics, shipment_sa, inventory_sa)

    assert context["history_months"] == 60
    assert context["inventory_percentile"] == pytest.approx(99.1667, rel=1e-3)
    assert context["inventory_shipments_ratio_percentile"] == pytest.approx(99.1667, rel=1e-3)
    assert context["inventory_shipments_ratio"] == pytest.approx(79.5)
    assert context["inventory_shipment_yoy_gap_last_two"] == [11.0, 11.0]


def test_dram_price_is_primary_and_broad_inventory_only_surfaces_conflict():
    state, _, coverage, conflicts = classify_dram_bottleneck(
        "가격 상승", "수출 증가", "재고 부담", "확장 확인"
    )

    assert state == "타이트 신호"
    assert coverage == 1
    assert conflicts == ["한국 반도체 완제품 재고 부담"]


def test_dram_bottleneck_requires_direct_price_proxy():
    state, reason, _, _ = classify_dram_bottleneck(
        "판정 불가", "수출 확장 강함", "수급 개선", "확장 확인"
    )

    assert state == "판정 제한"
    assert "공개 DDR5 계약가격" in reason


def test_dram_export_decomposition_distinguishes_mix_from_volume():
    result = classify_dram_export_decomposition(
        yoy_metric([100, 100, 100], [400, 420, 450]),
        yoy_metric([100, 100, 100], [92, 90, 95]),
        yoy_metric([1, 1, 1], [4.35, 4.67, 4.74]),
    )

    assert result["state"] == "단가·믹스 주도 확장"
    assert result["driver"] == "unit_value_mix"
    assert result["conflicts"] == ["DRAM 수출중량 3개월 평균 YoY -7.7%"]


def test_dram_export_decomposition_can_identify_volume_led_growth():
    result = classify_dram_export_decomposition(
        yoy_metric([100, 100, 100], [125, 130, 135]),
        yoy_metric([100, 100, 100], [125, 130, 135]),
        yoy_metric([1, 1, 1], [1, 1, 1]),
    )

    assert result["state"] == "물량 주도 확장"
    assert result["driver"] == "volume"


def test_supplier_ratio_improves_when_revenue_outgrows_absolute_inventory():
    companies = [{
        "id": "sk_hynix",
        "name": "SK하이닉스",
        "latest_period": "2026-06-30",
        "is_stale": False,
        "revenue_yoy": 100,
        "inventory_yoy": 20,
        "histories": {
            "revenue": [
                {"period": "2025-06-30", "value": 100},
                {"period": "2026-06-30", "value": 200},
            ],
            "inventory": [
                {"period": "2025-06-30", "value": 60},
                {"period": "2026-06-30", "value": 72},
            ],
        },
    }, {
        "id": "samsung", "name": "삼성전자", "is_stale": True,
        "latest_period": None,
        "revenue_yoy": None, "inventory_yoy": None,
        "histories": {"revenue": [], "inventory": []},
    }]

    result = build_supplier_inventory_efficiency(companies)
    primary = next(item for item in result["companies"] if item["id"] == "sk_hynix")

    assert result["state"] == "상대 재고부담 크게 완화"
    assert primary["inventory_to_revenue"] == pytest.approx(36)
    assert primary["prior_inventory_to_revenue"] == pytest.approx(60)
    assert primary["ratio_change_yoy"] == pytest.approx(-40)
    assert primary["inventory_yoy"] == 20


def test_supplier_ratio_rejects_a_period_mismatch_with_company_metrics():
    result = build_supplier_inventory_efficiency([{
        "id": "sk_hynix",
        "name": "SK하이닉스",
        "latest_period": "2026-03-31",
        "is_stale": False,
        "revenue_yoy": 100,
        "inventory_yoy": 20,
        "histories": {
            "revenue": [
                {"period": "2025-06-30", "value": 100},
                {"period": "2026-06-30", "value": 200},
            ],
            "inventory": [
                {"period": "2025-06-30", "value": 60},
                {"period": "2026-06-30", "value": 72},
            ],
        },
    }])

    assert result["state"] == "판정 제한"
    assert result["companies"][0]["state"] == "판정 불가"


def test_server_rdimm_proxy_rejects_stale_price():
    result = build_server_rdimm_proxy({"series": [{
        "series_id": "dram_module_spot_ddr5_rdimm_32gb",
        "observation_date": "2026-07-01",
        "price_average": 1500,
        "change_percent": 4,
        "is_stale": True,
    }]})

    assert result["state"] == "판정 제한"
    assert result["is_stale"] is True


def test_hbm_server_proxy_requires_rdimm_and_keeps_volume_conflict():
    export = {
        "state": "단가·믹스 주도 확장", "coverage": 1,
        "conflicts": ["DRAM 수출중량 3개월 평균 YoY -10.0%"],
    }
    supplier = {"state": "상대 재고부담 크게 완화"}

    positive = classify_hbm_server_proxy(
        {"state": "가격 상승"}, export, supplier
    )
    limited = classify_hbm_server_proxy(
        {"state": "판정 제한"}, export, supplier
    )

    assert positive["state"] == "타이트 지속 신호"
    assert positive["direct_hbm_data"] is False
    assert positive["conflicts"] == ["DRAM 수출중량 3개월 평균 YoY -10.0%"]
    assert limited["state"] == "판정 제한"


def test_hbm_proxy_does_not_double_count_dart_inventory_derivative():
    rdimm = {"state": "가격 상승"}
    export = {"state": "단가·믹스 주도 확장", "coverage": 1, "conflicts": []}

    improving = classify_hbm_server_proxy(
        rdimm, export, {"state": "상대 재고부담 크게 완화"}
    )
    worsening = classify_hbm_server_proxy(
        rdimm, export, {"state": "상대 재고부담 크게 확대"}
    )

    assert improving["state"] == "타이트 지속 신호"
    assert worsening["state"] == "타이트 지속 신호"
    assert improving["coverage"] == 1
    assert "점수에 중복 반영하지 않음" in improving["methodology"]


def test_dram_bottleneck_uses_hbm_proxy_as_one_confirmation_lane():
    state, reason, coverage, _ = classify_dram_bottleneck(
        "가격 상승", "혼조", "재고 반등 관찰", "혼조", "타이트 지속 신호"
    )

    assert state == "타이트 신호"
    assert "HBM·서버 DRAM 간접계측" in reason
    assert coverage == 1


def test_semiconductor_composite_lets_dram_lead_but_requires_two_negative_vetoes():
    state, _ = classify_semiconductor_cycle("타이트 신호", "재고 부담", "확장 확인", 1)
    assert state == "확장 확인"

    state, _ = classify_semiconductor_cycle("타이트 신호", "재고 부담", "실적 둔화", 1)
    assert state == "경계"

    state, _ = classify_semiconductor_cycle("판정 제한", "수급 개선", "판정 불가", 1 / 4)
    assert state == "판정 불가"
