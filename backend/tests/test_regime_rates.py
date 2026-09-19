from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.services.regime_rates import (
    POST_INVERSION_MEMORY_DAYS,
    aligned_ten_year_changes,
    calculate_rate_model,
    recession_probability_12m,
)


def daily_signal(
    key: str,
    values: list[float],
    *,
    start: date = date(2025, 1, 1),
    offset_days: int = 0,
) -> dict:
    return {
        "id": key,
        "name": key,
        "frequency": "daily",
        "history": [
            {
                "date": (start + timedelta(days=index + offset_days)).isoformat(),
                "value": value,
            }
            for index, value in enumerate(values)
        ],
    }


def monthly_signal(key: str, values: list[float], *, start_year: int = 2025) -> dict:
    history = []
    for index, value in enumerate(values):
        year, month_index = divmod(start_year * 12 + index, 12)
        history.append({"date": f"{year:04d}-{month_index + 1:02d}-01", "value": value})
    return {"id": key, "name": key, "frequency": "monthly", "history": history}


def rates_fixture(*, curve: list[float] | None = None) -> list[dict]:
    points = len(curve) if curve is not None else 90
    return [
        daily_signal("us10y", [4.25] * points),
        daily_signal("us3m", [4.10] * points),
        daily_signal("tips10y", [2.00] * points),
        daily_signal("bei10y", [2.25] * points),
        daily_signal("term_premium", [0.80] * points),
        daily_signal("curve10y3m", curve or [0.15] * points),
        daily_signal("curve2s10s", [0.10] * points),
    ]


def with_long_end(
    fixture: list[dict],
    *,
    us10y: list[float],
    us30y: list[float],
    tips10y: list[float],
    tips30y: list[float],
) -> list[dict]:
    replacements = {
        "us10y": daily_signal("us10y", us10y),
        "tips10y": daily_signal("tips10y", tips10y),
    }
    result = [replacements.get(item["id"], item) for item in fixture]
    return result + [
        daily_signal("us30y", us30y),
        daily_signal("tips30y", tips30y),
    ]


def test_ny_fed_probability_matches_published_chart_example() -> None:
    # NY Fed's published parameters map a 0.62615%p spread to 17.6275%.
    assert recession_probability_12m(0.62615) == pytest.approx(17.6275, abs=0.0001)


def test_recession_probability_is_monotonic_as_curve_inverts() -> None:
    assert recession_probability_12m(-1.0) > recession_probability_12m(0.0)
    assert recession_probability_12m(0.0) > recession_probability_12m(1.0)


def test_policy_layer_prefers_current_target_range_over_monthly_effective_average() -> None:
    fixture = rates_fixture() + [
        daily_signal("fed_target_lower", [3.75]),
        daily_signal("fed_target_upper", [4.00]),
        monthly_signal("fedfunds", [3.63]),
        monthly_signal("core_pce", [100 + index * .25 for index in range(13)]),
    ]

    policy = calculate_rate_model(fixture)["policy"]

    assert policy["policy_rate_basis"] == "target_range_midpoint"
    assert policy["target_midpoint"] == 3.875
    assert policy["fed_funds"] == 3.875
    assert policy["effective_fed_funds_monthly_average"] == 3.63


def test_one_day_raw_inversion_does_not_become_a_monthly_curve_signal() -> None:
    model = calculate_rate_model(rates_fixture(curve=[0.50] * 20 + [-0.50]))
    curve = model["yield_curve"]
    assert curve["monthly_average_10y3m"] > 0
    assert curve["state"] == "정상 우상향"
    assert curve["inversion_days"] == 0


def test_persistent_monthly_average_inversion_creates_one_leading_cluster() -> None:
    fixture = rates_fixture(curve=[-0.50] * 50)
    fixture = [
        {**item, "history": list(reversed(item["history"]))}
        for item in reversed(fixture)
    ]
    model = calculate_rate_model(fixture)
    curve = model["yield_curve"]
    assert curve["state"] == "역전 지속"
    assert curve["recession_probability_12m"] > 40
    assert curve["confirmation"] == "비역전"
    assert curve["evidence_cluster"] == "yield_curve"
    assert curve["score"] <= 60


def test_10y2y_confirms_but_does_not_add_a_second_curve_score() -> None:
    without_confirmation = calculate_rate_model(rates_fixture(curve=[-0.50] * 50))
    fixture = rates_fixture(curve=[-0.50] * 50)
    fixture = [
        daily_signal("curve2s10s", [-0.30] * 50)
        if item["id"] == "curve2s10s" else item
        for item in fixture
    ]
    with_confirmation = calculate_rate_model(fixture)
    assert with_confirmation["yield_curve"]["confirmation"] == "동반 역전"
    assert with_confirmation["yield_curve"]["score"] <= 60
    assert (
        with_confirmation["yield_curve"]["score"]
        - without_confirmation["yield_curve"]["score"]
    ) <= 5


def test_curve_risk_persists_after_uninversion_and_then_expires() -> None:
    recent = calculate_rate_model(
        rates_fixture(curve=[-0.80] * 40 + [1.20] * 35),
    )["yield_curve"]
    assert recent["state"] == "역전 후 관찰"
    assert recent["inversion_memory"] is True
    assert recent["score"] >= 45

    expired = calculate_rate_model(
        rates_fixture(
            curve=[-0.80] * 40 + [1.20] * (POST_INVERSION_MEMORY_DAYS + 40),
        ),
    )["yield_curve"]
    assert expired["state"] == "정상 우상향"
    assert expired["inversion_memory"] is False


@pytest.mark.parametrize(
    ("us10y", "us3m", "expected"),
    [
        ([4.50 - index * 0.005 for index in range(21)],
         [5.00 - index * 0.020 for index in range(21)], "단기금리 하락 주도"),
        ([4.00 + index * 0.020 for index in range(21)],
         [4.00 + index * 0.005 for index in range(21)], "장기금리 상승 주도"),
    ],
)
def test_resteepening_driver_distinguishes_short_and_long_rate_moves(
    us10y: list[float], us3m: list[float], expected: str,
) -> None:
    fixture = rates_fixture(curve=[0.20] * 21)
    fixture = [
        daily_signal("us10y", us10y) if item["id"] == "us10y"
        else daily_signal("us3m", us3m) if item["id"] == "us3m"
        else item
        for item in fixture
    ]
    assert calculate_rate_model(fixture)["yield_curve"]["steepening"]["state"] == expected


def test_term_premium_is_context_and_zero_is_not_coerced() -> None:
    base = rates_fixture()
    zero_term = [
        daily_signal("term_premium", [0.0] * 90)
        if item["id"] == "term_premium" else item
        for item in base
    ]
    high_term = [
        daily_signal("term_premium", [1.80] * 90)
        if item["id"] == "term_premium" else item
        for item in base
    ]
    zero = calculate_rate_model(zero_term)
    high = calculate_rate_model(high_term)
    assert zero["long_rates"]["term_premium"] == 0.0
    assert zero["long_rates"]["term_premium_role"] == "decomposition_context"
    assert zero["long_rates"]["score"] == high["long_rates"]["score"]
    assert zero["score"] == high["score"]


def test_ten_year_changes_use_common_dates_only() -> None:
    signals = {
        item["id"]: item
        for item in [
            daily_signal("us10y", [4.0 + index * 0.01 for index in range(31)]),
            daily_signal(
                "tips10y", [1.5 + index * 0.01 for index in range(30)],
                offset_days=1,
            ),
            daily_signal("bei10y", [2.5] * 31),
        ]
    }
    result = aligned_ten_year_changes(signals, 20)
    assert result is not None
    assert result["start_date"] == date(2025, 1, 11).isoformat()
    assert result["end_date"] == date(2025, 1, 31).isoformat()
    assert result["changes"]["us10y"] == pytest.approx(0.20)
    assert result["changes"]["tips10y"] == pytest.approx(0.20)


def test_real_rate_and_inflation_shocks_have_distinct_thresholds() -> None:
    real_shock = rates_fixture()
    real_shock = [
        daily_signal("tips10y", [1.50] * 70 + [2.05] * 20)
        if item["id"] == "tips10y" else item
        for item in real_shock
    ]
    inflation_shock = rates_fixture()
    inflation_shock = [
        daily_signal("us10y", [4.00] * 70 + [4.55] * 20)
        if item["id"] == "us10y"
        else daily_signal("bei10y", [2.00] * 70 + [2.35] * 20)
        if item["id"] == "bei10y"
        else item
        for item in inflation_shock
    ]
    assert calculate_rate_model(real_shock)["recent_shock"]["score"] == 80
    assert calculate_rate_model(inflation_shock)["recent_shock"]["score"] == 70


def test_long_end_duration_stress_confirms_a_bounded_rate_shock() -> None:
    fixture = with_long_end(
        rates_fixture(),
        us10y=[4.55] * 70 + [4.72] * 20,
        us30y=[5.06] * 70 + [5.31] * 20,
        tips10y=[2.31] * 70 + [2.44] * 20,
        tips30y=[2.87] * 70 + [3.06] * 20,
    )

    model = calculate_rate_model(fixture)
    duration = model["duration_stress"]

    assert duration["label"] == "장기 듀레이션 부담 경계"
    assert duration["score"] == 35
    assert duration["bounded_shock_floor"] == 35
    assert duration["spread_30y10y"] == pytest.approx(.59)
    assert duration["driver"] == "30Y 실질금리 주도"
    assert duration["confirmation_count_5d"] == 5
    assert model["recent_shock"]["duration_floor"] == 35
    assert model["recent_shock"]["direction"] == "긴축"


def test_extreme_long_end_stress_cannot_force_more_than_a_40_point_shock_floor() -> None:
    fixture = with_long_end(
        rates_fixture(),
        us10y=[4.40] * 70 + [4.70] * 20,
        us30y=[4.90] * 70 + [5.35] * 20,
        tips10y=[2.20] * 70 + [2.35] * 20,
        tips30y=[2.75] * 70 + [3.10] * 20,
    )

    model = calculate_rate_model(fixture)

    assert model["duration_stress"]["score"] == 60
    assert model["duration_stress"]["bounded_shock_floor"] == 40
    assert model["recent_shock"]["duration_floor"] == 40
    assert model["recent_shock"]["score"] == 40


def test_long_end_recent_shock_requires_two_of_three_observations() -> None:
    one_hit = with_long_end(
        rates_fixture(),
        us10y=[4.50] * 90,
        us30y=[4.90] * 85 + [5.05] * 5,
        tips10y=[2.30] * 90,
        tips30y=[2.90] * 85 + [3.04] * 4 + [3.06],
    )
    two_hits = with_long_end(
        rates_fixture(),
        us10y=[4.50] * 90,
        us30y=[4.90] * 85 + [5.05] * 5,
        tips10y=[2.30] * 90,
        tips30y=[2.90] * 85 + [3.04] * 3 + [3.06] * 2,
    )

    one = calculate_rate_model(one_hit)["duration_stress"]
    two = calculate_rate_model(two_hits)["duration_stress"]

    assert one["level_label"] == "장기채 부담 높음"
    assert one["raw_score"] == 35
    assert one["recent_confirmation_count_3d"] == 1
    assert one["recent_confirmed"] is False
    assert one["score"] == 0
    assert two["recent_confirmation_count_3d"] == 2
    assert two["recent_confirmed"] is True
    assert two["score"] == 35


def test_missing_optional_30y_data_does_not_reduce_primary_rate_coverage() -> None:
    model = calculate_rate_model(rates_fixture())

    assert model["duration_stress"]["label"] == "판정 불가"
    assert model["duration_stress"]["score"] is None
    assert model["coverage"] == .75


def test_curve_alone_cannot_create_severe_rate_domain_pressure() -> None:
    fixture = rates_fixture(curve=[-2.0] * 90)
    fixture = [item for item in fixture if item["id"] not in {"tips10y", "term_premium"}]
    model = calculate_rate_model(fixture)
    assert model["driver"] == "수익률곡선 선행위험"
    assert model["score"] == 60
    assert model["label"] == "제한적"


def test_rate_model_is_independent_from_signal_and_history_order() -> None:
    fixture = rates_fixture(curve=[-0.20] * 90)
    reversed_fixture = [
        {**item, "history": list(reversed(item["history"]))}
        for item in reversed(fixture)
    ]
    assert calculate_rate_model(fixture) == calculate_rate_model(reversed_fixture)
