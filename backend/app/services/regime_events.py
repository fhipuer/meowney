"""미국 주요 경제지표 발표 일정을 동기화해 레짐 화면에 제공한다."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.db.database import get_database_client


FRED_RELEASE_DATES_API = "https://api.stlouisfed.org/fred/release/dates"
FRED_RELEASE_PAGE = "https://fred.stlouisfed.org/release"
EVENT_FEED_SOURCE = "macro_events"
LOOKAHEAD_DAYS = 370


@dataclass(frozen=True)
class FredRelease:
    release_id: int
    title: str
    affected_domains: tuple[str, ...]
    importance: str = "high"

    @property
    def source_url(self) -> str:
        return f"{FRED_RELEASE_PAGE}?rid={self.release_id}"


FRED_RELEASES = (
    FredRelease(10, "CPI", ("inflation", "rates")),
    FredRelease(46, "PPI", ("inflation",)),
    FredRelease(50, "미국 고용보고서", ("growth", "rates")),
    FredRelease(192, "JOLTS", ("growth",)),
    FredRelease(53, "미국 GDP", ("growth", "rates")),
    FredRelease(54, "PCE·개인소득", ("growth", "inflation", "rates")),
    FredRelease(9, "미국 소매판매", ("growth", "rates")),
)


def _safe_error(exc: Exception) -> str:
    """상태 캐시에 API 키가 포함된 요청 URL을 남기지 않는다."""
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}"
    if isinstance(exc, httpx.RequestError):
        return type(exc).__name__
    return f"{type(exc).__name__}: {exc}"


def parse_fred_release_dates(
    payload: dict[str, Any],
    release: FredRelease,
    *,
    start_date: date,
    end_date: date,
) -> list[dict[str, Any]]:
    """FRED 응답에서 조회 구간에 속한 발표일만 정규화한다."""
    raw_dates = payload.get("release_dates")
    if not isinstance(raw_dates, list):
        raise ValueError("FRED release_dates 응답 형식이 올바르지 않습니다.")

    dates: set[date] = set()
    for item in raw_dates:
        if not isinstance(item, dict) or not isinstance(item.get("date"), str):
            continue
        try:
            scheduled_date = date.fromisoformat(item["date"])
        except ValueError:
            continue
        if start_date <= scheduled_date <= end_date:
            dates.add(scheduled_date)

    return [
        {
            "release_id": release.release_id,
            "title": release.title,
            "scheduled_date": scheduled_date.isoformat(),
            "scheduled_at": None,
            "time_precision": "date",
            "importance": release.importance,
            "affected_domains": list(release.affected_domains),
            "source": "FRED",
            "source_url": release.source_url,
        }
        for scheduled_date in sorted(dates)
    ]


class RegimeEventService:
    def __init__(self, *, api_key: str | None = None, client_factory=None) -> None:
        self.db = get_database_client()
        self.api_key = settings.fred_api_key if api_key is None else api_key
        self.client_factory = client_factory or httpx.AsyncClient

    async def _fetch_release(
        self,
        client: httpx.AsyncClient,
        release: FredRelease,
        start_date: date,
        end_date: date,
    ) -> list[dict[str, Any]]:
        response = await client.get(
            FRED_RELEASE_DATES_API,
            params={
                "release_id": release.release_id,
                "api_key": self.api_key,
                "file_type": "json",
                "include_release_dates_with_no_data": "true",
                "sort_order": "desc",
                "limit": 48,
            },
        )
        response.raise_for_status()
        return parse_fred_release_dates(
            response.json(), release, start_date=start_date, end_date=end_date
        )

    @staticmethod
    def _upsert_feed_status(
        conn,
        *,
        attempted: str,
        status: str,
        item_count: int,
        error: str | None,
        successful: bool,
    ) -> None:
        conn.execute(
            "INSERT INTO regime_feed_status(source,last_attempted_at,last_success_at,status,item_count,error) "
            "VALUES(?,?,?,?,?,?) ON CONFLICT(source) DO UPDATE SET "
            "last_attempted_at=excluded.last_attempted_at,"
            "last_success_at=COALESCE(excluded.last_success_at,regime_feed_status.last_success_at),"
            "status=excluded.status,item_count=excluded.item_count,error=excluded.error",
            (
                EVENT_FEED_SOURCE,
                attempted,
                attempted if successful else None,
                status,
                item_count,
                error,
            ),
        )

    def _record_failure(self, attempted: str, status: str, error: str) -> dict[str, Any]:
        error = error[:800]
        with self.db.connect() as conn:
            self._upsert_feed_status(
                conn,
                attempted=attempted,
                status=status,
                item_count=0,
                error=error,
                successful=False,
            )
        return {"status": status, "saved": 0, "source": "FRED", "error": error}

    def _persist(
        self,
        successful_releases: list[tuple[FredRelease, list[dict[str, Any]]]],
        *,
        attempted: str,
        status: str,
        error: str | None,
        today: date,
    ) -> int:
        events = [event for _, release_events in successful_releases for event in release_events]
        with self.db.connect() as conn:
            for release, _ in successful_releases:
                # 일정 변경 시 예전 미래 날짜가 중복 표시되지 않도록 해당 발표만 교체한다.
                conn.execute(
                    "DELETE FROM regime_events WHERE status='scheduled' AND event_type=? "
                    "AND source IN ('FRED','BLS') "
                    "AND COALESCE(scheduled_date,substr(scheduled_at,1,10))>=?",
                    (release.title, today.isoformat()),
                )
            for item in events:
                event_id = str(
                    uuid5(
                        NAMESPACE_URL,
                        f"FRED:{item['release_id']}:{item['scheduled_date']}",
                    )
                )
                conn.execute(
                    "INSERT INTO regime_events("
                    "id,event_type,scheduled_at,scheduled_date,time_precision,importance,"
                    "affected_domains_json,status,source,source_url"
                    ") VALUES(?,?,?,?,?,?,?,'scheduled',?,?) "
                    "ON CONFLICT(id) DO UPDATE SET "
                    "event_type=excluded.event_type,scheduled_at=excluded.scheduled_at,"
                    "scheduled_date=excluded.scheduled_date,time_precision=excluded.time_precision,"
                    "importance=excluded.importance,"
                    "affected_domains_json=excluded.affected_domains_json,status='scheduled',"
                    "source=excluded.source,source_url=excluded.source_url",
                    (
                        event_id,
                        item["title"],
                        item["scheduled_at"],
                        item["scheduled_date"],
                        item["time_precision"],
                        item["importance"],
                        json.dumps(item["affected_domains"], ensure_ascii=False),
                        item["source"],
                        item["source_url"],
                    ),
                )
            self._upsert_feed_status(
                conn,
                attempted=attempted,
                status=status,
                item_count=len(events),
                error=error,
                successful=True,
            )
        return len(events)

    async def refresh(self) -> dict[str, Any]:
        attempted = datetime.now(timezone.utc).isoformat()
        if not self.api_key:
            return self._record_failure(
                attempted,
                "configuration_required",
                "FRED_API_KEY가 설정되지 않았습니다.",
            )

        today = datetime.now(ZoneInfo(settings.timezone)).date()
        end_date = today + timedelta(days=LOOKAHEAD_DAYS)
        try:
            async with self.client_factory(
                timeout=30,
                headers={"User-Agent": settings.sec_user_agent},
            ) as client:
                results = await asyncio.gather(
                    *(
                        self._fetch_release(client, release, today, end_date)
                        for release in FRED_RELEASES
                    ),
                    return_exceptions=True,
                )
        except Exception as exc:
            return self._record_failure(
                attempted,
                "failed",
                _safe_error(exc),
            )

        successful_releases: list[tuple[FredRelease, list[dict[str, Any]]]] = []
        errors: list[str] = []
        for release, result in zip(FRED_RELEASES, results):
            if isinstance(result, Exception):
                errors.append(f"{release.title}: {_safe_error(result)}")
            else:
                successful_releases.append((release, result))

        if not successful_releases:
            return self._record_failure(attempted, "failed", " · ".join(errors))

        status = "partial" if errors else "success"
        error = " · ".join(errors)[:800] or None
        saved = self._persist(
            successful_releases,
            attempted=attempted,
            status=status,
            error=error,
            today=today,
        )
        return {
            "status": status,
            "saved": saved,
            "source": "FRED",
            "error": error,
        }

    def health(self) -> dict[str, Any] | None:
        with self.db.connect() as conn:
            row = conn.execute(
                "SELECT * FROM regime_feed_status WHERE source=?",
                (EVENT_FEED_SOURCE,),
            ).fetchone()
        return dict(row) if row else None

    def upcoming(self, limit: int = 5) -> list[dict[str, Any]]:
        today = datetime.now(ZoneInfo(settings.timezone)).date().isoformat()
        with self.db.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM regime_events "
                "WHERE COALESCE(scheduled_date,substr(scheduled_at,1,10))>=? "
                "ORDER BY COALESCE(scheduled_date,substr(scheduled_at,1,10)),scheduled_at "
                "LIMIT ?",
                (today, limit),
            ).fetchall()
        return [
            {
                **dict(row),
                "affected_domains": json.loads(row["affected_domains_json"]),
            }
            for row in rows
        ]
