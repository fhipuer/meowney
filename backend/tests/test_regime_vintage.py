from datetime import date

from app.db.sqlite_client import SQLiteClient
from app.services.regime_vintage import (
    RegimeVintageRepository,
    VintageObservation,
    initial_release_params,
    parse_initial_release_observations,
    parse_vintage_date_observations,
    recent_vintage_params,
)


def repository(tmp_path):
    return RegimeVintageRepository(SQLiteClient(tmp_path / "vintage.db"))


def test_initial_release_request_is_explicit():
    params = initial_release_params("GDPC1", "test-key")
    assert params["output_type"] == 4
    assert params["sort_order"] == "asc"
    assert params["file_type"] == "json"
    assert params["realtime_start"] == "1776-07-04"
    assert params["realtime_end"] == "9999-12-31"


def test_parser_keeps_availability_separate_from_observation_date():
    rows = parse_initial_release_observations("us_gdp", {"observations": [
        {"date": "2026-04-01", "realtime_start": "2026-07-30",
         "realtime_end": "2026-08-26", "value": "23123.4"},
        {"date": "2026-07-01", "realtime_start": "2026-10-29",
         "realtime_end": "2026-11-24", "value": "."},
    ]}, "2026-08-16T00:00:00+00:00")
    assert len(rows) == 1
    assert rows[0].observation_date == "2026-04-01"
    assert rows[0].available_from == "2026-07-30"
    assert rows[0].release_date is None
    assert rows[0].vintage_kind == "initial"


def test_recent_vintage_parser_preserves_same_release_levels():
    params = recent_vintage_params(
        "PAYEMS", "test-key", ["2026-07-02", "2026-08-07"], "2026-04-01"
    )
    rows = parse_vintage_date_observations(
        "us_payrolls",
        "PAYEMS",
        {"observations": [
            {
                "date": "2026-05-01",
                "PAYEMS_20260702": "158927",
                "PAYEMS_20260807": "158861",
            }
        ]},
        "2026-08-16T00:00:00+00:00",
    )

    assert params["output_type"] == 2
    assert params["vintage_dates"] == "2026-07-02,2026-08-07"
    assert [(row.available_from, row.value, row.vintage_kind) for row in rows] == [
        ("2026-07-02", 158927, "revision"),
        ("2026-08-07", 158861, "revision"),
    ]


def test_as_of_excludes_observation_before_it_was_available(tmp_path):
    repo = repository(tmp_path)
    repo.save([VintageObservation(
        indicator_id="us_gdp", observation_date="2026-04-01", value=23123.4,
        available_from="2026-07-30", available_until=None,
        fetched_at="2026-08-16T00:00:00+00:00",
    )])
    assert repo.series_as_of("us_gdp", "2026-07-09") == []
    assert repo.series_as_of("us_gdp", date(2026, 7, 30))[0]["value"] == 23123.4


def test_as_of_selects_correct_revision_interval(tmp_path):
    repo = repository(tmp_path)
    common = dict(indicator_id="us_payrolls", observation_date="2026-07-01",
                  fetched_at="2026-09-01T00:00:00+00:00")
    repo.save([
        VintageObservation(**common, value=100.0, available_from="2026-08-07",
                           available_until="2026-09-03", vintage_kind="initial"),
        VintageObservation(**common, value=80.0, available_from="2026-09-04",
                           available_until=None, vintage_kind="revision"),
    ])
    assert repo.series_as_of("us_payrolls", "2026-08-06") == []
    assert repo.series_as_of("us_payrolls", "2026-08-20")[0]["value"] == 100.0
    assert repo.series_as_of("us_payrolls", "2026-09-10")[0]["value"] == 80.0


def test_duplicate_fetch_is_idempotent(tmp_path):
    repo = repository(tmp_path)
    row = VintageObservation(
        indicator_id="core_cpi", observation_date="2026-07-01", value=321.5,
        available_from="2026-08-12", available_until=None,
        fetched_at="2026-08-16T00:00:00+00:00",
    )
    assert repo.save([row]) == 1
    assert repo.save([row]) == 0
    assert len(repo.series_as_of("core_cpi", "2026-08-16")) == 1
