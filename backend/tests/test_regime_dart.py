import pytest

from app.services.regime_dart import (
    _yoy,
    classify_company_confirmation,
    derive_quarters,
    parse_dart_report,
)


def dart_payload():
    return {
        "status": "000",
        "list": [
            {"sj_div": "BS", "account_id": "ifrs-full_Inventories", "account_nm": "재고자산", "thstrm_amount": "120", "rcept_no": "1"},
            {"sj_div": "CF", "account_id": "ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "account_nm": "유형자산의 취득", "thstrm_amount": "70", "rcept_no": "1"},
            {"sj_div": "IS", "account_id": "ifrs-full_Revenue", "account_nm": "매출액", "thstrm_amount": "90", "thstrm_add_amount": "170", "rcept_no": "1"},
            {"sj_div": "IS", "account_id": "dart_OperatingIncomeLoss", "account_nm": "영업이익", "thstrm_amount": "20", "thstrm_add_amount": "35", "rcept_no": "1"},
        ],
    }


def test_dart_parser_uses_ytd_for_income_and_retains_reported_inputs():
    result = parse_dart_report(dart_payload(), "samsung", 2026, "11012")
    by_series = {item["series_id"]: item for item in result}

    assert by_series["kr_company_samsung_revenue_ytd"]["value"] == 170
    assert by_series["kr_company_samsung_operating_income_ytd"]["value"] == 35
    assert by_series["kr_company_samsung_capex_ytd"]["value"] == 70
    assert by_series["kr_company_samsung_inventory"]["value"] == 120
    assert by_series["kr_company_samsung_revenue_ytd"]["dimensions"]["reported_current"] == "90"


def test_dart_no_data_is_not_an_error():
    assert parse_dart_report({"status": "013", "message": "조회된 데이타가 없습니다."}, "samsung", 2026, "11014") == []


def test_dart_ytd_normalization_does_not_invent_missing_quarters():
    rows = [
        {"observation_date": "2026-03-31", "value": 10},
        {"observation_date": "2026-06-30", "value": 25},
        {"observation_date": "2026-12-31", "value": 70},
    ]

    result = derive_quarters(rows)

    assert [(item["period"], item["value"]) for item in result] == [
        ("2026-03-31", 10), ("2026-06-30", 15),
    ]


def test_dart_yoy_can_be_aligned_to_the_latest_common_report_period():
    history = [
        {"period": "2025-03-31", "value": 100},
        {"period": "2026-03-31", "value": 120},
        {"period": "2026-06-30", "value": 150},
    ]

    assert _yoy(history, "2026-03-31") == pytest.approx(20)
    assert _yoy(history, "2026-06-30") is None


def test_company_confirmation_requires_two_independent_companies():
    state, _, coverage = classify_company_confirmation([
        {"revenue_yoy": 20, "inventory_yoy": 5, "operating_margin": 15},
        {"revenue_yoy": 12, "inventory_yoy": 8, "operating_margin": 20},
    ])
    assert state == "확장 확인"
    assert coverage == 1

    state, _, coverage = classify_company_confirmation([
        {"revenue_yoy": -8, "inventory_yoy": 25, "operating_margin": 5},
        {"revenue_yoy": -6, "inventory_yoy": 22, "operating_margin": 3},
    ])
    assert state == "실적 둔화"
    assert coverage == 1


def test_company_confirmation_compares_inventory_growth_with_revenue_growth():
    state, reason, coverage = classify_company_confirmation([
        {"revenue_yoy": 50, "inventory_yoy": 70, "operating_margin": 15},
        {"revenue_yoy": 20, "inventory_yoy": 40, "operating_margin": 20},
    ])

    assert state == "재고 부담"
    assert "매출보다 10%p 이상" in reason
    assert coverage == 1


def test_company_confirmation_does_not_treat_capex_as_an_expansion_vote():
    state, _, _ = classify_company_confirmation([
        {"revenue_yoy": 0, "inventory_yoy": 0, "operating_margin": 5, "capex_yoy": 200},
        {"revenue_yoy": 0, "inventory_yoy": 0, "operating_margin": 5, "capex_yoy": 200},
    ])

    assert state == "혼조"


def test_company_confirmation_uses_margin_direction_and_requires_margin_data():
    state, _, coverage = classify_company_confirmation([
        {
            "revenue_yoy": 20,
            "inventory_yoy": 5,
            "operating_margin": 0.1,
            "operating_margin_change_yoy_pp": -19.9,
        },
        {
            "revenue_yoy": 12,
            "inventory_yoy": 8,
            "operating_margin": 0.2,
            "operating_margin_change_yoy_pp": -9.8,
        },
    ])
    assert state == "실적 둔화"
    assert coverage == 1

    state, _, coverage = classify_company_confirmation([
        {"revenue_yoy": 20, "inventory_yoy": 5, "operating_margin": None},
        {"revenue_yoy": 12, "inventory_yoy": 8, "operating_margin": 20},
    ])
    assert state == "판정 불가"
    assert coverage == .5
