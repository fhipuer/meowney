"""FRED/ALFRED vintage ingestion and point-in-time series lookup.

This module intentionally does not alter the current regime evaluation path.  It
provides the append-only data foundation needed to migrate that path safely.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Iterable
from uuid import uuid4

from app.db.sqlite_client import SQLiteClient


FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations"
FRED_VINTAGE_DATES_URL = "https://api.stlouisfed.org/fred/series/vintagedates"


def _iso_date(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be an ISO date")
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise ValueError(f"invalid {field}: {value}") from exc


def initial_release_params(series_id: str, api_key: str, *, limit: int = 100_000,
                           offset: int = 0) -> dict[str, Any]:
    """Build an explicit FRED initial-release request.

    output_type=4 asks FRED/ALFRED for the first published value of each
    observation, rather than today's revised history.
    """
    return {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "output_type": 4,
        # Use FRED's documented open-ended maximum. A local calendar date can
        # already be tomorrow in Asia while FRED is still on the prior US day,
        # which otherwise makes the whole vintage request fail with HTTP 400.
        "realtime_start": "1776-07-04",
        "realtime_end": "9999-12-31",
        "sort_order": "asc",
        "limit": limit,
        "offset": offset,
    }


def recent_vintage_params(
    series_id: str, api_key: str, vintage_dates: list[str], observation_start: str,
) -> dict[str, Any]:
    """Request comparable same-vintage levels for recent revision analysis."""

    return {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "output_type": 2,
        "vintage_dates": ",".join(vintage_dates),
        "observation_start": observation_start,
        "sort_order": "asc",
        "limit": 100_000,
    }


@dataclass(frozen=True)
class VintageObservation:
    indicator_id: str
    observation_date: str
    value: float
    available_from: str
    available_until: str | None
    fetched_at: str
    source: str = "fred"
    source_url: str = FRED_OBSERVATIONS_URL
    quality_status: str = "official"
    vintage_kind: str = "initial"
    release_date: str | None = None


def parse_initial_release_observations(indicator_id: str, payload: dict[str, Any],
                                       fetched_at: str) -> list[VintageObservation]:
    """Normalize a FRED ``output_type=4`` response.

    Missing-value markers (``.``) are ignored.  FRED's realtime_start is the
    availability proxy used for point-in-time evaluation; it is deliberately
    not mislabeled as the source agency's release date.
    """
    datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
    result: list[VintageObservation] = []
    for item in payload.get("observations", []):
        try:
            value = float(item.get("value"))
        except (TypeError, ValueError):
            continue
        available_from = _iso_date(item.get("realtime_start"), "realtime_start")
        raw_end = item.get("realtime_end")
        available_until = _iso_date(raw_end, "realtime_end") if raw_end else None
        result.append(VintageObservation(
            indicator_id=indicator_id,
            observation_date=_iso_date(item.get("date"), "observation date"),
            value=value,
            available_from=available_from,
            available_until=available_until,
            fetched_at=fetched_at,
        ))
    return result


def parse_vintage_date_observations(
    indicator_id: str,
    source_key: str,
    payload: dict[str, Any],
    fetched_at: str,
) -> list[VintageObservation]:
    """Normalize FRED output_type=2 columns into append-only vintage rows."""

    datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
    prefix = f"{source_key}_"
    result: list[VintageObservation] = []
    for item in payload.get("observations", []):
        observation_date = _iso_date(item.get("date"), "observation date")
        vintage_values = []
        for key, raw_value in item.items():
            if not key.startswith(prefix):
                continue
            try:
                value = float(raw_value)
                available_from = _iso_date(
                    datetime.strptime(key.removeprefix(prefix), "%Y%m%d").date().isoformat(),
                    "vintage date",
                )
            except (TypeError, ValueError):
                continue
            vintage_values.append((available_from, value))
        for available_from, value in sorted(vintage_values):
            result.append(VintageObservation(
                indicator_id=indicator_id,
                observation_date=observation_date,
                value=value,
                available_from=available_from,
                available_until=None,
                fetched_at=fetched_at,
                # output_type=2 does not itself identify the first release.
                # The dedicated output_type=4 ingest owns the "initial" label.
                vintage_kind="revision",
            ))
    return result


class RegimeVintageRepository:
    def __init__(self, db: SQLiteClient):
        self.db = db

    def save(self, observations: Iterable[VintageObservation],
             fetch_run_id: str | None = None) -> int:
        """Idempotently persist vintage rows without overwriting prior versions."""
        rows = list(observations)
        if not rows:
            return 0
        with self.db.connect() as conn:
            before = conn.total_changes
            conn.executemany(
                "INSERT INTO regime_observation_vintages("
                "id,indicator_id,observation_date,value,available_from,available_until,release_date,"
                "fetched_at,fetch_run_id,source,source_url,quality_status,vintage_kind) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(indicator_id,observation_date,available_from) DO NOTHING",
                [
                    (str(uuid4()), row.indicator_id, row.observation_date, row.value,
                     row.available_from, row.available_until, row.release_date, row.fetched_at,
                     fetch_run_id, row.source, row.source_url, row.quality_status, row.vintage_kind)
                    for row in rows
                ],
            )
            return conn.total_changes - before

    def series_as_of(self, indicator_id: str, as_of: date | str) -> list[dict[str, Any]]:
        """Return the value version knowable at end-of-day ``as_of``.

        A row's realtime interval is inclusive.  The ROW_NUMBER guard also
        handles imperfect or overlapping upstream intervals deterministically.
        """
        cutoff = _iso_date(as_of.isoformat() if isinstance(as_of, date) else as_of, "as_of")
        with self.db.connect() as conn:
            rows = conn.execute(
                "WITH candidates AS ("
                " SELECT v.*, ROW_NUMBER() OVER ("
                "  PARTITION BY v.indicator_id,v.observation_date"
                "  ORDER BY v.available_from DESC,v.fetched_at DESC,v.id DESC"
                " ) AS rn"
                " FROM regime_observation_vintages v"
                " WHERE v.indicator_id=? AND v.observation_date<=? AND v.available_from<=?"
                " AND (v.available_until IS NULL OR v.available_until>=?)"
                ") SELECT observation_date,value,available_from,available_until,release_date,"
                "fetched_at,source,quality_status,vintage_kind FROM candidates WHERE rn=1 "
                "ORDER BY observation_date",
                (indicator_id, cutoff, cutoff, cutoff),
            ).fetchall()
        return [dict(row) for row in rows]
