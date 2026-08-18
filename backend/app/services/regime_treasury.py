"""Official U.S. Treasury nominal and real long-end yield cache."""

from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable
from uuid import uuid4

import httpx

from app.db.database import get_database_client


TREASURY_XML_URL = (
    "https://home.treasury.gov/resource-center/data-chart-center/"
    "interest-rates/pages/xml"
)
TREASURY_CURVE_URL = (
    "https://home.treasury.gov/resource-center/data-chart-center/"
    "interest-rates/TextView?type=daily_treasury_yield_curve"
)
FEED_SOURCE = "treasury_curve"
ATOM_NS = "http://www.w3.org/2005/Atom"
METADATA_NS = "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_treasury_curve_xml(
    content: bytes,
    fields: dict[str, str],
) -> dict[str, list[tuple[str, float]]]:
    """Parse Treasury's Atom XML into logical indicator observations."""

    root = ET.fromstring(content)
    result = {indicator_id: [] for indicator_id in fields.values()}
    namespaces = {"atom": ATOM_NS, "m": METADATA_NS}
    for entry in root.findall("atom:entry", namespaces):
        properties = entry.find("atom:content/m:properties", namespaces)
        if properties is None:
            continue
        values = {node.tag.rsplit("}", 1)[-1]: node.text for node in properties}
        raw_date = values.get("NEW_DATE")
        if not raw_date:
            continue
        observation_date = raw_date[:10]
        for field, indicator_id in fields.items():
            try:
                value = float(values[field])
            except (KeyError, TypeError, ValueError):
                continue
            result[indicator_id].append((observation_date, value))
    return result


class TreasuryYieldService:
    """Refresh official 30-year nominal and real yields without an API key."""

    DATASETS = {
        "daily_treasury_yield_curve": {
            "BC_10YEAR": "us10y",
            "BC_30YEAR": "us30y",
        },
        "daily_treasury_real_yield_curve": {
            "TC_10YEAR": "tips10y",
            "TC_30YEAR": "tips30y",
        },
    }

    def __init__(
        self,
        db: Any | None = None,
        client_factory: Callable[..., httpx.AsyncClient] = httpx.AsyncClient,
    ) -> None:
        self.db = db or get_database_client()
        self.client_factory = client_factory

    def _is_due(self, *, success_hours: int = 8, retry_hours: int = 1) -> bool:
        with self.db.connect() as conn:
            row = conn.execute(
                "SELECT * FROM regime_feed_status WHERE source=?", (FEED_SOURCE,)
            ).fetchone()
        if not row or not row["last_success_at"]:
            return True
        reference = row["last_attempted_at"] if row["status"] == "failed" else row["last_success_at"]
        interval = retry_hours if row["status"] == "failed" else success_hours
        return datetime.now(timezone.utc) - datetime.fromisoformat(reference) >= timedelta(hours=interval)

    def _save_feed_status(
        self,
        attempted_at: str,
        *,
        status: str,
        item_count: int,
        error: str | None = None,
    ) -> None:
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO regime_feed_status("
                "source,last_attempted_at,last_success_at,status,item_count,error"
                ") VALUES(?,?,?,?,?,?) ON CONFLICT(source) DO UPDATE SET "
                "last_attempted_at=excluded.last_attempted_at,"
                "last_success_at=COALESCE(excluded.last_success_at,regime_feed_status.last_success_at),"
                "status=excluded.status,item_count=excluded.item_count,error=excluded.error",
                (
                    FEED_SOURCE,
                    attempted_at,
                    _now() if status in {"success", "partial"} and item_count else None,
                    status,
                    item_count,
                    error[:800] if error else None,
                ),
            )

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        if not force and not self._is_due():
            return {"status": "cached", "source": FEED_SOURCE, "saved": 0}

        attempted_at = _now()
        years = (date.today().year - 1, date.today().year)
        requests = [
            (dataset, fields, year)
            for dataset, fields in self.DATASETS.items()
            for year in years
        ]

        async def fetch_one(
            client: httpx.AsyncClient,
            dataset: str,
            fields: dict[str, str],
            year: int,
        ) -> dict[str, list[tuple[str, float]]]:
            response = await client.get(
                TREASURY_XML_URL,
                params={"data": dataset, "field_tdr_date_value": str(year)},
            )
            response.raise_for_status()
            return parse_treasury_curve_xml(response.content, fields)

        async with self.client_factory(timeout=45, follow_redirects=True) as client:
            batches = await asyncio.gather(
                *(fetch_one(client, *request) for request in requests),
                return_exceptions=True,
            )

        errors = [f"{type(item).__name__}: {item}" for item in batches if isinstance(item, Exception)]
        observations: dict[str, dict[str, float]] = {
            "us10y": {}, "us30y": {}, "tips10y": {}, "tips30y": {},
        }
        for batch in batches:
            if isinstance(batch, Exception):
                continue
            for indicator_id, rows in batch.items():
                observations[indicator_id].update(rows)

        fetched_at = _now()
        rows = [
            (str(uuid4()), indicator_id, observation_date, value, fetched_at, "treasury")
            for indicator_id, by_date in observations.items()
            for observation_date, value in sorted(by_date.items())
        ]
        with self.db.connect() as conn:
            conn.executemany(
                "INSERT INTO regime_observations("
                "id,indicator_id,observation_date,value,fetched_at,source"
                ") VALUES(?,?,?,?,?,?) ON CONFLICT(indicator_id,observation_date) DO UPDATE SET "
                "value=excluded.value,fetched_at=excluded.fetched_at,source=excluded.source",
                rows,
            )
            for indicator_id in observations:
                last_date = max(observations[indicator_id], default=None)
                success = bool(last_date)
                conn.execute(
                    "INSERT INTO regime_indicator_fetch_status("
                    "indicator_id,last_attempted_at,last_success_at,last_observation_date,status,"
                    "failure_count,retry_after,error"
                    ") VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(indicator_id) DO UPDATE SET "
                    "last_attempted_at=excluded.last_attempted_at,"
                    "last_success_at=COALESCE(excluded.last_success_at,regime_indicator_fetch_status.last_success_at),"
                    "last_observation_date=COALESCE(excluded.last_observation_date,regime_indicator_fetch_status.last_observation_date),"
                    "status=excluded.status,failure_count=excluded.failure_count,"
                    "retry_after=excluded.retry_after,error=excluded.error",
                    (
                        indicator_id,
                        attempted_at,
                        fetched_at if success else None,
                        last_date,
                        "success" if success else "failed",
                        0 if success else 1,
                        None if success else (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                        None if success else "Treasury series unavailable",
                    ),
                )

        status = "failed" if not rows else "partial" if errors else "success"
        self._save_feed_status(
            attempted_at,
            status=status,
            item_count=len(rows),
            error="; ".join(errors[:3]) if errors else None,
        )
        return {
            "status": status,
            "source": FEED_SOURCE,
            "saved": len(rows),
            "last_observation_date": max(
                (date_value for values in observations.values() for date_value in values),
                default=None,
            ),
            "errors": errors[:3],
            "source_url": TREASURY_CURVE_URL,
        }
