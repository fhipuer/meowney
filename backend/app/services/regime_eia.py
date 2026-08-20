"""EIA electricity-demand, grid-operation and capacity-pipeline cache."""

from __future__ import annotations

import asyncio
import calendar
import io
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from openpyxl import load_workbook

from app.config import settings
from app.services.regime_external import ExternalObservationRepository, utc_now


EIA_BASE = "https://api.eia.gov/v2"
EIA_DOC_URL = "https://www.eia.gov/opendata/documentation.php"
EIA_GRID_URL = "https://www.eia.gov/electricity/gridmonitor/"
EIA_860M_URL = "https://www.eia.gov/electricity/data/eia860m/"
FEED_ID = "eia_power"
PIPELINE_FEED_ID = "eia_capacity_pipeline"
RTO_REGIONS = {
    "NE": "뉴잉글랜드",
    "TEX": "텍사스",
    "CENT": "중부",
    "NY": "뉴욕",
    "FLA": "플로리다",
    "SE": "남동부",
    "TEN": "테네시",
    "SW": "남서부",
    "MIDA": "중부대서양",
    "NW": "북서부",
    "CAR": "캐롤라이나",
    "CAL": "캘리포니아",
    "MIDW": "중서부",
}
RTO_RESPONDENTS = {"US48": "United States Lower 48", **RTO_REGIONS}
AI_POWER_PROXY_REGIONS = ("MIDA", "TEX", "SE", "NW", "SW", "CAR")
COMMITTED_860M_STATUSES = {"(TS)", "(V)", "(U)"}
PIPELINE_GROUPS = ("solar", "battery", "wind", "gas", "other")
RTO_DAILY_TYPES = {
    "D": "demand",
    "DF": "demand_forecast",
    "NG": "net_generation",
    "TI": "total_interchange",
}


def parse_eia_rows(
    payload: dict[str, Any], mapping: dict[str, tuple[str, str]], source_url: str
) -> list[dict[str, Any]]:
    response = payload.get("response") or {}
    rows = response.get("data") or []
    observations: list[dict[str, Any]] = []
    for row in rows:
        discriminator = row.get("sectorid") or row.get("fueltypeid") or row.get("stateID")
        if discriminator not in mapping:
            continue
        series_id, value_field = mapping[discriminator]
        try:
            value = float(row[value_field])
        except (KeyError, TypeError, ValueError):
            continue
        period = str(row.get("period") or "")
        if len(period) == 7:
            observation_date = f"{period}-01"
        elif len(period) == 4:
            observation_date = f"{period}-12-31"
        else:
            continue
        observations.append({
            "series_id": series_id,
            "observation_date": observation_date,
            "value": value,
            "unit": row.get(f"{value_field}-units") or (
                "megawatts" if value_field == "net-summer-capacity" else "unknown"
            ),
            "source_url": source_url,
            "dimensions": {
                key: item for key, item in row.items()
                if key not in {value_field, f"{value_field}-units"}
            },
        })
    return observations


def parse_rto_daily_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize EIA-930 daily grid series on one Eastern-day boundary.

    EIA publishes demand (D), day-ahead demand forecast (DF), net generation
    (NG), and total interchange (TI) on the same daily route.  Keeping each
    lane separate lets the decision model use forecast error and power-flow
    dependence as operating-pressure proxies without calling either a reserve
    margin or a physical grid bottleneck.
    """
    rows = (payload.get("response") or {}).get("data") or []
    observations: list[dict[str, Any]] = []
    for row in rows:
        respondent = str(row.get("respondent") or "")
        series_type = str(row.get("type") or "")
        if respondent not in RTO_RESPONDENTS or series_type not in RTO_DAILY_TYPES:
            continue
        if row.get("timezone") != "Eastern":
            continue
        period = str(row.get("period") or "")
        try:
            datetime.strptime(period, "%Y-%m-%d")
            value = float(row["value"])
        except (KeyError, TypeError, ValueError):
            continue
        observations.append({
            "series_id": (
                f"us_electricity_daily_{RTO_DAILY_TYPES[series_type]}_"
                f"{respondent.lower()}"
            ),
            "observation_date": period,
            "value": value,
            "unit": row.get("value-units") or "megawatthours",
            "source_url": EIA_GRID_URL,
            "dimensions": {
                "respondent": respondent,
                "respondent_name": row.get("respondent-name") or RTO_RESPONDENTS[respondent],
                "type": series_type,
                "timezone": "Eastern",
                "frequency": "daily",
            },
        })
    return observations


def _status_code(value: Any) -> str:
    match = re.match(r"^\([^)]*\)", str(value or ""))
    return match.group(0) if match else str(value or "")


def _float(value: Any) -> float | None:
    """Return a real numeric cell while preserving missing/invalid values.

    Treating an unreadable EIA workbook cell as zero silently changes a data
    quality problem into a real 0 MW project.  Callers must explicitly skip an
    invalid row instead.
    """
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _month_index(year: Any, month: Any) -> int | None:
    try:
        return int(year) * 12 + int(month)
    except (TypeError, ValueError):
        return None


def _pipeline_group(technology: Any) -> str:
    value = str(technology or "").lower()
    if "solar" in value:
        return "solar"
    if "batter" in value or "storage" in value:
        return "battery"
    if "wind" in value:
        return "wind"
    if "natural gas" in value:
        return "gas"
    return "other"


def find_latest_eia860m_workbook(html: str, page_url: str = EIA_860M_URL) -> tuple[str, str]:
    """Return the newest workbook URL and its month-end observation date."""
    candidates: list[tuple[date, str]] = []
    soup = BeautifulSoup(html, "html.parser")
    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"])
        match = re.search(r"/([a-z]+)_generator(\d{4})\.xlsx$", href, re.IGNORECASE)
        if not match:
            continue
        try:
            month = datetime.strptime(match.group(1), "%B").month
            year = int(match.group(2))
            observed = date(year, month, calendar.monthrange(year, month)[1])
        except ValueError:
            continue
        candidates.append((observed, urljoin(page_url, href)))
    if not candidates:
        raise ValueError("EIA-860M 최신 통합문서 링크를 찾지 못했습니다.")
    observed, workbook_url = max(candidates, key=lambda item: item[0])
    return workbook_url, observed.isoformat()


def parse_eia860m_workbook(
    content: bytes,
    *,
    source_url: str,
    observation_date: str,
    window_months: int = 24,
) -> list[dict[str, Any]]:
    """Aggregate the current EIA-860M workbook into investable supply context.

    Only projects that are already under construction or construction-complete
    (TS/V/U) enter committed additions.  Nameplate MW are deliberately not
    described as accredited or dispatchable capacity.
    """
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    observed = date.fromisoformat(observation_date)
    observed_month = observed.year * 12 + observed.month
    end_month = observed_month + window_months

    def rows(sheet_name: str) -> tuple[dict[str, int], Iterable[tuple[Any, ...]]]:
        if sheet_name not in workbook.sheetnames:
            raise ValueError(f"EIA-860M {sheet_name} 시트가 없습니다.")
        sheet = workbook[sheet_name]
        headers = list(next(sheet.iter_rows(min_row=3, max_row=3, values_only=True)))
        return {str(value): index for index, value in enumerate(headers) if value}, sheet.iter_rows(
            min_row=4, values_only=True
        )

    operating_headers, operating_rows = rows("Operating")
    required_operating = {
        "Net Summer Capacity (MW)", "Status", "Planned Retirement Month",
        "Planned Retirement Year",
    }
    if required_operating - operating_headers.keys():
        raise ValueError("EIA-860M Operating 시트 필수 열이 없습니다.")
    operating_mw = 0.0
    retirements_24m_mw = 0.0
    for row in operating_rows:
        status = _status_code(row[operating_headers["Status"]])
        if status != "(OP)":
            continue
        capacity = _float(row[operating_headers["Net Summer Capacity (MW)"]])
        if capacity is None:
            continue
        operating_mw += capacity
        retirement_month = _month_index(
            row[operating_headers["Planned Retirement Year"]],
            row[operating_headers["Planned Retirement Month"]],
        )
        if retirement_month is not None and observed_month <= retirement_month <= end_month:
            retirements_24m_mw += capacity

    planned_headers, planned_rows = rows("Planned")
    required_planned = {
        "Net Summer Capacity (MW)", "Status", "Planned Operation Month",
        "Planned Operation Year", "Technology",
    }
    if required_planned - planned_headers.keys():
        raise ValueError("EIA-860M Planned 시트 필수 열이 없습니다.")
    additions_24m_mw = 0.0
    delayed_committed_mw = 0.0
    mix = {group: 0.0 for group in PIPELINE_GROUPS}
    for row in planned_rows:
        status = _status_code(row[planned_headers["Status"]])
        if status not in COMMITTED_860M_STATUSES:
            continue
        capacity = _float(row[planned_headers["Net Summer Capacity (MW)"]])
        if capacity is None:
            continue
        operation_month = _month_index(
            row[planned_headers["Planned Operation Year"]],
            row[planned_headers["Planned Operation Month"]],
        )
        if operation_month is None:
            continue
        if operation_month < observed_month:
            delayed_committed_mw += capacity
            continue
        if operation_month > end_month:
            continue
        additions_24m_mw += capacity
        mix[_pipeline_group(row[planned_headers["Technology"]])] += capacity

    net_additions_24m_mw = additions_24m_mw - retirements_24m_mw
    pipeline_ratio = (
        net_additions_24m_mw / operating_mw * 100 if operating_mw else 0.0
    )
    variable_storage_mw = mix["solar"] + mix["battery"] + mix["wind"]
    variable_storage_share = (
        variable_storage_mw / additions_24m_mw * 100 if additions_24m_mw else 0.0
    )
    common_dimensions = {
        "window_months": window_months,
        "committed_status_codes": sorted(COMMITTED_860M_STATUSES),
        "capacity_definition": "net summer capacity; not accredited capacity",
    }
    values = {
        "us_power_operating_capacity_mw": (operating_mw, "MW"),
        "us_power_committed_additions_24m_mw": (additions_24m_mw, "MW"),
        "us_power_planned_retirements_24m_mw": (retirements_24m_mw, "MW"),
        "us_power_net_committed_additions_24m_mw": (net_additions_24m_mw, "MW"),
        "us_power_net_pipeline_ratio_24m_pct": (pipeline_ratio, "percent"),
        "us_power_variable_storage_share_24m_pct": (variable_storage_share, "percent"),
        "us_power_delayed_committed_capacity_mw": (delayed_committed_mw, "MW"),
    }
    for group, value in mix.items():
        values[f"us_power_committed_pipeline_{group}_mw"] = (value, "MW")
    return [
        {
            "series_id": series_id,
            "observation_date": observation_date,
            "value": value,
            "unit": unit,
            "source_url": source_url,
            "dimensions": common_dimensions,
        }
        for series_id, (value, unit) in values.items()
    ]


async def _eia_data_pages(
    client: httpx.AsyncClient,
    url: str,
    params: list[tuple[str, str]],
    *,
    page_size: int = 5000,
) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        request_params = [
            (key, str(offset) if key == "offset" else value) for key, value in params
        ]
        response = await client.get(url, params=request_params)
        response.raise_for_status()
        payload = response.json()
        if payload.get("error"):
            raise ValueError(payload["error"])
        result = payload.get("response") or {}
        page = result.get("data") or []
        rows.extend(page)
        total = int(result.get("total") or len(rows))
        if len(rows) >= total:
            break
        if not page:
            raise ValueError("EIA 페이지 응답이 전체 건수에 도달하기 전에 비었습니다.")
        offset = len(rows)
        if offset > 100_000:
            raise ValueError("EIA 일간 전력 응답이 안전한 페이지 한도를 초과했습니다.")
    return {"response": {"data": rows, "total": len(rows), "page_size": page_size}}


class EiaPowerService:
    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    def _daily_grid_cache_complete(self) -> bool:
        """Require every fixed-region lane before treating a legacy cache as current.

        This doubles as a schema/backfill gate when a new EIA-930 type is added:
        an old successful feed status must not suppress collection of the new
        series until the ordinary 18-hour cache window expires.
        """
        required = {
            f"us_electricity_daily_{series_name}_{respondent.lower()}"
            for series_name in RTO_DAILY_TYPES.values()
            for respondent in RTO_RESPONDENTS
        }
        return all(self.repo.series(series_id, limit=1) for series_id in required)

    async def _fetch_monthly_context(self, client: httpx.AsyncClient) -> list[dict[str, Any]]:
        common = [
            ("api_key", settings.eia_api_key), ("sort[0][column]", "period"),
            ("sort[0][direction]", "desc"), ("offset", "0"), ("length", "5000"),
        ]
        retail_params = common + [
            ("frequency", "monthly"), ("data[0]", "sales"),
            ("facets[stateid][]", "US"), ("facets[sectorid][]", "ALL"),
            ("facets[sectorid][]", "COM"), ("facets[sectorid][]", "IND"),
            ("start", f"{datetime.now().year - 5}-01"),
        ]
        generation_params = common + [
            ("frequency", "monthly"), ("data[0]", "generation"),
            ("facets[location][]", "US"), ("facets[sectorid][]", "99"),
            ("facets[fueltypeid][]", "ALL"), ("start", f"{datetime.now().year - 5}-01"),
        ]
        capacity_params = common + [
            ("frequency", "annual"), ("data[0]", "net-summer-capacity"),
            ("facets[stateID][]", "US"), ("start", str(datetime.now().year - 12)),
        ]
        retail_response, generation_response, capacity_response = await asyncio.gather(
            client.get(f"{EIA_BASE}/electricity/retail-sales/data/", params=retail_params),
            client.get(
                f"{EIA_BASE}/electricity/electric-power-operational-data/data/",
                params=generation_params,
            ),
            client.get(
                f"{EIA_BASE}/electricity/state-electricity-profiles/summary/data/",
                params=capacity_params,
            ),
        )
        for response in (retail_response, generation_response, capacity_response):
            response.raise_for_status()
            if response.json().get("error"):
                raise ValueError(response.json()["error"])
        observations = parse_eia_rows(
            retail_response.json(),
            {
                "ALL": ("us_electricity_sales_all", "sales"),
                "COM": ("us_electricity_sales_commercial", "sales"),
                "IND": ("us_electricity_sales_industrial", "sales"),
            },
            "https://www.eia.gov/electricity/data/browser/#/topic/5",
        )
        observations += parse_eia_rows(
            generation_response.json(),
            {"99": ("us_electricity_net_generation", "generation")},
            "https://www.eia.gov/electricity/data/browser/#/topic/0",
        )
        observations += parse_eia_rows(
            capacity_response.json(),
            {"US": ("us_electricity_net_summer_capacity", "net-summer-capacity")},
            "https://www.eia.gov/electricity/state/",
        )
        required = {
            "us_electricity_sales_all", "us_electricity_sales_commercial",
            "us_electricity_sales_industrial", "us_electricity_net_generation",
            "us_electricity_net_summer_capacity",
        }
        if required - {item["series_id"] for item in observations}:
            raise ValueError("EIA 전력 판매·발전·설비용량 응답이 불완전합니다.")
        return observations

    async def _fetch_daily_grid(self, client: httpx.AsyncClient) -> list[dict[str, Any]]:
        common_params = [
            ("api_key", settings.eia_api_key), ("frequency", "daily"),
            ("data[0]", "value"), ("facets[timezone][]", "Eastern"),
            ("start", (date.today() - timedelta(days=500)).isoformat()),
            ("sort[0][column]", "period"), ("sort[0][direction]", "asc"),
            ("offset", "0"), ("length", "5000"),
        ]
        for respondent in RTO_RESPONDENTS:
            common_params.append(("facets[respondent][]", respondent))

        # One large four-type request paginates serially and can take several
        # minutes on EIA's public endpoint.  Independent type requests preserve
        # the exact same rows while allowing the provider to serve the four
        # lanes concurrently.
        payloads = await asyncio.gather(*[
            _eia_data_pages(
                client,
                f"{EIA_BASE}/electricity/rto/daily-region-data/data/",
                [*common_params, ("facets[type][]", series_type)],
            )
            for series_type in RTO_DAILY_TYPES
        ])
        observations = [
            observation
            for payload in payloads
            for observation in parse_rto_daily_rows(payload)
        ]
        series = {item["series_id"] for item in observations}
        required = {
            f"us_electricity_daily_{series_name}_us48"
            for series_name in RTO_DAILY_TYPES.values()
        }
        regional = {
            f"us_electricity_daily_demand_{respondent.lower()}" for respondent in RTO_REGIONS
        }
        if required - series or len(regional & series) < 10:
            raise ValueError("EIA-930 전국·지역 일간 수요 응답이 불완전합니다.")
        return observations

    async def _fetch_capacity_pipeline(self, client: httpx.AsyncClient) -> list[dict[str, Any]]:
        page_response = await client.get(EIA_860M_URL)
        page_response.raise_for_status()
        workbook_url, observation_date = find_latest_eia860m_workbook(page_response.text)
        workbook_response = await client.get(workbook_url)
        workbook_response.raise_for_status()
        if len(workbook_response.content) < 10_000:
            raise ValueError("EIA-860M 통합문서 응답이 비정상적으로 작습니다.")
        return await asyncio.to_thread(
            parse_eia860m_workbook,
            workbook_response.content,
            source_url=workbook_url,
            observation_date=observation_date,
        )

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        if not settings.eia_api_key:
            return {"status": "configuration_required", "saved": 0, "error": "EIA_API_KEY가 없습니다."}
        core_due = force or self.repo.is_due(FEED_ID, success_hours=18)
        daily_backfill_due = not self._daily_grid_cache_complete()
        pipeline_due = force or self.repo.is_due(PIPELINE_FEED_ID, success_hours=168)
        if not core_due and not daily_backfill_due and not pipeline_due:
            return {"status": "cached", "saved": 0}
        attempted = utc_now()
        jobs: dict[str, Any] = {}
        async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
            if core_due:
                jobs["monthly"] = self._fetch_monthly_context(client)
            if core_due or daily_backfill_due:
                jobs["daily_grid"] = self._fetch_daily_grid(client)
            if pipeline_due:
                jobs["pipeline"] = self._fetch_capacity_pipeline(client)
            raw = await asyncio.gather(*jobs.values(), return_exceptions=True)

        observations: list[dict[str, Any]] = []
        errors: dict[str, str] = {}
        for name, result in zip(jobs, raw):
            if isinstance(result, Exception):
                errors[name] = str(result)
            else:
                observations.extend(result)
        fetched_at = datetime.now(timezone.utc).isoformat()
        for item in observations:
            item["fetched_at"] = fetched_at
        saved = self.repo.save_observations("eia", "us_power", observations)

        if pipeline_due:
            pipeline_error = errors.get("pipeline")
            pipeline_count = sum(
                1 for item in observations if item["series_id"].startswith("us_power_")
            )
            self.repo.save_status(
                PIPELINE_FEED_ID,
                "eia",
                "eia860m_pipeline",
                attempted,
                success=not pipeline_error,
                item_count=pipeline_count,
                error=pipeline_error,
            )

        core_jobs = {name for name in ("monthly", "daily_grid") if name in jobs}
        essential_ok = all(name not in errors for name in core_jobs)
        pipeline_available = (
            not pipeline_due
            or "pipeline" not in errors
            or bool(self.repo.series("us_power_operating_capacity_mw", limit=1))
        )
        status = (
            "success" if essential_ok and pipeline_available and not errors
            else "partial" if observations or pipeline_available
            else "failed"
        )
        error_text = " · ".join(f"{name}: {error}" for name, error in errors.items()) or None
        if core_jobs:
            self.repo.save_status(
                FEED_ID,
                "eia",
                "us_power",
                attempted,
                success=status != "failed",
                item_count=saved,
                error=error_text,
                status=status,
            )
        result: dict[str, Any] = {"status": status, "saved": saved}
        if errors:
            result["errors"] = errors
        return result
