"""Structural U.S. power-grid evidence from LBNL and FERC Form 1.

The two feeds deliberately remain separate.  LBNL describes generation and
storage projects waiting for grid interconnection; it is *not* a data-centre
load interconnection queue.  PUDL normalizes the utility-reported FERC Form 1
Schedule 204 accounts used here to measure nominal transmission-plant
additions.  Neither series, on its own, proves a local grid bottleneck.
"""

from __future__ import annotations

import asyncio
import io
import math
import os
import re
import tempfile
from collections import defaultdict
from datetime import date, datetime, timezone
from statistics import median
from typing import Any, Iterable, Mapping
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from openpyxl import load_workbook

from app.services.regime_external import ExternalObservationRepository, utc_now


LBNL_PUBLICATION_URL = (
    "https://emp.lbl.gov/publications/queued-2026-edition-characteristics"
)
LBNL_FALLBACK_WORKBOOK_URL = (
    "https://eta-publications.lbl.gov/sites/default/files/2026-05/"
    "lbnl_ix_queue_data_file_thru2025.xlsx"
)
PUDL_PARQUET_URL = (
    "https://s3.us-west-2.amazonaws.com/pudl.catalyst.coop/stable/"
    "out_ferc1__yearly_plant_in_service_sched204.parquet"
)
PUDL_DATA_URL = "https://docs.catalyst.coop/pudl/en/stable/data_access.html"

LBNL_FEED_ID = "lbnl_interconnection_queue"
PUDL_FEED_ID = "pudl_ferc1_transmission_investment"
REFRESH_HOURS = 720
LBNL_SCOPE_NOTE = (
    "발전·저장설비의 계통연계 대기열이며 데이터센터 부하 접속 대기열이 아닙니다."
)
TRANSMISSION_SCOPE_NOTE = (
    "FERC Form 1 제출 전기사업자의 송전설비 계정(350~359.x) 명목 추가액입니다. "
    "전 미국의 실질 투자액이나 장비 수주액과 같지 않습니다."
)

_LBNL_REQUIRED_COLUMNS = {
    "q_id", "q_status", "q_date", "on_date", "wd_date", "ia_date",
    "IA_phase_clean", "type_1", "type_2", "type_3", "mw_1", "mw_2",
    "mw_3", "q_year",
}
_STORAGE_MARKERS = ("battery", "storage")
_TRANSMISSION_ACCOUNT = re.compile(r"^(?:35[0-9])(?:\.\d+)?$")


def _number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _date_value(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        except ValueError:
            return None
    return None


def _year_end(year: int) -> str:
    return f"{year:04d}-12-31"


def _observation(
    series_id: str,
    observation_date: str,
    value: float,
    unit: str,
    source_url: str,
    dimensions: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "series_id": series_id,
        "observation_date": observation_date,
        "value": float(value),
        "unit": unit,
        "source_url": source_url,
        "dimensions": dict(dimensions or {}),
    }


def find_latest_lbnl_workbook(
    html: str,
    page_url: str = LBNL_PUBLICATION_URL,
) -> tuple[str, str]:
    """Discover the newest official Queued Up data workbook in a page."""
    candidates: list[tuple[int, str]] = []
    soup = BeautifulSoup(html, "html.parser")
    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"])
        if not re.search(r"\.xlsx(?:$|\?)", href, re.IGNORECASE):
            continue
        descriptor = f"{href} {anchor.get_text(' ', strip=True)}"
        if not re.search(r"(?:queue|queued|interconnection|ix_queue)", descriptor, re.I):
            continue
        years = [int(value) for value in re.findall(r"(?:thru|through|edition|data)[_-]?(20\d{2})", descriptor, re.I)]
        if not years:
            years = [int(value) for value in re.findall(r"20\d{2}", descriptor)]
        if years:
            candidates.append((max(years), urljoin(page_url, href)))
    if not candidates:
        raise ValueError("LBNL Queued Up 최신 XLSX 링크를 찾지 못했습니다.")
    vintage_year, workbook_url = max(candidates, key=lambda item: (item[0], item[1]))
    return workbook_url, _year_end(vintage_year)


def _lbnl_components(row: Mapping[str, Any]) -> list[tuple[str, float]]:
    """Read each technology/MW component once; never add type_clean again."""
    components: list[tuple[str, float]] = []
    for slot in (1, 2, 3):
        technology = str(row.get(f"type_{slot}") or "").strip()
        capacity = _number(row.get(f"mw_{slot}"))
        if not technology or capacity is None or capacity <= 0:
            continue
        components.append((technology, capacity))
    return components


def _lbnl_capacity_mw(row: Mapping[str, Any]) -> tuple[float, float]:
    generation = 0.0
    storage = 0.0
    for technology, capacity in _lbnl_components(row):
        target_storage = any(marker in technology.lower() for marker in _STORAGE_MARKERS)
        if target_storage:
            storage += capacity
        else:
            generation += capacity
    return generation, storage


def _median_or_none(values: Iterable[float]) -> float | None:
    clean = [value for value in values if math.isfinite(value)]
    return float(median(clean)) if clean else None


def parse_lbnl_queue_workbook(
    content: bytes,
    *,
    source_url: str,
    observation_date: str,
) -> list[dict[str, Any]]:
    """Normalize Queued Up projects and annual queue-flow histories."""
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet_name = "03. Complete Queue Data"
    if sheet_name not in workbook.sheetnames:
        raise ValueError(f"LBNL Queued Up {sheet_name} 시트가 없습니다.")
    sheet = workbook[sheet_name]
    headers = list(next(sheet.iter_rows(min_row=2, max_row=2, values_only=True)))
    header_map = {str(value).strip(): index for index, value in enumerate(headers) if value}
    missing = _LBNL_REQUIRED_COLUMNS - header_map.keys()
    if missing:
        raise ValueError(f"LBNL Queued Up 필수 열이 없습니다: {', '.join(sorted(missing))}")

    observed = date.fromisoformat(observation_date)
    active_generation_mw = 0.0
    active_storage_mw = 0.0
    active_ia_mw = 0.0
    active_projects = 0
    suspended_mw = 0.0
    active_ages: list[float] = []
    annual_active_requests: dict[int, float] = defaultdict(float)
    annual_completed: dict[int, float] = defaultdict(float)
    annual_withdrawn: dict[int, float] = defaultdict(float)
    annual_ir_to_cod: dict[int, list[float]] = defaultdict(list)
    completed_total = completed_with_date = 0
    withdrawn_total = withdrawn_with_date = 0

    for values in sheet.iter_rows(min_row=3, values_only=True):
        row = {name: values[index] for name, index in header_map.items()}
        status = str(row.get("q_status") or "").strip().lower()
        generation_mw, storage_mw = _lbnl_capacity_mw(row)
        capacity_mw = generation_mw + storage_mw
        if capacity_mw <= 0:
            continue
        q_date = _date_value(row.get("q_date"))
        on_date = _date_value(row.get("on_date"))
        wd_date = _date_value(row.get("wd_date"))

        if status == "active":
            active_projects += 1
            active_generation_mw += generation_mw
            active_storage_mw += storage_mw
            if str(row.get("IA_phase_clean") or "").strip().lower() == "ia executed":
                active_ia_mw += capacity_mw
            if q_date and q_date <= observed:
                active_ages.append((observed - q_date).days / 365.25)
                annual_active_requests[q_date.year] += capacity_mw
        elif status == "suspended":
            suspended_mw += capacity_mw
        elif status == "operational":
            completed_total += 1
            if on_date and on_date <= observed:
                completed_with_date += 1
                annual_completed[on_date.year] += capacity_mw
                if q_date and q_date <= on_date:
                    annual_ir_to_cod[on_date.year].append((on_date - q_date).days / 365.25)
        elif status == "withdrawn":
            withdrawn_total += 1
            if wd_date and wd_date <= observed:
                withdrawn_with_date += 1
                annual_withdrawn[wd_date.year] += capacity_mw

    raw_active_generation_mw = active_generation_mw
    raw_active_storage_mw = active_storage_mw
    raw_active_total_mw = raw_active_generation_mw + raw_active_storage_mw
    if active_projects == 0 or raw_active_total_mw <= 0:
        raise ValueError("LBNL Queued Up에 유효한 active 프로젝트가 없습니다.")

    # LBNL's published analysis sheets estimate missing storage capacity for
    # hybrid projects from observed storage:generator ratios.  Preserve our
    # literal component sums as auditable raw metrics, while using the official
    # published estimate for the headline total and storage split.
    official_total_gw: float | None = None
    official_storage_gw: float | None = None
    official_ia_active_gw: float | None = None
    if "07. Active Capacity by Year" in workbook.sheetnames:
        total = 0.0
        for values in workbook["07. Active Capacity by Year"].iter_rows(values_only=True):
            if values and _number(values[0]) == observed.year:
                capacity = _number(values[2] if len(values) > 2 else None)
                if capacity is not None:
                    total += capacity
        official_total_gw = total if total > 0 else None
    if "08. Active Capacity by Type" in workbook.sheetnames:
        total = 0.0
        for values in workbook["08. Active Capacity by Type"].iter_rows(values_only=True):
            if (
                values and str(values[0] or "").strip().lower() == "storage"
                and _number(values[1] if len(values) > 1 else None) == observed.year
            ):
                capacity = _number(values[3] if len(values) > 3 else None)
                if capacity is not None:
                    total += capacity
        official_storage_gw = total if total > 0 else None
    if "18. IA Executed Capacity" in workbook.sheetnames:
        total = 0.0
        for values in workbook["18. IA Executed Capacity"].iter_rows(values_only=True):
            if values and str(values[1] or "").strip().lower() == "active":
                capacity = _number(values[2] if len(values) > 2 else None)
                if capacity is not None:
                    total += capacity
        official_ia_active_gw = total if total > 0 else None

    if official_total_gw is not None and official_storage_gw is not None:
        active_total_mw = official_total_gw * 1000
        active_storage_mw = official_storage_gw * 1000
        active_generation_mw = max(0.0, active_total_mw - active_storage_mw)
    else:
        active_total_mw = raw_active_total_mw
    if official_ia_active_gw is not None:
        active_ia_mw = official_ia_active_gw * 1000

    common = {
        "provider": "Lawrence Berkeley National Laboratory",
        "dataset": "Queued Up",
        "license": "CC BY 4.0",
        "vintage": observation_date,
        "scope_note_ko": LBNL_SCOPE_NOTE,
        "active_definition": "q_status=active; suspended excluded and reported separately",
        "capacity_method": (
            "헤드라인은 LBNL 분석표의 hybrid storage 추정치를 포함; "
            "raw 구성요소는 mw_1~mw_3를 각각 한 번만 합산"
        ),
    }
    observations = [
        _observation(
            "us_interconnection_active_queue_total_gw", observation_date,
            active_total_mw / 1000, "GW", source_url, common,
        ),
        _observation(
            "us_interconnection_active_queue_generation_gw", observation_date,
            active_generation_mw / 1000, "GW", source_url, common,
        ),
        _observation(
            "us_interconnection_active_queue_storage_gw", observation_date,
            active_storage_mw / 1000, "GW", source_url, common,
        ),
        _observation(
            "us_interconnection_ia_executed_active_gw", observation_date,
            active_ia_mw / 1000, "GW", source_url, common,
        ),
        _observation(
            "us_interconnection_ia_executed_active_share_pct", observation_date,
            active_ia_mw / active_total_mw * 100, "percent", source_url, common,
        ),
        _observation(
            "us_interconnection_active_median_age_years", observation_date,
            _median_or_none(active_ages) or 0, "years", source_url,
            {**common, "sample_projects": len(active_ages)},
        ),
        _observation(
            "us_interconnection_active_project_count", observation_date,
            active_projects, "projects", source_url, common,
        ),
        _observation(
            "us_interconnection_suspended_queue_gw", observation_date,
            suspended_mw / 1000, "GW", source_url, common,
        ),
        _observation(
            "us_interconnection_active_queue_raw_components_gw", observation_date,
            raw_active_total_mw / 1000, "GW", source_url, common,
        ),
        _observation(
            "us_interconnection_active_storage_raw_components_gw", observation_date,
            raw_active_storage_mw / 1000, "GW", source_url, common,
        ),
    ]

    recent_years = [year for year in annual_ir_to_cod if observed.year - 2 <= year <= observed.year]
    recent_durations = [
        duration for year in recent_years for duration in annual_ir_to_cod[year]
    ]
    recent_median = _median_or_none(recent_durations)
    if recent_median is not None:
        observations.append(_observation(
            "us_interconnection_recent_ir_to_cod_median_years", observation_date,
            recent_median, "years", source_url,
            {**common, "window_years": 3, "sample_projects": len(recent_durations)},
        ))

    history_dimensions = {
        **common,
        "date_coverage": {
            "operational_on_date_pct": (
                completed_with_date / completed_total * 100 if completed_total else 0
            ),
            "withdrawn_wd_date_pct": (
                withdrawn_with_date / withdrawn_total * 100 if withdrawn_total else 0
            ),
        },
    }
    for year, value in sorted(annual_active_requests.items()):
        observations.append(_observation(
            "us_interconnection_active_requests_annual_gw", _year_end(year),
            value / 1000, "GW", source_url,
            {**history_dimensions, "year_basis": "interconnection request date"},
        ))
    for year, value in sorted(annual_completed.items()):
        observations.append(_observation(
            "us_interconnection_completed_annual_gw", _year_end(year),
            value / 1000, "GW", source_url,
            {**history_dimensions, "year_basis": "commercial operation date"},
        ))
    for year, value in sorted(annual_withdrawn.items()):
        observations.append(_observation(
            "us_interconnection_withdrawn_annual_gw", _year_end(year),
            value / 1000, "GW", source_url,
            {**history_dimensions, "year_basis": "withdrawal date"},
        ))
    for year, durations in sorted(annual_ir_to_cod.items()):
        annual_median = _median_or_none(durations)
        if annual_median is not None:
            observations.append(_observation(
                "us_interconnection_ir_to_cod_median_years", _year_end(year),
                annual_median, "years", source_url,
                {**history_dimensions, "sample_projects": len(durations)},
            ))
    return observations


def _transmission_reporter(row: Mapping[str, Any]) -> str:
    for key in (
        "utility_id_pudl", "utility_id_ferc1_xbrl", "utility_id_ferc1_dbf",
        "utility_id_ferc1", "utility_name_ferc1",
    ):
        value = row.get(key)
        if value is not None and str(value).strip():
            return f"{key}:{value}"
    return ""


def _is_granular_transmission_row(row: Mapping[str, Any]) -> bool:
    account = str(row.get("ferc_account") or "").strip()
    label = str(row.get("ferc_account_label") or "").lower()
    row_type = str(row.get("row_type_xbrl") or "reported_value").lower()
    return (
        bool(_TRANSMISSION_ACCOUNT.fullmatch(account))
        and row_type == "reported_value"
        and "total" not in label
        and str(row.get("utility_type") or "electric").lower() == "electric"
        and str(row.get("plant_status") or "in_service").lower() == "in_service"
    )


def parse_pudl_transmission_rows(
    rows: Iterable[Mapping[str, Any]],
    *,
    source_url: str = PUDL_PARQUET_URL,
) -> list[dict[str, Any]]:
    """Aggregate granular FERC transmission accounts without subtotal rows."""
    by_year_reporter: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    # PUDL's record_id identifies a utility/schedule/year record and is shared
    # by all of that record's account rows.  Deduplicate only an identical
    # account row; using record_id alone would discard 12 of the 13 accounts.
    seen_rows: set[tuple[Any, ...]] = set()
    for row in rows:
        if not _is_granular_transmission_row(row):
            continue
        try:
            year = int(row["report_year"])
        except (KeyError, TypeError, ValueError):
            continue
        reporter = _transmission_reporter(row)
        if not reporter or not 1990 <= year <= 2100:
            continue
        # A blank additions cell still belongs to a filed Schedule 204 and is
        # part of reporter-coverage continuity; it contributes zero dollars.
        additions = _number(row.get("additions")) or 0.0
        signature = (
            str(row.get("record_id") or "").strip(), year, reporter,
            str(row.get("ferc_account") or "").strip(),
            str(row.get("ferc_account_label") or "").strip(), additions,
        )
        if signature in seen_rows:
            continue
        seen_rows.add(signature)
        by_year_reporter[year][reporter] += additions

    if not by_year_reporter:
        raise ValueError("PUDL FERC Form 1 송전설비 계정에 유효한 행이 없습니다.")
    years = sorted(by_year_reporter)
    common = {
        "provider": "PUDL / Catalyst Cooperative",
        "original_source": "FERC Form 1 Schedule 204",
        "license": "CC BY 4.0",
        "accounts": "350~359.x",
        "price_basis": "nominal USD; not inflation adjusted",
        "scope_note_ko": TRANSMISSION_SCOPE_NOTE,
        "row_filter": "electric, in_service, reported_value, granular account rows",
    }
    observations: list[dict[str, Any]] = []
    continuity_by_year: dict[int, tuple[float, float]] = {}
    for index, year in enumerate(years):
        reporters = set(by_year_reporter[year])
        total = sum(by_year_reporter[year].values())
        observations.extend([
            _observation(
                "us_transmission_plant_additions_usd", _year_end(year), total,
                "USD", source_url, common,
            ),
            _observation(
                "us_transmission_plant_reporter_count", _year_end(year), len(reporters),
                "reporters", source_url, common,
            ),
        ])
        if index:
            prior_reporters = set(by_year_reporter[years[index - 1]])
            overlap = reporters & prior_reporters
            current_coverage = len(overlap) / len(reporters) * 100 if reporters else 0
            prior_retention = len(overlap) / len(prior_reporters) * 100 if prior_reporters else 0
            continuity_by_year[year] = (current_coverage, prior_retention)
            observations.extend([
                _observation(
                    "us_transmission_current_reporter_prior_year_coverage_pct",
                    _year_end(year), current_coverage, "percent", source_url, common,
                ),
                _observation(
                    "us_transmission_prior_reporter_retention_pct", _year_end(year),
                    prior_retention, "percent", source_url, common,
                ),
            ])

    latest = years[-1]
    base_year = latest - 3
    if base_year in by_year_reporter:
        latest_total = sum(by_year_reporter[latest].values())
        base_total = sum(by_year_reporter[base_year].values())
        if latest_total > 0 and base_total > 0:
            cagr = ((latest_total / base_total) ** (1 / 3) - 1) * 100
            observations.append(_observation(
                "us_transmission_plant_additions_3y_cagr_pct", _year_end(latest),
                cagr, "percent", source_url,
                {**common, "base_year": base_year, "latest_year": latest},
            ))
        comparable = set(by_year_reporter[latest]) & set(by_year_reporter[base_year])
        latest_comparable = sum(by_year_reporter[latest][item] for item in comparable)
        base_comparable = sum(by_year_reporter[base_year][item] for item in comparable)
        if comparable and latest_comparable > 0 and base_comparable > 0:
            comparable_cagr = ((latest_comparable / base_comparable) ** (1 / 3) - 1) * 100
            observations.append(_observation(
                "us_transmission_plant_additions_like_for_like_3y_cagr_pct",
                _year_end(latest), comparable_cagr, "percent", source_url,
                {
                    **common, "base_year": base_year, "latest_year": latest,
                    "comparable_reporters": len(comparable),
                },
            ))
    return observations


def parse_pudl_transmission_parquet(
    content: bytes,
    *,
    source_url: str = PUDL_PARQUET_URL,
) -> list[dict[str, Any]]:
    """Read only the required Schedule 204 columns through DuckDB."""
    try:
        import duckdb  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover - deployment dependency guard
        raise RuntimeError("PUDL Parquet 파싱에 duckdb 패키지가 필요합니다.") from exc
    if len(content) < 4 or content[:4] != b"PAR1":
        raise ValueError("PUDL 응답이 Parquet 파일이 아닙니다.")
    path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".parquet", delete=False) as handle:
            handle.write(content)
            path = handle.name
        connection = duckdb.connect()
        try:
            query = """
                SELECT report_year, utility_id_ferc1, utility_id_ferc1_dbf,
                       utility_id_ferc1_xbrl, utility_id_pudl, utility_name_ferc1,
                       utility_type, plant_status, record_id, additions,
                       ferc_account, ferc_account_label, row_type_xbrl
                FROM read_parquet(?)
                WHERE TRY_CAST(ferc_account AS DOUBLE) >= 350
                  AND TRY_CAST(ferc_account AS DOUBLE) < 360
            """
            columns = [item[0] for item in connection.execute(query, [path]).description]
            rows = [dict(zip(columns, values)) for values in connection.fetchall()]
        finally:
            connection.close()
    finally:
        if path:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
    return parse_pudl_transmission_rows(rows, source_url=source_url)


def _latest(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    return rows[-1] if rows else None


def _metric(repo: ExternalObservationRepository, series_id: str) -> dict[str, Any] | None:
    row = _latest(repo.series(series_id))
    if not row:
        return None
    return {
        "value": row["value"], "unit": row["unit"],
        "observation_date": row["observation_date"],
    }


def _feed_freshness(
    repo: ExternalObservationRepository,
    feed_id: str,
    series_id: str,
    *,
    stale_days: int = 550,
) -> dict[str, Any]:
    status = repo.status(feed_id) or {}
    latest = _latest(repo.series(series_id))
    observed = _date_value(latest.get("observation_date")) if latest else None
    return {
        "status": status.get("status") or "missing",
        "last_success_at": status.get("last_success_at"),
        "last_attempted_at": status.get("last_attempted_at"),
        "error": status.get("error"),
        "fetched_at": latest.get("fetched_at") if latest else None,
        "observation_date": observed.isoformat() if observed else None,
        "is_stale": not observed or (date.today() - observed).days > stale_days,
        "stale_after_days": stale_days,
    }


def _history(
    repo: ExternalObservationRepository,
    mapping: Mapping[str, str],
    *,
    through_date: str | None = None,
) -> list[dict[str, Any]]:
    points: dict[str, dict[str, Any]] = defaultdict(dict)
    for series_id, key in mapping.items():
        for row in repo.series(series_id):
            if through_date and row["observation_date"] > through_date:
                continue
            points[row["observation_date"]][key] = row["value"]
    return [
        {"date": observed, **values}
        for observed, values in sorted(points.items())
    ]


class GridInfrastructureService:
    """Refresh and summarize structural grid evidence with last-good caching."""

    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    async def _fetch_lbnl(self, client: httpx.AsyncClient) -> list[dict[str, Any]]:
        workbook_url = LBNL_FALLBACK_WORKBOOK_URL
        observation_date = "2025-12-31"
        try:
            page_response = await client.get(LBNL_PUBLICATION_URL)
            page_response.raise_for_status()
            workbook_url, observation_date = find_latest_lbnl_workbook(page_response.text)
        except (httpx.HTTPError, ValueError):
            # The publication front-end intermittently rejects automated clients.
            # The fallback remains an official LBNL-hosted workbook, never a mirror.
            pass
        workbook_response = await client.get(workbook_url)
        workbook_response.raise_for_status()
        if len(workbook_response.content) < 10_000:
            raise ValueError("LBNL Queued Up XLSX 응답이 비정상적으로 작습니다.")
        return await asyncio.to_thread(
            parse_lbnl_queue_workbook,
            workbook_response.content,
            source_url=workbook_url,
            observation_date=observation_date,
        )

    async def _fetch_pudl(self, client: httpx.AsyncClient) -> list[dict[str, Any]]:
        response = await client.get(PUDL_PARQUET_URL)
        response.raise_for_status()
        if len(response.content) < 10_000:
            raise ValueError("PUDL FERC Form 1 Parquet 응답이 비정상적으로 작습니다.")
        return await asyncio.to_thread(
            parse_pudl_transmission_parquet,
            response.content,
            source_url=PUDL_PARQUET_URL,
        )

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        due = {
            "lbnl": force or self.repo.is_due(LBNL_FEED_ID, success_hours=REFRESH_HOURS),
            "pudl": force or self.repo.is_due(PUDL_FEED_ID, success_hours=REFRESH_HOURS),
        }
        jobs = {name: value for name, value in due.items() if value}
        if not jobs:
            return {"status": "cached", "saved": 0}

        attempted = utc_now()
        async with httpx.AsyncClient(timeout=240, follow_redirects=True) as client:
            names = list(jobs)
            results = await asyncio.gather(
                *(
                    self._fetch_lbnl(client) if name == "lbnl"
                    else self._fetch_pudl(client)
                    for name in names
                ),
                return_exceptions=True,
            )

        errors: dict[str, str] = {}
        saved = 0
        source_results: dict[str, dict[str, Any]] = {}
        feed_config = {
            "lbnl": (LBNL_FEED_ID, "lbnl", "interconnection_queue"),
            "pudl": (PUDL_FEED_ID, "pudl", "ferc1_transmission_plant"),
        }
        for name, result in zip(names, results):
            feed_id, source, dataset = feed_config[name]
            if isinstance(result, Exception):
                message = str(result)
                errors[name] = message
                self.repo.save_status(
                    feed_id, source, dataset, attempted, success=False, error=message,
                )
                source_results[name] = {"status": "failed", "saved": 0, "error": message}
                continue
            fetched_at = datetime.now(timezone.utc).isoformat()
            for item in result:
                item["fetched_at"] = fetched_at
            item_count = self.repo.save_observations(source, dataset, result)
            saved += item_count
            self.repo.save_status(
                feed_id, source, dataset, attempted, success=True, item_count=item_count,
            )
            source_results[name] = {"status": "success", "saved": item_count}

        cached_available = {
            "lbnl": bool(self.repo.series("us_interconnection_active_queue_total_gw")),
            "pudl": bool(self.repo.series("us_transmission_plant_additions_usd")),
        }
        if not errors:
            status = "success"
        elif any(cached_available.values()) or saved:
            status = "partial"
        else:
            status = "failed"
        response: dict[str, Any] = {
            "status": status, "saved": saved, "sources": source_results,
        }
        if errors:
            response["errors"] = errors
        return response

    def summary(self) -> dict[str, Any]:
        interconnection_metrics = {
            "active_queue_gw": _metric(self.repo, "us_interconnection_active_queue_total_gw"),
            "active_generation_gw": _metric(
                self.repo, "us_interconnection_active_queue_generation_gw"
            ),
            "active_storage_gw": _metric(
                self.repo, "us_interconnection_active_queue_storage_gw"
            ),
            "ia_executed_active_gw": _metric(
                self.repo, "us_interconnection_ia_executed_active_gw"
            ),
            "ia_executed_share_pct": _metric(
                self.repo, "us_interconnection_ia_executed_active_share_pct"
            ),
            "median_active_age_years": _metric(
                self.repo, "us_interconnection_active_median_age_years"
            ),
            "recent_ir_to_cod_median_years": _metric(
                self.repo, "us_interconnection_recent_ir_to_cod_median_years"
            ),
            "active_projects": _metric(
                self.repo, "us_interconnection_active_project_count"
            ),
            "raw_component_total_gw": _metric(
                self.repo, "us_interconnection_active_queue_raw_components_gw"
            ),
            "raw_component_storage_gw": _metric(
                self.repo, "us_interconnection_active_storage_raw_components_gw"
            ),
        }
        transmission_metrics = {
            "annual_additions_usd": _metric(
                self.repo, "us_transmission_plant_additions_usd"
            ),
            "reporter_count": _metric(
                self.repo, "us_transmission_plant_reporter_count"
            ),
            "three_year_cagr_pct": _metric(
                self.repo, "us_transmission_plant_additions_3y_cagr_pct"
            ),
            "like_for_like_three_year_cagr_pct": _metric(
                self.repo, "us_transmission_plant_additions_like_for_like_3y_cagr_pct"
            ),
            "current_reporter_prior_year_coverage_pct": _metric(
                self.repo, "us_transmission_current_reporter_prior_year_coverage_pct"
            ),
            "prior_reporter_retention_pct": _metric(
                self.repo, "us_transmission_prior_reporter_retention_pct"
            ),
        }
        interconnection_observation = (
            interconnection_metrics["active_queue_gw"] or {}
        ).get("observation_date")
        transmission_observation = (
            transmission_metrics["annual_additions_usd"] or {}
        ).get("observation_date")
        return {
            "interconnection_axis": {
                "metrics": interconnection_metrics,
                "history": _history(self.repo, {
                    "us_interconnection_active_requests_annual_gw": "active_requests_gw",
                    "us_interconnection_completed_annual_gw": "completed_gw",
                    "us_interconnection_withdrawn_annual_gw": "withdrawn_gw",
                    "us_interconnection_ir_to_cod_median_years": "median_ir_to_cod_years",
                }, through_date=interconnection_observation),
                "provenance": {
                    "provider": "Lawrence Berkeley National Laboratory",
                    "dataset": "Queued Up",
                    "source_url": LBNL_PUBLICATION_URL,
                    "license": "CC BY 4.0",
                    "scope_note": LBNL_SCOPE_NOTE,
                },
                "freshness": _feed_freshness(
                    self.repo, LBNL_FEED_ID,
                    "us_interconnection_active_queue_total_gw",
                ),
            },
            "transmission_investment_axis": {
                "metrics": transmission_metrics,
                "history": _history(self.repo, {
                    "us_transmission_plant_additions_usd": "additions_usd",
                    "us_transmission_plant_reporter_count": "reporter_count",
                    "us_transmission_current_reporter_prior_year_coverage_pct": (
                        "current_reporter_prior_year_coverage_pct"
                    ),
                }, through_date=transmission_observation),
                "provenance": {
                    "provider": "PUDL / Catalyst Cooperative",
                    "original_source": "FERC Form 1 Schedule 204",
                    "source_url": PUDL_DATA_URL,
                    "data_url": PUDL_PARQUET_URL,
                    "license": "CC BY 4.0",
                    "scope_note": TRANSMISSION_SCOPE_NOTE,
                },
                "freshness": _feed_freshness(
                    self.repo, PUDL_FEED_ID, "us_transmission_plant_additions_usd",
                ),
            },
        }
