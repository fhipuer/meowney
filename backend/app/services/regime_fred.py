"""FRED paging and history-window policy for regime ingestion."""

from __future__ import annotations

import asyncio
from datetime import date, timedelta
import re
from typing import Any

import httpx


PAGE_SIZE = 1000
HISTORY_YEARS = {"daily": 10, "weekly": 15, "monthly": 30, "quarterly": 40}
INCREMENTAL_OVERLAP_DAYS = {
    "daily": 45,
    "weekly": 120,
    "monthly": 400,
    "quarterly": 800,
}
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class FredFetchError(RuntimeError):
    """A sanitized FRED error that never embeds the API-key query string."""


def history_start(frequency: str, today: date | None = None) -> str:
    today = today or date.today()
    years = HISTORY_YEARS.get(frequency, 20)
    try:
        return today.replace(year=today.year - years).isoformat()
    except ValueError:
        return today.replace(year=today.year - years, day=28).isoformat()


def incremental_start(
    frequency: str,
    last_observation_date: str | None,
    today: date | None = None,
) -> str:
    """Return a bounded refresh window with enough overlap for revisions."""

    floor = date.fromisoformat(history_start(frequency, today))
    if not last_observation_date:
        return floor.isoformat()
    try:
        latest = date.fromisoformat(last_observation_date[:10])
    except (TypeError, ValueError):
        return floor.isoformat()
    overlap = timedelta(days=INCREMENTAL_OVERLAP_DAYS.get(frequency, 400))
    return max(floor, latest - overlap).isoformat()


def safe_error_message(exc: BaseException, api_key: str | None = None) -> str:
    """Keep actionable failure detail while redacting URL credentials."""

    message = str(exc) or type(exc).__name__
    if api_key:
        message = message.replace(api_key, "[redacted]")
    message = re.sub(r"(?i)(api_key=)[^&\s]+", r"\1[redacted]", message)
    message = re.sub(r"https?://\S+", "[url redacted]", message)
    return f"{type(exc).__name__}: {message}"[:300]


def _fred_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    detail = payload.get("error_message") if isinstance(payload, dict) else None
    return str(detail)[:180] if detail else "request failed"


async def fetch_json(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any],
    *,
    max_attempts: int = 3,
    backoff_seconds: float = .25,
) -> dict[str, Any]:
    """Fetch one FRED JSON response with bounded transient retries."""

    response: httpx.Response | None = None
    for attempt in range(max_attempts):
        try:
            response = await client.get(url, params=params)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            if attempt + 1 >= max_attempts:
                raise FredFetchError(
                    f"FRED transport failed after {max_attempts} attempts: {type(exc).__name__}"
                ) from None
        else:
            if response.status_code not in RETRYABLE_STATUS:
                break
            if attempt + 1 >= max_attempts:
                raise FredFetchError(
                    f"FRED HTTP {response.status_code} after {max_attempts} attempts: "
                    f"{_fred_error_detail(response)}"
                )
        if backoff_seconds:
            await asyncio.sleep(backoff_seconds * (2 ** attempt))
    if response is None:
        raise FredFetchError("FRED request produced no response")
    if response.is_error:
        raise FredFetchError(
            f"FRED HTTP {response.status_code}: {_fred_error_detail(response)}"
        )
    try:
        payload = response.json()
    except ValueError:
        raise FredFetchError("FRED returned invalid JSON") from None
    if not isinstance(payload, dict):
        raise FredFetchError("FRED returned an unexpected JSON payload")
    return payload


async def fetch_all_pages(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any],
    *,
    page_size: int = PAGE_SIZE,
    max_attempts: int = 3,
    backoff_seconds: float = .25,
) -> list[dict[str, Any]]:
    """Fetch every FRED observation page deterministically."""
    offset = 0
    rows: list[dict[str, Any]] = []
    while True:
        payload = await fetch_json(
            client,
            url,
            {**params, "limit": page_size, "offset": offset},
            max_attempts=max_attempts,
            backoff_seconds=backoff_seconds,
        )
        page = payload.get("observations", [])
        rows.extend(page)
        count = int(payload.get("count", len(rows)))
        offset += len(page)
        if not page or offset >= count:
            return rows
