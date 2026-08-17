"""Shared cache primitives for non-macro regime data providers."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable
from uuid import uuid4

from app.db.database import get_database_client


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ExternalObservationRepository:
    """Small repository that preserves the last successful provider cache."""

    def __init__(self) -> None:
        self.db = get_database_client()

    def is_due(self, feed_id: str, *, success_hours: int = 20, retry_hours: int = 1) -> bool:
        with self.db.connect() as conn:
            row = conn.execute(
                "SELECT * FROM regime_external_fetch_status WHERE feed_id=?", (feed_id,)
            ).fetchone()
        if not row or not row["last_success_at"]:
            return True
        reference = row["last_attempted_at"] if row["status"] == "failed" else row["last_success_at"]
        interval = retry_hours if row["status"] == "failed" else success_hours
        return datetime.now(timezone.utc) - datetime.fromisoformat(reference) >= timedelta(hours=interval)

    def save_observations(
        self,
        source: str,
        dataset: str,
        observations: Iterable[dict[str, Any]],
    ) -> int:
        rows = list(observations)
        if not rows:
            return 0
        fetched_at = utc_now()
        values = []
        for item in rows:
            dimensions = item.get("dimensions") or {}
            values.append((
                str(uuid4()), source, dataset, item["series_id"], item["observation_date"],
                float(item["value"]), item["unit"], item.get("released_at"),
                item.get("fetched_at") or fetched_at, item["source_url"],
                json.dumps(dimensions, ensure_ascii=False, sort_keys=True),
            ))
        with self.db.connect() as conn:
            conn.executemany(
                "INSERT INTO regime_external_observations("
                "id,source,dataset,series_id,observation_date,value,unit,released_at,fetched_at,source_url,dimensions_json"
                ") VALUES(?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(series_id,observation_date) DO UPDATE SET "
                "source=excluded.source,dataset=excluded.dataset,value=excluded.value,unit=excluded.unit,"
                "released_at=excluded.released_at,fetched_at=excluded.fetched_at,"
                "source_url=excluded.source_url,dimensions_json=excluded.dimensions_json",
                values,
            )
        return len(values)

    def save_status(
        self,
        feed_id: str,
        source: str,
        dataset: str,
        attempted_at: str,
        *,
        success: bool,
        item_count: int = 0,
        error: str | None = None,
        status: str | None = None,
    ) -> None:
        resolved_status = status or ("success" if success else "failed")
        if resolved_status not in {"success", "partial", "failed"}:
            raise ValueError(f"지원하지 않는 외부 피드 상태입니다: {resolved_status}")
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO regime_external_fetch_status("
                "feed_id,source,dataset,last_attempted_at,last_success_at,status,item_count,error"
                ") VALUES(?,?,?,?,?,?,?,?) "
                "ON CONFLICT(feed_id) DO UPDATE SET "
                "source=excluded.source,dataset=excluded.dataset,"
                "last_attempted_at=excluded.last_attempted_at,"
                "last_success_at=COALESCE(excluded.last_success_at,regime_external_fetch_status.last_success_at),"
                "status=excluded.status,item_count=excluded.item_count,error=excluded.error",
                (
                    feed_id, source, dataset, attempted_at, utc_now() if success else None,
                    resolved_status, item_count, error[:800] if error else None,
                ),
            )

    def status(self, feed_id: str) -> dict[str, Any] | None:
        with self.db.connect() as conn:
            row = conn.execute(
                "SELECT * FROM regime_external_fetch_status WHERE feed_id=?", (feed_id,)
            ).fetchone()
        return dict(row) if row else None

    def statuses(self, feed_ids: Iterable[str]) -> dict[str, dict[str, Any] | None]:
        return {feed_id: self.status(feed_id) for feed_id in feed_ids}

    def series(self, series_id: str, *, limit: int | None = None) -> list[dict[str, Any]]:
        sql = (
            "SELECT * FROM regime_external_observations WHERE series_id=? "
            "ORDER BY observation_date DESC"
        )
        args: list[Any] = [series_id]
        if limit is not None:
            sql += " LIMIT ?"
            args.append(limit)
        with self.db.connect() as conn:
            rows = [dict(row) for row in conn.execute(sql, args).fetchall()]
        rows.reverse()
        for row in rows:
            row["dimensions"] = json.loads(row.pop("dimensions_json") or "{}")
        return rows

    def matching_series(self, prefix: str) -> list[dict[str, Any]]:
        with self.db.connect() as conn:
            rows = [dict(row) for row in conn.execute(
                "SELECT * FROM regime_external_observations WHERE series_id LIKE ? "
                "ORDER BY observation_date,series_id", (f"{prefix}%",)
            ).fetchall()]
        for row in rows:
            row["dimensions"] = json.loads(row.pop("dimensions_json") or "{}")
        return rows
