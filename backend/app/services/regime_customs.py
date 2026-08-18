"""Korea Customs monthly memory-export cache."""

from __future__ import annotations

import urllib.parse
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.services.regime_external import ExternalObservationRepository, utc_now


CUSTOMS_ENDPOINT = "https://apis.data.go.kr/1220000/Itemtrade/getItemtradeList"
CUSTOMS_SOURCE_URL = "https://www.data.go.kr/data/15101609/openapi.do"
FEED_ID = "customs_memory_exports"
DRAM_HS = "8542321010"
FLASH_HS = "8542321030"
MCP_HS = "8542323000"
DRAM_MODULE_HS = "8473304060"
QUERY_HS_CODES = ("854232", DRAM_MODULE_HS)


def _month_shift(year: int, month: int, delta: int) -> tuple[int, int]:
    index = year * 12 + month - 1 + delta
    return index // 12, index % 12 + 1


def customs_query_windows(months: int = 60, today: date | None = None) -> list[tuple[str, str]]:
    """Return chronological windows of at most twelve months."""
    today = today or date.today()
    start_year, start_month = _month_shift(today.year, today.month, -(months - 1))
    windows: list[tuple[str, str]] = []
    cursor_year, cursor_month = start_year, start_month
    while (cursor_year, cursor_month) <= (today.year, today.month):
        end_year, end_month = _month_shift(cursor_year, cursor_month, 11)
        if (end_year, end_month) > (today.year, today.month):
            end_year, end_month = today.year, today.month
        windows.append((f"{cursor_year:04d}{cursor_month:02d}", f"{end_year:04d}{end_month:02d}"))
        cursor_year, cursor_month = _month_shift(end_year, end_month, 1)
    return windows


def parse_customs_memory_xml(content: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(content)
    code = root.findtext(".//resultCode")
    if code != "00":
        raise ValueError(root.findtext(".//resultMsg") or f"관세청 오류 코드 {code}")
    observations: list[dict[str, Any]] = []
    for node in root.findall(".//item"):
        item = {child.tag: child.text for child in node}
        hs_code = item.get("hsCode") or ""
        period = item.get("year") or ""
        if not any(hs_code.startswith(prefix) for prefix in QUERY_HS_CODES) or len(period) != 7 or period[4] != ".":
            continue
        try:
            export_usd = float(item.get("expDlr") or 0)
            export_kg = float(item.get("expWgt") or 0)
        except ValueError:
            continue
        observation_date = f"{period[:4]}-{period[5:]}-01"
        base_dimensions = {
            "hs_code": hs_code, "item_name": item.get("statKor") or hs_code,
            "import_usd": float(item.get("impDlr") or 0),
            "trade_balance_usd": float(item.get("balPayments") or 0),
        }
        observations.extend([
            {
                "series_id": f"kr_customs_hs_{hs_code}_export_usd",
                "observation_date": observation_date, "value": export_usd, "unit": "USD",
                "source_url": CUSTOMS_SOURCE_URL, "dimensions": {**base_dimensions, "measure": "export_value"},
            },
            {
                "series_id": f"kr_customs_hs_{hs_code}_export_kg",
                "observation_date": observation_date, "value": export_kg, "unit": "kg",
                "source_url": CUSTOMS_SOURCE_URL, "dimensions": {**base_dimensions, "measure": "export_weight"},
            },
        ])
    return observations


class CustomsMemoryExportService:
    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        if not settings.data_go_kr_service_key:
            return {"status": "configuration_required", "saved": 0,
                    "error": "DATA_GO_KR_SERVICE_KEY가 없습니다."}
        if not force and not self.repo.is_due(FEED_ID):
            return {"status": "cached", "saved": 0}
        attempted = utc_now()
        try:
            # Public-data-portal keys are often stored percent encoded. httpx
            # performs URL encoding itself, so decode exactly once first.
            service_key = urllib.parse.unquote(settings.data_go_kr_service_key)
            observations: list[dict[str, Any]] = []
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                for start, end in customs_query_windows():
                    for hs_code in QUERY_HS_CODES:
                        response = await client.get(CUSTOMS_ENDPOINT, params={
                            "serviceKey": service_key, "strtYymm": start, "endYymm": end,
                            "hsSgn": hs_code, "numOfRows": "1000", "pageNo": "1",
                        })
                        response.raise_for_status()
                        observations.extend(parse_customs_memory_xml(response.content))
            if not observations:
                raise ValueError("관세청 메모리 수출 응답에 유효한 월별 품목이 없습니다.")
            fetched_at = datetime.now(timezone.utc).isoformat()
            for item in observations:
                item["fetched_at"] = fetched_at
            saved = self.repo.save_observations("korea_customs", "memory_exports", observations)
            self.repo.save_status(FEED_ID, "korea_customs", "memory_exports", attempted,
                                  success=True, item_count=saved)
            return {"status": "success", "saved": saved}
        except Exception as exc:
            self.repo.save_status(FEED_ID, "korea_customs", "memory_exports", attempted,
                                  success=False, error=str(exc))
            return {"status": "failed", "saved": 0, "error": str(exc)}


def aggregate_customs_exports(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Aggregate raw HS children without using the provider's total row.

    DRAM chips are decomposed into export value, customs-declared net weight,
    and value per kilogram. MCP and DRAM-module export values are kept as
    separate downstream confirmation lanes. Declared weight is packaging mass,
    not bit shipment volume, and USD/kg is a price/product-mix proxy rather
    than a pure contract price.
    """
    totals: dict[str, float] = defaultdict(float)
    dram: dict[str, float] = defaultdict(float)
    dram_weight: dict[str, float] = defaultdict(float)
    flash: dict[str, float] = defaultdict(float)
    mcp: dict[str, float] = defaultdict(float)
    dram_module: dict[str, float] = defaultdict(float)
    for row in rows:
        hs_code = row.get("dimensions", {}).get("hs_code") or ""
        when = row["observation_date"]
        if row["series_id"].endswith("_export_usd"):
            if hs_code.startswith("854232"):
                totals[when] += float(row["value"])
            if hs_code == DRAM_HS:
                dram[when] += float(row["value"])
            if hs_code == FLASH_HS:
                flash[when] += float(row["value"])
            if hs_code == MCP_HS:
                mcp[when] += float(row["value"])
            if hs_code == DRAM_MODULE_HS:
                dram_module[when] += float(row["value"])
        elif row["series_id"].endswith("_export_kg") and hs_code == DRAM_HS:
            dram_weight[when] += float(row["value"])

    def points(values: dict[str, float]) -> list[dict[str, Any]]:
        return [{"date": when, "value": value} for when, value in sorted(values.items())]

    dram_unit_value = {
        when: value / dram_weight[when]
        for when, value in dram.items()
        if dram_weight.get(when, 0) > 0
    }
    return {
        "memory": points(totals),
        "dram": points(dram),
        "flash": points(flash),
        "mcp": points(mcp),
        "dram_module": points(dram_module),
        "dram_weight": points(dram_weight),
        "dram_unit_value": points(dram_unit_value),
    }
