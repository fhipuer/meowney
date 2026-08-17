from app.services.regime_catalog import decision_chart, display_history, display_metrics, indicator_role


def observations(count):
    return [
        {"observation_date": f"2026-01-{(index % 28) + 1:02d}", "value": index + 1}
        for index in range(count)
    ]


def test_display_history_uses_frequency_specific_window():
    rows = observations(300)
    assert len(display_history(rows, "daily")) == 252
    assert len(display_history(rows, "weekly")) == 104
    assert len(display_history(rows, "monthly")) == 60
    assert len(display_history(rows, "quarterly")) == 40


def test_rate_changes_are_basis_points_not_percent_returns():
    values = [4.0] * 21 + [4.25]
    metrics = display_metrics("us10y", "daily", values)
    assert metrics[0] == {"label": "1개월", "value": 25.0, "unit": "bp", "kind": "delta"}


def test_inflation_metrics_show_yoy_and_annualized_rate():
    values = [100 + index * .2 for index in range(13)]
    metrics = display_metrics("core_cpi", "monthly", values)
    assert [item["label"] for item in metrics] == ["전년 대비", "3개월 연율", "직전 발표"]


def test_indicator_role_separates_regime_trigger_and_context():
    assert indicator_role("core_pce")["usage"] == "regime"
    assert indicator_role("market_vix")["usage"] == "trigger"
    assert indicator_role("market_copper")["usage"] == "display"
    assert indicator_role("us3m")["usage"] == "display"


def test_inflation_decision_chart_uses_yoy_and_three_month_annualized_not_index_level():
    rows = [
        {"observation_date": f"2025-{(index % 12) + 1:02d}-01", "value": 100 + index * .3}
        for index in range(18)
    ]

    chart = decision_chart("core_cpi", rows)

    assert [item["key"] for item in chart["series"]] == ["yoy", "annualized_3m"]
    assert "value" not in chart["points"][-1]
    assert chart["reference_lines"] == [{"value": 2, "label": "물가 목표 2%"}]


def test_payroll_decision_chart_uses_monthly_change_and_three_month_average():
    rows = [
        {"observation_date": f"2026-0{index + 1}-01", "value": value}
        for index, value in enumerate([1000, 1100, 1220, 1300, 1390])
    ]

    chart = decision_chart("us_payrolls", rows)

    assert chart["points"][-1]["monthly_change"] == 90
    assert chart["points"][-1]["average_3m"] == 96.667


def test_unemployment_metrics_and_chart_use_percentage_point_change():
    values = [4.0, 4.1, 4.15, 4.3]

    metrics = display_metrics("us_unemployment", "monthly", values)
    chart = decision_chart("us_unemployment", [
        {"observation_date": f"2026-0{index + 1}-01", "value": value}
        for index, value in enumerate(values)
    ])

    assert metrics[1] == {"label": "3개월", "value": .3, "unit": "%p", "kind": "delta"}
    assert chart["points"][-1]["delta_3m"] == .3
    assert chart["reference_lines"][-1]["value"] == .3


def test_credit_chart_exposes_absolute_thresholds():
    chart = decision_chart("hy_oas", [
        {"observation_date": "2026-08-01", "value": 3.8},
        {"observation_date": "2026-08-02", "value": 4.1},
    ])

    assert chart["series"] == [{"key": "value", "label": "현재 수준"}]
    assert [item["value"] for item in chart["reference_lines"]] == [4, 5]
