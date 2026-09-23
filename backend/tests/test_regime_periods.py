import pytest

from app.services.regime_periods import (
    continuity_gaps,
    dated_values,
    period_percent_change,
)


def row(month: str, value: float) -> dict:
    return {"observation_date": f"{month}-01", "value": value}


def test_yoy_uses_same_calendar_month_when_an_intermediate_release_is_missing():
    observations = [
        row("2025-07", 322.169),
        row("2025-08", 323.291),
        row("2025-09", 324.000),
        # 2025-10 is intentionally absent.
        row("2025-11", 325.000),
        row("2025-12", 326.000),
        row("2026-01", 327.000),
        row("2026-02", 328.000),
        row("2026-03", 329.000),
        row("2026-04", 330.000),
        row("2026-05", 331.000),
        row("2026-06", 332.000),
        row("2026-07", 333.000),
        row("2026-08", 334.131),
    ]

    assert period_percent_change(observations, "monthly", 12) == pytest.approx(
        (334.131 / 323.291 - 1) * 100
    )
    assert continuity_gaps(observations, "monthly") == ["2025-10"]


def test_yoy_is_unavailable_instead_of_substituting_the_wrong_month():
    observations = [row("2025-07", 322.169), row("2026-08", 334.131)]

    assert period_percent_change(observations, "monthly", 12) is None


def test_prepared_series_is_reused_without_reparsing_dates(monkeypatch):
    observations = [row(f"2025-{month:02d}", 100 + month) for month in range(1, 13)]
    prepared = dated_values(observations)

    def fail_if_reparsed(_row):
        raise AssertionError("prepared observations must not be reparsed")

    monkeypatch.setattr("app.services.regime_periods._row_date", fail_if_reparsed)

    assert period_percent_change(prepared, "monthly", 1) == pytest.approx((112 / 111 - 1) * 100)
