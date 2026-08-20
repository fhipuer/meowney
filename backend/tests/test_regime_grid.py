import io
from datetime import datetime

import pytest
from openpyxl import Workbook

from app.services.regime_grid import (
    GridInfrastructureService,
    find_latest_lbnl_workbook,
    parse_lbnl_queue_workbook,
    parse_pudl_transmission_rows,
)


def test_latest_lbnl_workbook_uses_data_vintage_not_link_order():
    html = """
    <a href="/files/lbnl_ix_queue_data_file_thru2024.xlsx">Queued Up data</a>
    <a href="https://eta.lbl.gov/lbnl_ix_queue_data_file_thru2025.xlsx">Data file</a>
    """

    url, observed = find_latest_lbnl_workbook(html, "https://emp.lbl.gov/publications/x")

    assert url == "https://eta.lbl.gov/lbnl_ix_queue_data_file_thru2025.xlsx"
    assert observed == "2025-12-31"


def _lbnl_fixture() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "03. Complete Queue Data"
    sheet.append(["metadata"])
    sheet.append([
        "q_id", "q_status", "q_date", "on_date", "wd_date", "ia_date",
        "IA_phase_clean", "type_1", "type_2", "type_3", "mw_1", "mw_2",
        "mw_3", "q_year",
    ])
    # One hybrid: generation and storage components are counted once each.
    sheet.append([
        "A", "active", datetime(2020, 1, 1), None, None, datetime(2024, 1, 1),
        "IA Executed", "Solar", "Battery", None, 100, 50, None, 2020,
    ])
    sheet.append([
        "B", "active", datetime(2024, 1, 1), None, None, None,
        "In Progress", "Wind", None, None, 40, None, None, 2024,
    ])
    sheet.append([
        "C", "suspended", datetime(2023, 1, 1), None, None, None,
        "Suspended", "Solar", None, None, 30, None, None, 2023,
    ])
    sheet.append([
        "D", "operational", datetime(2020, 1, 1), datetime(2025, 1, 1), None,
        datetime(2024, 1, 1), "IA Executed", "Gas", None, None, 200, None, None, 2020,
    ])
    sheet.append([
        "E", "withdrawn", datetime(2021, 1, 1), None, datetime(2024, 1, 1),
        None, "Withdrawn", "Solar", None, None, 80, None, None, 2021,
    ])
    # A source workbook can contain dates beyond its declared vintage. They
    # must not leak into the published annual history.
    sheet.append([
        "F", "withdrawn", datetime(2025, 1, 1), None, datetime(2026, 1, 1),
        None, "Withdrawn", "Solar", None, None, 60, None, None, 2025,
    ])
    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_lbnl_parser_separates_active_generation_storage_and_annual_flows():
    rows = parse_lbnl_queue_workbook(
        _lbnl_fixture(), source_url="https://example.test/queue.xlsx",
        observation_date="2025-12-31",
    )
    by_series = {}
    for row in rows:
        by_series.setdefault(row["series_id"], []).append(row)

    assert by_series["us_interconnection_active_queue_total_gw"][0]["value"] == pytest.approx(.19)
    assert by_series["us_interconnection_active_queue_generation_gw"][0]["value"] == pytest.approx(.14)
    assert by_series["us_interconnection_active_queue_storage_gw"][0]["value"] == pytest.approx(.05)
    assert by_series["us_interconnection_ia_executed_active_gw"][0]["value"] == pytest.approx(.15)
    assert by_series["us_interconnection_suspended_queue_gw"][0]["value"] == pytest.approx(.03)
    assert by_series["us_interconnection_completed_annual_gw"][0]["value"] == pytest.approx(.2)
    assert by_series["us_interconnection_withdrawn_annual_gw"][0]["value"] == pytest.approx(.08)
    assert all(
        row["observation_date"] <= "2025-12-31"
        for row in by_series["us_interconnection_withdrawn_annual_gw"]
    )
    assert by_series["us_interconnection_recent_ir_to_cod_median_years"][0]["value"] == pytest.approx(5, abs=.01)
    assert "데이터센터 부하 접속 대기열이 아닙니다" in (
        by_series["us_interconnection_active_queue_total_gw"][0]["dimensions"]["scope_note_ko"]
    )


def _pudl_row(year, reporter, additions, account="350", **overrides):
    row = {
        "report_year": year,
        "utility_id_pudl": reporter,
        "utility_type": "electric",
        "plant_status": "in_service",
        "record_id": f"{year}-{reporter}-{account}-{additions}",
        "additions": additions,
        "ferc_account": account,
        "ferc_account_label": "land_and_land_rights_transmission_plant",
        "row_type_xbrl": "reported_value",
    }
    row.update(overrides)
    return row


def test_pudl_parser_filters_subtotals_and_calculates_continuity_and_cagr():
    rows = [
        _pudl_row(2022, 1, 100),
        _pudl_row(2022, 2, 100, account="359.1"),
        _pudl_row(2024, 1, 200),
        _pudl_row(2024, 2, 100),
        _pudl_row(2025, 1, 200),
        _pudl_row(2025, 1, 200),  # identical duplicate is ignored
        _pudl_row(2025, 3, 200),
        _pudl_row(2025, 4, None),  # filed schedule with no additions still covers reporter
        _pudl_row(2025, 3, 999, account="360"),
        _pudl_row(2025, 3, 999, row_type_xbrl="calculated_value"),
        _pudl_row(2025, 3, 999, account="359", ferc_account_label="total transmission plant"),
    ]
    observations = parse_pudl_transmission_rows(rows)
    keyed = {(row["series_id"], row["observation_date"]): row for row in observations}

    assert keyed[("us_transmission_plant_additions_usd", "2025-12-31")]["value"] == 400
    assert keyed[("us_transmission_plant_reporter_count", "2025-12-31")]["value"] == 3
    assert keyed[("us_transmission_current_reporter_prior_year_coverage_pct", "2025-12-31")]["value"] == pytest.approx(100 / 3)
    assert keyed[("us_transmission_prior_reporter_retention_pct", "2025-12-31")]["value"] == 50
    assert keyed[("us_transmission_plant_additions_3y_cagr_pct", "2025-12-31")]["value"] == pytest.approx(25.992, rel=.001)
    assert keyed[("us_transmission_plant_additions_like_for_like_3y_cagr_pct", "2025-12-31")]["value"] == pytest.approx(25.992, rel=.001)


class FakeRepo:
    def __init__(self):
        self.rows = {}
        self.feed_status = {}

    def is_due(self, *_args, **_kwargs):
        return True

    def save_observations(self, _source, _dataset, rows):
        for row in rows:
            self.rows.setdefault(row["series_id"], []).append({
                **row, "fetched_at": row.get("fetched_at"),
            })
        return len(rows)

    def save_status(self, feed_id, _source, _dataset, attempted_at, *, success, item_count=0, error=None, status=None):
        self.feed_status[feed_id] = {
            "status": status or ("success" if success else "failed"),
            "last_attempted_at": attempted_at,
            "last_success_at": attempted_at if success else None,
            "item_count": item_count,
            "error": error,
        }

    def status(self, feed_id):
        return self.feed_status.get(feed_id)

    def series(self, series_id, *, limit=None):
        rows = sorted(self.rows.get(series_id, []), key=lambda row: row["observation_date"])
        return rows[-limit:] if limit else rows


@pytest.mark.asyncio
async def test_grid_refresh_preserves_one_good_axis_when_other_source_fails(monkeypatch):
    service = GridInfrastructureService()
    service.repo = FakeRepo()
    client_options = {}

    async def lbnl(_client):
        return [{
            "series_id": "us_interconnection_active_queue_total_gw",
            "observation_date": "2025-12-31", "value": 2000, "unit": "GW",
            "source_url": "https://example.test/queue.xlsx", "dimensions": {},
        }]

    async def pudl(_client):
        raise RuntimeError("temporary PUDL outage")

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr(service, "_fetch_lbnl", lbnl)
    monkeypatch.setattr(service, "_fetch_pudl", pudl)
    def fake_client(**kwargs):
        client_options.update(kwargs)
        return FakeClient()

    monkeypatch.setattr("app.services.regime_grid.httpx.AsyncClient", fake_client)

    result = await service.refresh(force=True)

    assert result["status"] == "partial"
    assert result["saved"] == 1
    assert result["sources"]["lbnl"]["status"] == "success"
    assert result["sources"]["pudl"]["status"] == "failed"
    assert service.repo.series("us_interconnection_active_queue_total_gw")[-1]["value"] == 2000
    assert client_options["headers"]["User-Agent"].startswith("Mozilla/5.0")


def test_grid_summary_keeps_provenance_scope_and_raw_history():
    service = GridInfrastructureService()
    service.repo = FakeRepo()
    service.repo.save_observations("lbnl", "queue", [{
        "series_id": "us_interconnection_active_queue_total_gw",
        "observation_date": "2025-12-31", "value": 2000, "unit": "GW",
        "source_url": "https://example.test", "dimensions": {},
    }])
    service.repo.save_observations("pudl", "ferc1", [{
        "series_id": "us_transmission_plant_additions_usd",
        "observation_date": "2025-12-31", "value": 35e9, "unit": "USD",
        "source_url": "https://example.test", "dimensions": {},
    }])
    service.repo.save_observations("lbnl", "queue", [{
        "series_id": "us_interconnection_withdrawn_annual_gw",
        "observation_date": "2026-12-31", "value": 99, "unit": "GW",
        "source_url": "https://example.test", "dimensions": {},
    }])

    summary = service.summary()

    assert summary["interconnection_axis"]["metrics"]["active_queue_gw"]["value"] == 2000
    assert "데이터센터 부하" in summary["interconnection_axis"]["provenance"]["scope_note"]
    assert summary["transmission_investment_axis"]["history"][-1]["additions_usd"] == 35e9
    assert summary["interconnection_axis"]["history"] == []
