"""FRED paging and history-window policy for regime ingestion."""

from __future__ import annotations

from datetime import date
from typing import Any

import httpx


PAGE_SIZE = 1000
HISTORY_YEARS = {"daily": 10, "weekly": 15, "monthly": 30, "quarterly": 40}


def history_start(frequency: str, today: date | None = None) -> str:
    today = today or date.today()
    years = HISTORY_YEARS.get(frequency, 20)
    try:
        return today.replace(year=today.year - years).isoformat()
    except ValueError:
        return today.replace(year=today.year - years, day=28).isoformat()


async def fetch_all_pages(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any],
    *,
    page_size: int = PAGE_SIZE,
) -> list[dict[str, Any]]:
    """Fetch every FRED observation page deterministically."""
    offset = 0
    rows: list[dict[str, Any]] = []
    while True:
        response = await client.get(url, params={**params, "limit": page_size, "offset": offset})
        if response.is_error:
            raise RuntimeError(f"FRED HTTP {response.status_code}")
        payload = response.json()
        page = payload.get("observations", [])
        rows.extend(page)
        count = int(payload.get("count", len(rows)))
        offset += len(page)
        if not page or offset >= count:
            return rows
