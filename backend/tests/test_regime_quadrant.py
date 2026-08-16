from datetime import date

from app.services.regime_quadrant import calculate_us_macro_quadrant


def monthly_dates(count=60):
    result = []
    year, month = 2021, 1
    for _ in range(count):
        result.append(date(year, month, 1).isoformat())
        month += 1
        if month == 13:
            year, month = year + 1, 1
    return result


def series(key, values, *, frequency="monthly"):
    dates = monthly_dates(len(values))
    return {"id": key, "name": key, "frequency": frequency, "history": [
        {"date": day, "value": value} for day, value in zip(dates, values)
    ]}


def compound(start, rates):
    values = [start]
    for rate in rates:
        values.append(values[-1] * (1 + rate))
    return values


def macro_fixture():
    steady_then_fast = [.001] * 51 + [.004] * 8
    inflation_reacceleration = [.002] * 51 + [.006] * 8
    return [
        series("us_unemployment", [5.0] * 52 + [4.9, 4.8, 4.6, 4.4, 4.2, 4.0, 3.9, 3.8]),
        series("us_payrolls", compound(150_000, steady_then_fast)),
        series("us_retail", compound(500_000, steady_then_fast)),
        series("us_indpro", compound(100, steady_then_fast)),
        series("us_gdp", compound(20_000, [.005] * 51 + [.015] * 8), frequency="quarterly"),
        series("core_cpi", compound(300, inflation_reacceleration)),
        series("core_pce", compound(120, inflation_reacceleration)),
        series("cpi", compound(300, inflation_reacceleration)),
        series("ppi", compound(250, inflation_reacceleration)),
        series("wages", compound(30, inflation_reacceleration)),
    ]


def test_same_macro_data_produces_identical_environment():
    fixture = macro_fixture()
    assert calculate_us_macro_quadrant(fixture) == calculate_us_macro_quadrant(list(reversed(fixture)))


def test_growth_improvement_and_inflation_reacceleration_land_in_reflation():
    result = calculate_us_macro_quadrant(macro_fixture())
    current = result["points"][-1]
    assert current["growth"]["coordinate"] > 10
    assert current["inflation"]["coordinate"] > 10
    assert result["label"] == "리플레이션·긴축 위험"
    assert result["scope_status"] == "macro_only"
    assert result["environment_quadrant"] == "firm_growth_elevated_inflation"
    assert "확장" in result["environment_label"]
    assert "물가" in result["environment_label"]
    assert result["environment_point"] == {
        "growth": result["growth_level"]["score"],
        "inflation": result["inflation_level"]["score"],
        "quadrant": "firm_growth_elevated_inflation",
        "label": result["environment_label"],
        "semantics": "absolute_macro_level",
    }
    assert result["momentum_vector"]["dx"] == current["growth"]["coordinate"]
    assert result["momentum_vector"]["dy"] == current["inflation"]["coordinate"]
    assert result["momentum_vector"]["semantics"] == "relative_recent_pressure"
    assert result["momentum_vector"]["is_displacement"] is False
    assert result["momentum_vector"]["trajectory_available"] is False
    assert result["pressure_vector"] == result["momentum_vector"]


def test_missing_axis_is_explicitly_unavailable_not_zero():
    result = calculate_us_macro_quadrant([series("core_cpi", compound(300, [.002] * 59))])
    current = result["points"][-1]
    assert current["growth"]["coordinate"] is None
    assert current["growth"]["confidence_label"] == "판정 불가"
    assert result["label"] == "판정 불가"
    assert result["environment_quadrant"] == "unavailable"
    assert result["environment_point"]["growth"] is None
    assert result["environment_point"]["semantics"] == "absolute_macro_level"
    assert result["momentum_vector"]["strength_score"] is None
    assert result["pressure_vector"]["strength_score"] is None


def test_low_coverage_reduces_confidence_instead_of_neutralizing_coordinate():
    result = calculate_us_macro_quadrant([
        series("us_unemployment", [5.0] * 52 + [4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2]),
        series("core_cpi", compound(300, [.002] * 51 + [.005] * 8)),
    ])
    current = result["points"][-1]
    assert current["growth"]["coordinate"] is not None
    assert current["growth"]["confidence"] < 40
    assert current["growth"]["confidence_label"] == "판정 불가"


def test_unverified_historical_trajectory_is_hidden_and_contributors_are_stably_ordered():
    result = calculate_us_macro_quadrant(macro_fixture())
    assert [point["label"] for point in result["points"]] == ["현재"]
    assert result["trajectory_status"] == "unavailable_until_pit_history"
    contributors = result["points"][-1]["inflation"]["contributors"]
    assert contributors == sorted(contributors, key=lambda item: (-abs(item["weighted_z"]), item["id"]))


def test_inflation_level_and_momentum_can_disagree_without_canceling_each_other():
    high_but_cooling = [.006] * 56 + [.001] * 3
    result = calculate_us_macro_quadrant([
        series("core_cpi", compound(300, high_but_cooling)),
        series("core_pce", compound(120, high_but_cooling)),
        series("cpi", compound(300, high_but_cooling)),
        series("ppi", compound(250, high_but_cooling)),
        series("wages", compound(30, high_but_cooling)),
    ])
    assert result["inflation_level"]["score"] > 0
    assert result["points"][-1]["inflation"]["coordinate"] < 0


def test_environment_label_uses_levels_while_vector_uses_momentum():
    high_but_cooling = [.006] * 56 + [.001] * 3
    result = calculate_us_macro_quadrant(macro_fixture()[:6] + [
        series("core_cpi", compound(300, high_but_cooling)),
        series("core_pce", compound(120, high_but_cooling)),
        series("cpi", compound(300, high_but_cooling)),
        series("ppi", compound(250, high_but_cooling)),
        series("wages", compound(30, high_but_cooling)),
    ])
    assert "물가" in result["environment_label"]
    assert "높음" in result["environment_label"]
    assert result["momentum_vector"]["dy"] < 0
    assert "물가 완화" in result["momentum_vector"]["direction"]


def test_momentum_strength_is_bounded_and_never_claims_displacement():
    result = calculate_us_macro_quadrant(macro_fixture())
    vector = result["momentum_vector"]
    assert 0 <= vector["strength_score"] <= 1
    assert vector["strength"] in {"미약", "보통", "강함"}
    assert vector["is_displacement"] is False
    assert result["trajectory_status"] == "unavailable_until_pit_history"


def test_quarterly_gdp_uses_quarterly_not_monthly_annualization():
    result = calculate_us_macro_quadrant([
        series("us_gdp", [100, 100.372], frequency="quarterly"),
    ])
    gdp = next(item for item in result["growth_level"]["contributors"] if item["id"] == "us_gdp")
    assert 1.4 < gdp["value"] < 1.6


def test_high_real_long_rate_is_visible_even_without_a_recent_jump():
    fixture = macro_fixture() + [
        series("fedfunds", [3.63] * 60),
        series("tips10y", [2.39] * 60),
        series("us10y", [4.63] * 60),
        series("bei10y", [2.27] * 60),
        series("term_premium", [1.55] * 60),
        series("hy_oas", [2.71] * 60),
        series("ig_oas", [.79] * 60),
        series("nfci", [-.55] * 60),
    ]
    conditions = calculate_us_macro_quadrant(fixture)["financial_conditions"]
    assert conditions["long_rates"]["label"] == "매우 제한적"
    assert conditions["credit"]["label"] == "완화적"
