from datetime import date, timedelta

from app.services.regime_energy import classify_energy_shock


def signal(value, values, *, start_days_ago=90):
    start = date.today() - timedelta(days=start_days_ago)
    return {
        "value": value,
        "observation_date": date.today().isoformat(),
        "history": [
            {"date": (start + timedelta(days=index)).isoformat(), "value": item}
            for index, item in enumerate(values)
        ],
    }


def inventory(values):
    start = date.today() - timedelta(weeks=len(values) - 1)
    return [
        {
            "observation_date": (start + timedelta(weeks=index)).isoformat(),
            "value": item,
        }
        for index, item in enumerate(values)
    ]


def test_price_jump_is_not_called_supply_shock_without_inventory_confirmation():
    result = classify_energy_shock(
        wti=signal(120, [80] * 70 + [82, 85, 90, 96, 105, 120]),
        ovx=signal(55, [25] * 74 + [55]),
        inventory=inventory([400] * 50 + [405, 410, 415, 420, 425]),
    )

    assert result["state"] == "가격·변동성 경계"
    assert result["components"]["inventory"]["inventory_build"] is True
    assert result["trigger"]["severity"] == "medium"
    assert result["trigger"]["evidence"]["physical_confirmation"] is False


def test_price_volatility_and_falling_inventory_confirm_supply_shock():
    result = classify_energy_shock(
        wti=signal(120, [80] * 70 + [82, 85, 90, 96, 105, 120]),
        ovx=signal(55, [25] * 74 + [55]),
        inventory=inventory([450] * 50 + [445, 435, 425, 415, 400]),
    )

    assert result["state"] == "공급충격 확인"
    assert result["severity"] == "high"
    assert result["trigger"]["rule_id"] == "energy.supply_shock.confirmed"


def test_energy_classifier_requires_two_fresh_axes():
    result = classify_energy_shock(wti=None, ovx=None, inventory=inventory([400] * 55))

    assert result["state"] == "판정 제한"
    assert result["trigger"] is None


def test_sustained_yearly_price_pressure_uses_precomputed_full_history_change():
    wti = signal(86, [84] * 40)
    wti["change_12m"] = 35.8
    result = classify_energy_shock(
        wti=wti,
        ovx=signal(49.6, [25] * 39 + [49.6]),
        inventory=inventory([400] * 50 + [405, 410, 415, 420, 425]),
    )

    assert result["state"] == "가격·변동성 경계"
    assert result["components"]["wti"]["change_12m"] == 35.8
