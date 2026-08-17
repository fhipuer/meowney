"""EIA electricity-demand, generation and capacity cache."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.services.regime_external import ExternalObservationRepository, utc_now


EIA_BASE = "https://api.eia.gov/v2"
EIA_DOC_URL = "https://www.eia.gov/opendata/documentation.php"
FEED_ID = "eia_power"


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
            "series_id": series_id, "observation_date": observation_date,
            "value": value,
            "unit": row.get(f"{value_field}-units") or (
                "megawatts" if value_field == "net-summer-capacity" else "unknown"
            ),
            "source_url": source_url,
            "dimensions": {
                key: value for key, value in row.items()
                if key not in {value_field, f"{value_field}-units"}
            },
        })
    return observations


class EiaPowerService:
    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        if not settings.eia_api_key:
            return {"status": "configuration_required", "saved": 0, "error": "EIA_API_KEY가 없습니다."}
        if not force and not self.repo.is_due(FEED_ID, success_hours=48):
            return {"status": "cached", "saved": 0}
        attempted = utc_now()
        try:
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
            async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
                retail_response, generation_response, capacity_response = await asyncio.gather(
                    client.get(f"{EIA_BASE}/electricity/retail-sales/data/", params=retail_params),
                    client.get(f"{EIA_BASE}/electricity/electric-power-operational-data/data/", params=generation_params),
                    client.get(f"{EIA_BASE}/electricity/state-electricity-profiles/summary/data/", params=capacity_params),
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
                generation_response.json(), {"99": ("us_electricity_net_generation", "generation")},
                "https://www.eia.gov/electricity/data/browser/#/topic/0",
            )
            observations += parse_eia_rows(
                capacity_response.json(), {"US": ("us_electricity_net_summer_capacity", "net-summer-capacity")},
                "https://www.eia.gov/electricity/state/",
            )
            required = {
                "us_electricity_sales_all", "us_electricity_sales_commercial",
                "us_electricity_sales_industrial", "us_electricity_net_generation",
                "us_electricity_net_summer_capacity",
            }
            if required - {item["series_id"] for item in observations}:
                raise ValueError("EIA 전력 판매·발전·설비용량 응답이 불완전합니다.")
            fetched_at = datetime.now(timezone.utc).isoformat()
            for item in observations:
                item["fetched_at"] = fetched_at
            saved = self.repo.save_observations("eia", "us_power", observations)
            self.repo.save_status(FEED_ID, "eia", "us_power", attempted, success=True, item_count=saved)
            return {"status": "success", "saved": saved}
        except Exception as exc:
            self.repo.save_status(FEED_ID, "eia", "us_power", attempted, success=False, error=str(exc))
            return {"status": "failed", "saved": 0, "error": str(exc)}
