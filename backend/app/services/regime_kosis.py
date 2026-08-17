"""KOSIS semiconductor production, shipments and inventory cache."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.services.regime_external import ExternalObservationRepository, utc_now


KOSIS_ENDPOINT = "https://kosis.kr/openapi/Param/statisticsParameterData.do"
KOSIS_TABLE_URL = "https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1F02001"
FEED_ID = "kosis_semiconductor"
ITEM_SERIES = {
    "T10": ("kr_semiconductor_production_original", "생산지수(원지수)"),
    "T11": ("kr_semiconductor_shipments_original", "출하지수(원지수)"),
    "T12": ("kr_semiconductor_inventory_original", "재고지수(원지수)"),
    "T20": ("kr_semiconductor_production_sa", "생산지수(계절조정)"),
    "T21": ("kr_semiconductor_shipments_sa", "출하지수(계절조정)"),
    "T22": ("kr_semiconductor_inventory_sa", "재고지수(계절조정)"),
}


def _number(value: Any) -> float | None:
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def parse_kosis_semiconductor(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Validate the fixed KOSIS table mapping and normalize monthly rows."""
    observations: list[dict[str, Any]] = []
    for row in rows:
        item_id = row.get("ITM_ID")
        period = str(row.get("PRD_DE") or "")
        value = _number(row.get("DT"))
        if (
            item_id not in ITEM_SERIES
            or len(period) != 6
            or not period.isdigit()
            or value is None
            or row.get("ORG_ID") != "101"
            or row.get("TBL_ID") != "DT_1F02001"
            or row.get("C1") != "00"
            or row.get("C2") != "C261"
        ):
            continue
        series_id, expected_name = ITEM_SERIES[item_id]
        observations.append({
            "series_id": series_id,
            "observation_date": f"{period[:4]}-{period[4:]}-01",
            "value": value,
            "unit": "2020=100",
            "released_at": row.get("LST_CHN_DE"),
            "source_url": KOSIS_TABLE_URL,
            "dimensions": {
                "org_id": "101", "table_id": "DT_1F02001", "region_code": "00",
                "industry_code": "C261", "item_id": item_id,
                "item_name": row.get("ITM_NM") or expected_name,
                "industry_name": row.get("C2_NM") or "반도체 제조업",
                "seasonally_adjusted": item_id.startswith("T2"),
            },
        })
    return observations


class KosisSemiconductorService:
    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        if not settings.kosis_api_key:
            return {"status": "configuration_required", "saved": 0, "error": "KOSIS_API_KEY가 없습니다."}
        if not force and not self.repo.is_due(FEED_ID):
            return {"status": "cached", "saved": 0}
        attempted = utc_now()
        try:
            params = {
                "method": "getList", "apiKey": settings.kosis_api_key,
                "orgId": "101", "tblId": "DT_1F02001", "objL1": "00",
                "objL2": "C261", "itmId": "ALL", "prdSe": "M",
                "newEstPrdCnt": "60", "format": "json", "jsonVD": "Y",
            }
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                response = await client.get(KOSIS_ENDPOINT, params=params)
                response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                raise ValueError(payload.get("errMsg", "KOSIS가 목록이 아닌 응답을 반환했습니다."))
            observations = parse_kosis_semiconductor(payload)
            found = {item["series_id"] for item in observations}
            if set(series for series, _ in ITEM_SERIES.values()) - found:
                raise ValueError("KOSIS 반도체 생산·출하·재고 표 매핑이 변경됐습니다.")
            fetched_at = datetime.now(timezone.utc).isoformat()
            for item in observations:
                item["fetched_at"] = fetched_at
            saved = self.repo.save_observations("kosis", "semiconductor_indices", observations)
            self.repo.save_status(FEED_ID, "kosis", "semiconductor_indices", attempted,
                                  success=True, item_count=saved)
            return {"status": "success", "saved": saved}
        except Exception as exc:
            self.repo.save_status(FEED_ID, "kosis", "semiconductor_indices", attempted,
                                  success=False, error=str(exc))
            return {"status": "failed", "saved": 0, "error": str(exc)}
