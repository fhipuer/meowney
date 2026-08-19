from datetime import date

from app.services.regime_sec import (
    build_capex_aggregate,
    classify_ai_capex,
    normalize_quarters,
)


def fact(start, end, value, accn, form="10-Q", filed="2026-08-01"):
    return {"start": start, "end": end, "val": value, "accn": accn, "form": form,
            "filed": filed, "fy": 2026, "fp": "Q2"}


def test_normalize_quarters_keeps_reported_quarter_values():
    result = normalize_quarters([
        fact("2026-01-01", "2026-03-31", 10, "q1"),
        fact("2026-04-01", "2026-06-30", 14, "q2"),
    ])
    assert [row["value"] for row in result] == [10, 14]
    assert all(row["derivation"] == "reported_quarter" for row in result)


def test_normalize_quarters_subtracts_ytd_and_annual_values():
    result = normalize_quarters([
        fact("2026-01-01", "2026-03-31", 10, "q1"),
        fact("2026-01-01", "2026-06-30", 24, "q2-ytd"),
        fact("2026-01-01", "2026-09-30", 39, "q3-ytd"),
        fact("2026-01-01", "2026-12-31", 58, "fy", form="10-K", filed="2027-02-01"),
    ])
    assert [row["value"] for row in result] == [10, 14, 15, 19]
    assert result[-1]["source_accessions"] == ["fy", "q3-ytd"]


def test_normalize_quarters_uses_latest_amendment_for_same_period():
    result = normalize_quarters([
        fact("2026-01-01", "2026-03-31", 10, "original", filed="2026-04-01"),
        fact("2026-01-01", "2026-03-31", 12, "amended", form="10-Q/A", filed="2026-05-01"),
    ])
    assert result[0]["value"] == 12
    assert result[0]["source_accessions"] == ["amended"]


def company(company_id, history, *, latest_period=None):
    rows = [{"period": period, "value": value} for period, value in history]
    return {
        "id": company_id,
        "latest_period": latest_period or (rows[-1]["period"] if rows else None),
        "history": rows,
    }


def test_ai_capex_detects_broad_strong_expansion_deterministically():
    aggregate = {
        "complete": True, "is_stale": False, "coverage": 1,
        "yoy": 40, "ttm_yoy": 25,
    }
    breadth = {
        "positive_count": 4, "negative_count": 0,
        "comparable_count": 4, "expected_count": 4,
    }
    state, reason, coverage = classify_ai_capex(aggregate, breadth)
    assert state == "확대 강함"
    assert coverage == 1
    assert "4/4" in reason


def test_ai_capex_flags_broad_contraction_for_review():
    state, reason, _ = classify_ai_capex(
        {"complete": True, "is_stale": False, "coverage": 1, "yoy": -3, "ttm_yoy": 4},
        {"positive_count": 2, "negative_count": 2, "comparable_count": 4, "expected_count": 4},
    )
    assert state == "감속 관찰"
    assert "2개" in reason


def test_normalize_quarters_does_not_treat_two_missing_quarters_as_one():
    result = normalize_quarters([
        fact("2026-01-01", "2026-03-31", 10, "q1"),
        fact("2026-01-01", "2026-09-30", 39, "q3-ytd"),
        fact("2026-01-01", "2026-12-31", 58, "fy", form="10-K", filed="2027-02-01"),
    ])

    assert [row["value"] for row in result] == [10, 19]
    assert result[-1]["source_accessions"] == ["fy", "q3-ytd"]


def test_capex_aggregate_uses_exact_complete_quarter_and_dates():
    companies = [
        company(f"c{index}", [
            ("2025-06-30", 10 + index),
            ("2026-03-31", 15 + index),
            ("2026-06-30", 20 + index),
        ])
        for index in range(4)
    ]

    aggregate, breadth = build_capex_aggregate(
        companies, today=date(2026, 8, 19)
    )

    assert aggregate["latest_period"] == "2026-06-30"
    assert aggregate["complete"] is True
    assert aggregate["latest_value"] == 86
    assert aggregate["qoq"] == (86 / 66 - 1) * 100
    assert aggregate["yoy"] == (86 / 46 - 1) * 100
    assert breadth["positive_count"] == 4
    state, _, coverage = classify_ai_capex(aggregate, breadth)
    assert state == "확대 강함"
    assert coverage == 1


def test_capex_aggregate_leaves_partial_reporting_quarter_empty():
    companies = [
        company("a", [("2025-06-30", 10), ("2026-06-30", 20)]),
        company("b", [("2025-06-30", 10), ("2026-06-30", 20)]),
        company("c", [("2025-06-30", 10), ("2026-06-30", 20)]),
        company("d", [("2025-06-30", 10)], latest_period="2025-06-30"),
    ]

    aggregate, breadth = build_capex_aggregate(
        companies, today=date(2026, 8, 19)
    )

    assert aggregate["latest_period"] == "2026-06-30"
    assert aggregate["complete"] is False
    assert aggregate["latest_value"] is None
    assert aggregate["coverage"] == .75
    assert aggregate["last_complete_period"] == "2025-06-30"
    state, reason, coverage = classify_ai_capex(aggregate, breadth)
    assert state == "판정 불가"
    assert "전체" in reason
    assert coverage == .75


def test_capex_aggregate_does_not_use_previous_array_item_as_qoq():
    companies = [
        company(f"c{index}", [
            ("2025-06-30", 10),
            ("2025-12-31", 12),
            ("2026-06-30", 20),
        ])
        for index in range(4)
    ]

    aggregate, _ = build_capex_aggregate(companies, today=date(2026, 8, 19))

    assert aggregate["qoq"] is None
    assert aggregate["yoy"] == 100


def test_capex_aggregate_requires_current_data_and_full_universe():
    stale_companies = [
        company(f"c{index}", [("2024-12-31", 10), ("2025-12-31", 20)])
        for index in range(4)
    ]
    stale, breadth = build_capex_aggregate(
        stale_companies, today=date(2026, 8, 19)
    )
    assert stale["is_stale"] is True
    assert classify_ai_capex(stale, breadth)[0] == "판정 불가"

    expanded_universe, _ = build_capex_aggregate(
        stale_companies, expected=5, today=date(2026, 1, 15)
    )
    assert expanded_universe["coverage"] == .8
    assert expanded_universe["complete"] is False


def test_capex_aggregate_calculates_ttm_yoy_from_eight_exact_quarters():
    periods = [
        "2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30",
        "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30",
    ]
    companies = [
        company(f"c{index}", [(period, 10 if period < "2025-09-30" else 20) for period in periods])
        for index in range(4)
    ]

    aggregate, _ = build_capex_aggregate(companies, today=date(2026, 8, 19))

    assert aggregate["ttm"] == 320
    assert aggregate["ttm_yoy"] == 100
