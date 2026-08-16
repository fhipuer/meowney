from app.services.regime_catalog import display_history, display_metrics, indicator_role


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
