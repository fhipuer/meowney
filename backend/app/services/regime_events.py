"""공식 발표 일정을 동기화해 레짐 화면에 제공한다."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import uuid5, NAMESPACE_URL
from zoneinfo import ZoneInfo

import httpx

from app.db.database import get_database_client


BLS_ICS = "https://www.bls.gov/schedule/news_release/bls.ics"
IMPORTANT_BLS = {
    "Consumer Price Index": ("CPI", ["inflation", "rates"]),
    "Employment Situation": ("미국 고용보고서", ["growth", "rates"]),
    "Producer Price Index": ("PPI", ["inflation"]),
    "Job Openings and Labor Turnover Survey": ("JOLTS", ["growth"]),
}


def parse_ics(text: str) -> list[dict]:
    unfolded = re.sub(r"\r?\n[ \t]", "", text)
    events = []
    for block in unfolded.split("BEGIN:VEVENT")[1:]:
        summary = re.search(r"^SUMMARY:(.+)$", block, re.MULTILINE)
        start = re.search(r"^DTSTART(?:;TZID=([^:]+))?:(\d{8}T\d{6})", block, re.MULTILINE)
        if not summary or not start:
            continue
        raw_title = summary.group(1).replace("\\,", ",").strip()
        match = next(((prefix, value) for prefix, value in IMPORTANT_BLS.items() if raw_title.startswith(prefix)), None)
        if not match:
            continue
        timezone_name = start.group(1) or "America/New_York"
        timezone_name = {"US-Eastern": "America/New_York", "Eastern Standard Time": "America/New_York"}.get(
            timezone_name, timezone_name
        )
        local = datetime.strptime(start.group(2), "%Y%m%dT%H%M%S").replace(tzinfo=ZoneInfo(timezone_name))
        label, domains = match[1]
        events.append({"title": label, "scheduled_at": local.astimezone(timezone.utc).isoformat(),
                       "affected_domains": domains})
    return events


class RegimeEventService:
    def __init__(self) -> None:
        self.db = get_database_client()

    async def refresh(self) -> dict:
        attempted = datetime.now(timezone.utc).isoformat()
        try:
            async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "Meowney personal portfolio app"}) as client:
                response = await client.get(BLS_ICS)
                response.raise_for_status()
            events = parse_ics(response.text)
            with self.db.connect() as conn:
                for item in events:
                    event_id = str(uuid5(NAMESPACE_URL, f"{BLS_ICS}:{item['title']}:{item['scheduled_at']}"))
                    conn.execute(
                        "INSERT INTO regime_events(id,event_type,scheduled_at,importance,affected_domains_json,status,source,source_url) "
                        "VALUES(?,?,?,?,?,'scheduled','BLS',?) ON CONFLICT(id) DO UPDATE SET scheduled_at=excluded.scheduled_at,affected_domains_json=excluded.affected_domains_json",
                        (event_id, item["title"], item["scheduled_at"], "high", __import__("json").dumps(item["affected_domains"]), BLS_ICS),
                    )
                conn.execute(
                    "INSERT INTO regime_feed_status(source,last_attempted_at,last_success_at,status,item_count,error) "
                    "VALUES('bls_events',?,?,'success',?,NULL) ON CONFLICT(source) DO UPDATE SET "
                    "last_attempted_at=excluded.last_attempted_at,last_success_at=excluded.last_success_at,"
                    "status='success',item_count=excluded.item_count,error=NULL",
                    (attempted, attempted, len(events)),
                )
            return {"status": "success", "saved": len(events)}
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"[:800]
            with self.db.connect() as conn:
                conn.execute(
                    "INSERT INTO regime_feed_status(source,last_attempted_at,last_success_at,status,item_count,error) "
                    "VALUES('bls_events',?,NULL,'failed',0,?) ON CONFLICT(source) DO UPDATE SET "
                    "last_attempted_at=excluded.last_attempted_at,status='failed',error=excluded.error",
                    (attempted, error),
                )
            return {"status": "failed", "saved": 0, "error": error}

    def health(self) -> dict | None:
        with self.db.connect() as conn:
            row = conn.execute(
                "SELECT * FROM regime_feed_status WHERE source='bls_events'"
            ).fetchone()
        return dict(row) if row else None

    def upcoming(self, limit: int = 5) -> list[dict]:
        now = datetime.now(timezone.utc).isoformat()
        with self.db.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM regime_events WHERE scheduled_at>=? ORDER BY scheduled_at LIMIT ?", (now, limit)
            ).fetchall()
        return [{**dict(row), "affected_domains": __import__("json").loads(row["affected_domains_json"])} for row in rows]
