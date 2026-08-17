from app.services.regime_sec import classify_ai_capex, normalize_quarters


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


def test_ai_capex_requires_three_comparable_companies():
    state, _, coverage = classify_ai_capex([
        {"latest_capex": 1, "yoy": 30}, {"latest_capex": 1, "yoy": 20}
    ])
    assert state == "판정 불가"
    assert coverage == .5


def test_ai_capex_detects_broad_strong_expansion_deterministically():
    state, _, coverage = classify_ai_capex([
        {"latest_capex": 1, "yoy": 40}, {"latest_capex": 1, "yoy": 30},
        {"latest_capex": 1, "yoy": 20}, {"latest_capex": 1, "yoy": 15},
    ])
    assert state == "확대 강함"
    assert coverage == 1


def test_ai_capex_flags_broad_contraction_for_review():
    state, reason, _ = classify_ai_capex([
        {"latest_capex": 1, "yoy": -10}, {"latest_capex": 1, "yoy": -5},
        {"latest_capex": 1, "yoy": 8}, {"latest_capex": 1, "yoy": 2},
    ])
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


def test_ai_capex_excludes_stale_company_from_coverage():
    state, _, coverage = classify_ai_capex([
        {"latest_capex": 1, "yoy": 40, "is_stale": True},
        {"latest_capex": 1, "yoy": 30},
        {"latest_capex": 1, "yoy": 20},
        {"latest_capex": 1, "yoy": 15},
    ])

    assert state != "확대 강함"
    assert coverage == .75
