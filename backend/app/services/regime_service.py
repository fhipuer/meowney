"""거시 데이터 캐시와 결정론적 투자 레짐 판정 서비스."""

from __future__ import annotations

import hashlib
import json
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import httpx

from app.config import settings
from app.db.database import get_database_client
from app.services.regime_rules import (
    RULE_VERSION,
    SEVERITY_RANK,
    calculate_coverage,
    calculate_review_urgency,
    decision_usable,
    evaluate_triggers,
    signal_freshness,
)
from app.services.regime_quadrant import calculate_us_macro_quadrant
from app.services.finance_service import get_finance_service
from app.services.regime_catalog import (
    decision_chart,
    display_history,
    display_metrics,
    display_period,
    indicator_role,
    indicator_semantics,
)
from app.services.regime_fred import (
    fetch_all_pages,
    fetch_json,
    history_start,
    incremental_start,
    safe_error_message,
)
from app.services.regime_periods import (
    annualized_change,
    continuity_gaps,
    period_delta,
    period_percent_change,
)
from app.services.regime_vintage import (
    FRED_VINTAGE_DATES_URL,
    RegimeVintageRepository,
    initial_release_params,
    parse_initial_release_observations,
    parse_vintage_date_observations,
    recent_vintage_params,
)


REGIME_ORDER = ["유지", "경계", "약화", "전환"]
DOMAIN_LABELS = {
    "growth": "성장·고용",
    "inflation": "물가",
    "rates": "금리·실질금리",
    "liquidity": "유동성·신용",
}
FREQUENCY_PERIODS = {
    "daily": (21, 63, 252),
    "weekly": (4, 13, 52),
    "monthly": (1, 3, 12),
    "quarterly": (1, 1, 4),
}
PIT_TIER1 = {
    "us_gdp", "us_unemployment", "us_payrolls", "us_claims", "us_retail", "us_indpro",
    "cpi", "core_cpi", "pce", "core_pce", "ppi", "wages",
}
MODEL_CONTEXT_IDS = {
    "cpi_nsa", "core_cpi_nsa", "fed_target_lower", "fed_target_upper",
    "fedfunds", "term_premium", "us3m", "us2y",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class RegimeService:
    def __init__(self) -> None:
        self.db = get_database_client()

    def _record_feed_status(
        self, source: str, status: str, item_count: int = 0,
        error: str | None = None, *, successful: bool = False,
    ) -> None:
        attempted = _now()
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO regime_feed_status(source,last_attempted_at,last_success_at,status,item_count,error) "
                "VALUES(?,?,?,?,?,?) ON CONFLICT(source) DO UPDATE SET "
                "last_attempted_at=excluded.last_attempted_at,"
                "last_success_at=COALESCE(excluded.last_success_at,regime_feed_status.last_success_at),"
                "status=excluded.status,item_count=excluded.item_count,error=excluded.error",
                (source, attempted, attempted if successful else None, status, item_count, error),
            )

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        """FRED 관측값을 SQLite에 저장한다. 키가 없으면 기존 캐시를 유지한다."""
        if not settings.fred_api_key:
            self._record_feed_status(
                "macro", "configuration_required", error="FRED API key is not configured"
            )
            return {"status": "configuration_required", "source": "fred", "saved": 0}

        with self.db.connect() as conn:
            indicators = [dict(row) for row in conn.execute(
                "SELECT * FROM regime_indicators WHERE source='fred' AND enabled=1"
            ).fetchall()]
            market_indicators = [dict(row) for row in conn.execute(
                "SELECT * FROM regime_indicators WHERE source='yfinance' AND enabled=1"
            ).fetchall()]
            fetch_status = {row["indicator_id"]: dict(row) for row in conn.execute(
                "SELECT * FROM regime_indicator_fetch_status"
            ).fetchall()}

        now = datetime.now(timezone.utc)

        def due(indicator: dict[str, Any]) -> bool:
            if force:
                return True
            state = fetch_status.get(indicator["id"])
            if not state or not state.get("last_success_at"):
                return True
            if state.get("status") == "failed":
                retry_at = datetime.fromisoformat(state["retry_after"]) if state.get("retry_after") else now
                return retry_at <= now
            return now - datetime.fromisoformat(state["last_success_at"]) >= timedelta(hours=20)

        indicators = [item for item in indicators if due(item)]
        market_indicators = [item for item in market_indicators if due(item)]
        if not indicators and not market_indicators:
            await asyncio.to_thread(self.evaluate, persist=True)
            return {
                "status": "cached", "source": "mixed", "saved": 0,
                "evaluation": await asyncio.to_thread(
                    self.current, persist_state=True
                ),
            }
        run_id, started_at, saved = str(uuid4()), _now(), 0
        self.db.table("regime_fetch_runs").insert({
            "id": run_id, "source": "fred", "started_at": started_at, "status": "running"
        }).execute()
        try:
            semaphore = asyncio.Semaphore(3)

            def observation_start(indicator: dict[str, Any]) -> str:
                if force:
                    return history_start(indicator["frequency"])
                state = fetch_status.get(indicator["id"], {})
                return incremental_start(
                    indicator["frequency"], state.get("last_observation_date"),
                )

            async def fetch_indicator(client: httpx.AsyncClient, indicator: dict[str, Any]) -> list[tuple]:
                try:
                    async with semaphore:
                        params = {
                            "series_id": indicator["source_key"], "api_key": settings.fred_api_key,
                            "file_type": "json", "sort_order": "asc",
                            "observation_start": observation_start(indicator),
                        }
                        observations = await fetch_all_pages(
                            client, "https://api.stlouisfed.org/fred/series/observations", params
                        )
                        fetched_at = _now()
                        rows = []
                        for item in observations:
                            value = _float(item.get("value"))
                            if value is not None:
                                rows.append((str(uuid4()), indicator["id"], item["date"], value, fetched_at, "fred"))
                        return rows
                except Exception as exc:
                    raise RuntimeError(
                        f"{indicator['id']}: {safe_error_message(exc, settings.fred_api_key)}"
                    ) from None

            async def fetch_initial_vintage(client: httpx.AsyncClient, indicator: dict[str, Any]) -> list[Any]:
                if indicator["id"] not in PIT_TIER1:
                    return []
                try:
                    async with semaphore:
                        params = initial_release_params(indicator["source_key"], settings.fred_api_key)
                        params["observation_start"] = observation_start(indicator)
                        params.pop("limit", None)
                        params.pop("offset", None)
                        observations = await fetch_all_pages(
                            client, "https://api.stlouisfed.org/fred/series/observations", params
                        )
                        return parse_initial_release_observations(
                            indicator["id"], {"observations": observations}, _now()
                        )
                except Exception as exc:
                    raise RuntimeError(
                        f"{indicator['id']}.vintage: "
                        f"{safe_error_message(exc, settings.fred_api_key)}"
                    ) from None

            async def fetch_payroll_revisions(client: httpx.AsyncClient) -> list[Any]:
                payroll = next(
                    (item for item in indicators if item["id"] == "us_payrolls"), None
                )
                if not payroll:
                    return []
                try:
                    async with semaphore:
                        payload = await fetch_json(
                            client,
                            FRED_VINTAGE_DATES_URL,
                            {
                                "series_id": payroll["source_key"],
                                "api_key": settings.fred_api_key,
                                "file_type": "json",
                                "sort_order": "desc",
                                "limit": 8,
                            },
                        )
                        vintage_dates = payload.get("vintage_dates", [])[:8]
                        if len(vintage_dates) < 2:
                            return []
                        params = recent_vintage_params(
                            payroll["source_key"],
                            settings.fred_api_key,
                            vintage_dates,
                            (datetime.now(timezone.utc) - timedelta(days=400)).date().isoformat(),
                        )
                        observations = await fetch_all_pages(
                            client,
                            "https://api.stlouisfed.org/fred/series/observations",
                            params,
                        )
                        return parse_vintage_date_observations(
                            payroll["id"], payroll["source_key"],
                            {"observations": observations}, _now(),
                        )
                except Exception as exc:
                    raise RuntimeError(
                        f"{payroll['id']}.revisions: "
                        f"{safe_error_message(exc, settings.fred_api_key)}"
                    ) from None

            async with httpx.AsyncClient(timeout=60) as client:
                batches, vintage_batches, payroll_revision_batch = await asyncio.gather(
                    asyncio.gather(*(fetch_indicator(client, indicator) for indicator in indicators), return_exceptions=True),
                    asyncio.gather(*(fetch_initial_vintage(client, indicator) for indicator in indicators), return_exceptions=True),
                    fetch_payroll_revisions(client),
                    return_exceptions=True,
                )
            errors = [str(result) for result in batches if isinstance(result, Exception)]
            errors.extend(str(result) for result in vintage_batches if isinstance(result, Exception))
            if isinstance(payroll_revision_batch, Exception):
                errors.append(str(payroll_revision_batch))
            rows = [row for batch in batches if isinstance(batch, list) for row in batch]
            vintage_rows = [row for batch in vintage_batches if isinstance(batch, list) for row in batch]
            if isinstance(payroll_revision_batch, list):
                vintage_rows.extend(payroll_revision_batch)
            outcomes: dict[str, tuple[bool, str | None, str | None]] = {}
            for indicator, result in zip(indicators, batches):
                if isinstance(result, Exception):
                    outcomes[indicator["id"]] = (False, str(result), None)
                else:
                    outcomes[indicator["id"]] = (True, None, max((row[2] for row in result), default=None))
            if market_indicators:
                finance = get_finance_service()
                market_batches = await asyncio.gather(
                    *(finance.get_ticker_history(indicator["source_key"], 550) for indicator in market_indicators),
                    return_exceptions=True,
                )
                for indicator, result in zip(market_indicators, market_batches):
                    if isinstance(result, Exception) or not result.get("data"):
                        error = f"{indicator['id']}: yfinance unavailable"
                        errors.append(error)
                        outcomes[indicator["id"]] = (False, error, None)
                        continue
                    fetched_at = _now()
                    outcomes[indicator["id"]] = (True, None, result["data"][-1]["date"])
                    rows.extend(
                        (str(uuid4()), indicator["id"], item["date"], float(item["close"]), fetched_at, "yfinance")
                        for item in result["data"]
                    )
            with self.db.connect() as conn:
                conn.executemany(
                    "INSERT INTO regime_observations(id,indicator_id,observation_date,value,fetched_at,source) "
                    "VALUES(?,?,?,?,?,?) ON CONFLICT(indicator_id,observation_date) DO UPDATE SET "
                    "value=excluded.value,fetched_at=excluded.fetched_at,source=excluded.source",
                    rows,
                )
                metal_rows = conn.execute(
                    "SELECT gold.observation_date,gold.value/silver.value AS ratio "
                    "FROM regime_observations gold JOIN regime_observations silver "
                    "ON silver.observation_date=gold.observation_date "
                    "WHERE gold.indicator_id='market_gold' AND silver.indicator_id='market_silver' "
                    "AND silver.value<>0 ORDER BY gold.observation_date"
                ).fetchall()
                conn.executemany(
                    "INSERT INTO regime_observations(id,indicator_id,observation_date,value,fetched_at,source) "
                    "VALUES(?,?,?,?,?,'derived') ON CONFLICT(indicator_id,observation_date) DO UPDATE SET "
                    "value=excluded.value,fetched_at=excluded.fetched_at,source=excluded.source",
                    [(str(uuid4()), "market_gold_silver_ratio", row["observation_date"],
                      float(row["ratio"]), _now()) for row in metal_rows],
                )
                attempted_at = _now()
                for indicator_id, (success, error, last_date) in outcomes.items():
                    previous_failures = int(fetch_status.get(indicator_id, {}).get("failure_count") or 0)
                    conn.execute(
                        "INSERT INTO regime_indicator_fetch_status(indicator_id,last_attempted_at,last_success_at,"
                        "last_observation_date,status,failure_count,retry_after,error) VALUES(?,?,?,?,?,?,?,?) "
                        "ON CONFLICT(indicator_id) DO UPDATE SET last_attempted_at=excluded.last_attempted_at,"
                        "last_success_at=COALESCE(excluded.last_success_at,regime_indicator_fetch_status.last_success_at),"
                        "last_observation_date=COALESCE(excluded.last_observation_date,regime_indicator_fetch_status.last_observation_date),"
                        "status=excluded.status,failure_count=excluded.failure_count,retry_after=excluded.retry_after,error=excluded.error",
                        (indicator_id, attempted_at, attempted_at if success else None, last_date,
                         "success" if success else "failed", 0 if success else previous_failures + 1,
                         None if success else (now + timedelta(hours=1)).isoformat(), error),
                    )
            RegimeVintageRepository(self.db).save(vintage_rows, run_id)
            saved = len(rows) + len(metal_rows)
            run_status = "failed" if errors and not rows else "partial" if errors else "success"
            error_summary = "; ".join(errors)[:1000] if errors else None
            self.db.table("regime_fetch_runs").update({
                "finished_at": _now(), "status": run_status,
                "observations_saved": saved, "error": error_summary,
            }).eq("id", run_id).execute()
            self._record_feed_status(
                "macro", run_status, saved, error_summary,
                successful=bool(rows),
            )
        except Exception as exc:
            error = safe_error_message(exc, settings.fred_api_key)
            self.db.table("regime_fetch_runs").update({
                "finished_at": _now(), "status": "failed", "error": error[:1000]
            }).eq("id", run_id).execute()
            self._record_feed_status("macro", "failed", saved, error[:800])
            raise
        await asyncio.to_thread(self.evaluate, persist=True)
        evaluation = await asyncio.to_thread(self.current, persist_state=True)
        return {"status": run_status, "source": "mixed", "saved": saved,
                "errors": errors[:10], "evaluation": evaluation}

    def _indicator_rows(self) -> list[dict[str, Any]]:
        with self.db.connect() as conn:
            definitions = [dict(row) for row in conn.execute(
                "SELECT * FROM regime_indicators WHERE enabled=1 ORDER BY domain,id"
            ).fetchall()]
            observations: dict[str, list[dict[str, Any]]] = {
                definition["id"]: [] for definition in definitions
            }
            for row in conn.execute(
                "SELECT o.indicator_id,o.observation_date,o.value,o.fetched_at,o.source "
                "FROM regime_observations o JOIN regime_indicators i ON i.id=o.indicator_id "
                "WHERE i.enabled=1 ORDER BY o.indicator_id,o.observation_date"
            ).fetchall():
                item = dict(row)
                observations[item.pop("indicator_id")].append(item)
            timing = {
                row["indicator_id"]: {
                    key: row[key]
                    for key in ("observation_date", "available_from", "release_date", "vintage_kind")
                }
                for row in conn.execute(
                    "SELECT indicator_id,observation_date,available_from,release_date,vintage_kind FROM ("
                    "SELECT indicator_id,observation_date,available_from,release_date,vintage_kind,"
                    "ROW_NUMBER() OVER(PARTITION BY indicator_id "
                    "ORDER BY observation_date DESC,available_from DESC) AS rank "
                    "FROM regime_observation_vintages) WHERE rank=1"
                ).fetchall()
            }
            payroll_vintages = [dict(row) for row in conn.execute(
                "SELECT observation_date,value,available_from,vintage_kind FROM regime_observation_vintages "
                "WHERE indicator_id='us_payrolls' AND observation_date IN ("
                " SELECT observation_date FROM regime_observation_vintages "
                " WHERE indicator_id='us_payrolls' GROUP BY observation_date "
                " ORDER BY observation_date DESC LIMIT 8"
                ") ORDER BY observation_date,available_from"
            ).fetchall()]
            for definition in definitions:
                definition["observations"] = observations[definition["id"]]
                definition["timing"] = timing.get(definition["id"])
                definition["vintage_rows"] = (
                    payroll_vintages if definition["id"] == "us_payrolls" else []
                )
        return definitions

    def _signal(self, indicator: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
        observations = indicator["observations"]
        values = [float(row["value"]) for row in observations]
        role = indicator_role(indicator["id"])
        semantics = indicator_semantics(indicator["id"])
        if not values:
            return {
                **{key: indicator[key] for key in ("id", "domain", "name", "unit", "source", "source_key", "frequency", "direction")},
                "status": "unavailable", "score": 0, "reason": "수집된 데이터 없음",
                "history": [], "display_period": display_period(indicator["frequency"]),
                "display_metrics": [], "decision_chart": None,
                "is_stale": False, "age_days": None,
                "max_age_days": signal_freshness(indicator, now)["max_age_days"],
                "usable_for_decision": False, **role, **semantics,
            }
        p1, p3, p12 = FREQUENCY_PERIODS[indicator["frequency"]]
        latest = values[-1]
        change1 = period_percent_change(observations, indicator["frequency"], p1)
        change3 = period_percent_change(observations, indicator["frequency"], p3)
        change12 = period_percent_change(observations, indicator["frequency"], p12)
        score, reason = self._score(
            indicator["id"], latest, change3, change12,
            observations, indicator["frequency"], p3,
        )
        revision_summary = (
            self._payroll_revision_summary(observations, indicator.get("vintage_rows") or [])
            if indicator["id"] == "us_payrolls" else None
        )
        if revision_summary and revision_summary["net_delta"] <= -100:
            score = max(-1.5, score - .25)
            reason += f" · 최근 증가분 수정 {revision_summary['net_delta']:+.0f}천명"
        status = "강함" if score >= 0.75 else "중립" if score > -0.5 else "둔화" if score > -1.5 else "약화"
        freshness = signal_freshness(
            {"observation_date": observations[-1]["observation_date"], "frequency": indicator["frequency"]},
            now,
        )
        gaps = continuity_gaps(observations, indicator["frequency"])
        display_value, display_unit = latest, indicator["unit"]
        if indicator["id"] == "bank_reserves":
            display_value, display_unit = round(latest / 1_000_000, 3), "조 달러"
        signal = {
            **{key: indicator[key] for key in ("id", "domain", "name", "unit", "source", "source_key", "frequency", "direction")},
            "observation_date": observations[-1]["observation_date"],
            "fetched_at": observations[-1]["fetched_at"],
            "value": latest,
            "display_value": display_value,
            "display_unit": display_unit,
            "change_1m": change1,
            "change_3m": change3,
            "change_12m": change12,
            "score": score,
            "status": status,
            "reason": reason,
            "history": display_history(observations, indicator["frequency"]),
            "display_period": display_period(indicator["frequency"]),
            "display_metrics": display_metrics(indicator["id"], indicator["frequency"], observations),
            "decision_chart": decision_chart(indicator["id"], observations),
            # regime_observations is the latest-value projection. A separately
            # stored initial vintage must never be presented as provenance for
            # this displayed value unless both rows are explicitly linked.
            "available_from": None,
            "release_date": None,
            "vintage_kind": "latest_revised",
            "vintage_history_available": bool(indicator.get("timing")),
            "is_stale": not freshness["fresh"],
            "age_days": freshness["age_days"],
            "max_age_days": freshness["max_age_days"],
            "continuity_gaps": gaps,
            "has_continuity_gap": bool(gaps),
            **role,
            **semantics,
        }
        if revision_summary:
            signal["revision_summary"] = revision_summary
            signal["display_metrics"].append({
                "label": "최근 증가분 수정",
                "value": revision_summary["net_delta"],
                "unit": "천명",
                "kind": "delta",
            })
        signal["usable_for_decision"] = decision_usable(signal, now)
        return signal

    @staticmethod
    def _payroll_revision_summary(
        observations: list[dict[str, Any]],
        vintage_rows: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """Compare monthly gains within the same release vintage.

        PAYEMS is a level series.  Summing revisions to adjacent levels would
        double-count benchmark changes, so each initially reported monthly
        gain is calculated from two levels that coexisted on one vintage date.
        """

        current = {
            str(item["observation_date"]): float(item["value"])
            for item in observations
        }
        dates = sorted(current)
        by_vintage: dict[str, dict[str, float]] = {}
        for row in vintage_rows:
            by_vintage.setdefault(str(row["available_from"]), {})[
                str(row["observation_date"])
            ] = float(row["value"])
        details: list[dict[str, Any]] = []
        for target_date in dates[-3:]:
            index = dates.index(target_date)
            if index == 0:
                continue
            previous_date = dates[index - 1]
            comparable = [
                (vintage_date, values)
                for vintage_date, values in sorted(by_vintage.items())
                if target_date in values and previous_date in values
            ]
            if not comparable:
                continue
            release_vintage, release_values = comparable[0]
            initial_change = release_values[target_date] - release_values[previous_date]
            revised_change = current[target_date] - current[previous_date]
            details.append({
                "observation_date": target_date,
                "release_vintage": release_vintage,
                "initial_change": round(initial_change, 3),
                "revised_change": round(revised_change, 3),
                "revision_delta": round(revised_change - initial_change, 3),
            })
        if not details:
            return None
        return {
            "observation_count": len(details),
            "net_delta": round(sum(item["revision_delta"] for item in details), 3),
            "latest_delta": details[-1]["revision_delta"],
            "methodology": "동일 발표 빈티지의 당월·전월 PAYEMS 차이와 최신 수정치 비교",
            "observations": details,
        }

    @staticmethod
    def _score(key: str, latest: float, c3: float | None, c12: float | None,
               observations: list[dict[str, Any]] | list[float], frequency: str | int,
               p3: int) -> tuple[float, str]:
        legacy_values = bool(observations) and not isinstance(observations[0], dict)
        if legacy_values:
            values = [float(value) for value in observations]
            legacy_period = int(frequency)
            delta3 = latest - values[-legacy_period - 1] if len(values) > legacy_period else 0
            rows: list[dict[str, Any]] = []
            resolved_frequency = "daily"
        else:
            rows = observations  # type: ignore[assignment]
            values = [float(row["value"]) for row in rows]
            resolved_frequency = str(frequency)
            delta3 = period_delta(rows, resolved_frequency, p3)
        yoy = c12
        if key == "us_unemployment":
            if delta3 is None:
                return 0, "3개월 비교기간 자료 부족"
            return (-2 if delta3 >= .3 else -1 if delta3 >= .15 else .5, f"3개월 {delta3:+.2f}%p")
        if key == "us_claims":
            if c3 is None:
                return 0, "13주 비교기간 자료 부족"
            return (-2 if c3 >= 15 else -1 if c3 >= 7 else .5, f"13주 {c3:+.1f}%")
        if key == "us_payrolls":
            recent_changes = [
                period_delta(rows, "monthly", 1, end_index=index)
                for index in range(max(0, len(values) - 3), len(values))
            ]
            if len(recent_changes) < 3 or any(value is None for value in recent_changes):
                return 0, "최근 3개월 연속 비교자료 부족"
            changes = [float(value) for value in recent_changes if value is not None]
            latest_change = changes[-1]
            average_3m = sum(changes) / 3
            score = (
                .75 if average_3m >= 150
                else .25 if average_3m >= 50
                else -.25 if average_3m >= 0
                else -.75 if average_3m > -50
                else -1.5
            )
            return score, f"최근 월 {latest_change:+.0f}천명 · 3개월 평균 {average_3m:+.0f}천명"
        if key in {"cpi", "core_cpi", "pce", "core_pce", "ppi", "ppi_commodities", "wages"}:
            annualized = annualized_change(rows, "monthly", 3)
            if annualized is None:
                return 0, "3개월 비교기간 자료 부족"
            return (-2 if annualized >= 4 else -1 if annualized >= 3 else .75 if annualized < 2.5 else 0,
                    f"3개월 연율 {annualized:.1f}%")
        if key == "hy_oas":
            return (-2 if latest >= 5 else -1 if latest >= 4 else .5, f"현재 {latest:.2f}%p")
        if key == "ig_oas":
            return (-1.5 if latest >= 1.5 else -.75 if latest >= 1.2 else .5, f"현재 {latest:.2f}%p")
        if key == "nfci":
            return (-2 if latest >= .5 else -1 if latest >= 0 else .5, f"현재 {latest:.2f}")
        if key in {"us10y", "us30y", "tips10y", "tips30y", "bei10y", "term_premium", "fedfunds",
                   "fed_target_lower", "fed_target_upper"}:
            if key == "tips10y" and latest >= 2.25:
                return (-1, f"현재 {latest:.2f}% · 제한적 실질금리")
            if key == "tips30y" and latest >= 3.0:
                return (-1, f"현재 {latest:.2f}% · 장기 듀레이션 부담 경계")
            if delta3 is None:
                return 0, "3개월 비교기간 자료 부족"
            return (-1.5 if delta3 >= .5 else -.75 if delta3 >= .25 else .25, f"3개월 {delta3:+.2f}%p")
        if key in {"curve2s10s", "curve10y3m"}:
            return (-1 if latest < -.5 else -.5 if latest < 0 else .5, f"현재 {latest:+.2f}%p")
        direction = 1 if key in {"us_gdp", "us_retail", "us_indpro", "fed_assets", "bank_reserves"} else 0
        if direction:
            if yoy is None:
                return 0, "12개월 비교기간 자료 부족"
            return (-1.5 if yoy < -2 else -.75 if yoy < 0 else .75, f"12개월 {yoy:+.1f}%")
        return (0, "중립 규칙")

    @staticmethod
    def _fingerprint_payload(
        definitions: list[dict[str, Any]],
        signals: list[dict[str, Any]],
        macro_quadrant: dict[str, Any],
        *,
        include_triggers: bool = True,
    ) -> dict[str, Any]:
        signal_map = {item["id"]: item for item in signals}
        inputs = []
        for definition in definitions:
            signal = signal_map[definition["id"]]
            if signal.get("usage") == "display" and definition["id"] not in MODEL_CONTEXT_IDS:
                continue
            if (not include_triggers and signal.get("usage") != "regime"
                    and definition["id"] not in MODEL_CONTEXT_IDS):
                continue
            inputs.append({
                "id": definition["id"],
                "domain": definition["domain"],
                "source_key": definition["source_key"],
                "frequency": definition["frequency"],
                "direction": definition["direction"],
                "weight": float(definition["weight"]),
                "usage": signal.get("usage"),
                "usable_for_decision": bool(signal.get("usable_for_decision")),
                "observations": [
                    (row["observation_date"], float(row["value"]))
                    for row in definition["observations"]
                ],
            })
        return {
            "model_version": macro_quadrant.get("version"),
            "rule_version": RULE_VERSION,
            "inputs": inputs,
        }

    @staticmethod
    def _canonical_domains(
        signals: list[dict[str, Any]],
        weights: dict[str, float],
        macro_quadrant: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Build the four official domain states from one documented path.

        Signal scores remain visible for drill-down. When the level/momentum
        model has adequate coverage, its outputs become the canonical domain
        state; sparse fixtures and startup data fall back to the same filtered
        signal aggregate instead of inventing a neutral state.
        """
        domains: list[dict[str, Any]] = []
        for key, label in DOMAIN_LABELS.items():
            items = [
                item for item in signals
                if item["domain"] == key
                and not item["id"].startswith("kr_")
                and item.get("usage") == "regime"
                and item.get("usable_for_decision")
            ]
            weighted = sum(item["score"] * weights[item["id"]] for item in items)
            total_weight = sum(weights[item["id"]] for item in items)
            score = weighted / total_weight if total_weight else 0
            state = "강함" if score >= .5 else "중립" if score > -.5 else "둔화" if score > -1.2 else "약화"
            reasons = [
                item["reason"] for item in sorted(items, key=lambda row: row["score"])[:2]
                if item["score"] < 0
            ]
            method = "filtered_signal_aggregate"

            if key in {"growth", "inflation"}:
                level = macro_quadrant.get(f"{key}_level", {})
                point = macro_quadrant.get("points", [{}])[-1] if macro_quadrant.get("points") else {}
                momentum = point.get(key, {})
                level_score, momentum_score = level.get("score"), momentum.get("coordinate")
                if level.get("coverage", 0) >= .6 and momentum.get("coverage", 0) >= .5:
                    if key == "growth":
                        state = (
                            "약화" if level_score is not None and level_score <= -35
                            else "둔화" if (
                                level_score is not None and level_score < 0
                            ) or (
                                momentum_score is not None and momentum_score <= -35
                            )
                            else "강함" if (
                                level_score is not None and level_score >= 20
                                and momentum_score is not None and momentum_score >= -20
                            )
                            else "중립"
                        )
                    else:
                        state = (
                            "약화" if (
                                level_score is not None and level_score >= 60
                            ) or (
                                level_score is not None and level_score >= 25
                                and momentum_score is not None and momentum_score >= 35
                            )
                            else "둔화" if momentum_score is not None and momentum_score >= 35
                            else "강함" if (
                                level_score is not None and level_score < 0
                                and momentum_score is not None and momentum_score <= 0
                            )
                            else "중립"
                        )
                    score = {"강함": .75, "중립": 0.0, "둔화": -.75, "약화": -1.5}[state]
                    method = "macro_level_momentum"
                    reasons = [
                        f"현재 {level.get('label', '판정 불가')} · 최근 모멘텀 {momentum_score:+.1f}"
                        if momentum_score is not None else f"현재 {level.get('label', '판정 불가')}"
                    ] if state in {"둔화", "약화"} else []

            conditions = macro_quadrant.get("financial_conditions", {})
            if key == "rates":
                pressure = conditions.get("rates", {}).get("score")
                if pressure is not None:
                    state = "약화" if pressure >= 65 else "둔화" if pressure >= 25 else "중립" if pressure >= -20 else "강함"
                    score = {"강함": .75, "중립": 0.0, "둔화": -.75, "약화": -1.5}[state]
                    method = "three_layer_rate_model"
                    driver = conditions.get("rates", {}).get("driver", "금리 복합모델")
                    reasons = [f"{driver} · 금리 압력 {pressure:.1f}"] if state in {"둔화", "약화"} else []
            elif key == "liquidity":
                pressure = conditions.get("credit", {}).get("score")
                if pressure is not None:
                    state = "약화" if pressure >= 65 else "둔화" if pressure >= 25 else "중립" if pressure >= -20 else "강함"
                    score = {"강함": .75, "중립": 0.0, "둔화": -.75, "약화": -1.5}[state]
                    method = "financial_conditions"
                    reasons = [f"신용·금융여건 제한 강도 {pressure:.1f}"] if state in {"둔화", "약화"} else []

            domains.append({
                "id": key, "name": label,
                "state": state if items else "데이터 없음",
                "score": round(score, 3), "reasons": reasons,
                "method": method if items else "unavailable",
            })
        return domains

    def evaluate(self, persist: bool = True) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        definitions = self._indicator_rows()
        weights = {item["id"]: float(item["weight"]) for item in definitions}
        signals = [self._signal(item, now) for item in definitions]
        signal_map = {item["id"]: item for item in signals}
        for primary_id, official_id in (("cpi", "cpi_nsa"), ("core_cpi", "core_cpi_nsa")):
            primary, official = signal_map.get(primary_id), signal_map.get(official_id)
            if not primary or not official or official.get("status") == "unavailable":
                continue
            official_metric = next(
                (item for item in official.get("display_metrics", [])
                 if item.get("label") == "공식 전년동월비"),
                None,
            )
            if official_metric:
                primary["official_yoy"] = official_metric["value"]
                primary["official_yoy_observation_date"] = official.get("observation_date")
                primary["official_yoy_basis"] = "BLS 비계절조정 지수의 동일 월 비교"
                primary["display_metrics"] = [
                    {**official_metric, "source_indicator_id": official_id},
                    *[
                        item for item in primary.get("display_metrics", [])
                        if item.get("label") != "전년 대비"
                    ],
                ]
        macro_input = [
            {"id": item["id"], "name": item["name"], "frequency": item["frequency"],
             "history": [{"date": row["observation_date"], "value": float(row["value"])}
                         for row in item["observations"]]}
            for item in definitions
            if signal_map[item["id"]].get("usable_for_decision")
            or (
                item["id"] in {"cpi_nsa", "core_cpi_nsa"}
                and signal_map[item["id"]].get("status") != "unavailable"
                and not signal_map[item["id"]].get("is_stale")
            )
        ]
        financial_input = [
            {"id": item["id"], "name": item["name"], "frequency": item["frequency"],
             "history": [{"date": row["observation_date"], "value": float(row["value"])}
                         for row in item["observations"]]}
            for item in definitions
            if signal_map[item["id"]].get("status") != "unavailable"
            and not signal_map[item["id"]].get("is_stale")
        ]
        macro_quadrant = calculate_us_macro_quadrant(macro_input, financial_input)
        available = [item for item in signals if item["status"] != "unavailable"]
        fingerprint_source = self._fingerprint_payload(definitions, signals, macro_quadrant)
        fingerprint = hashlib.sha256(json.dumps(fingerprint_source, sort_keys=True).encode()).hexdigest()
        domains = self._canonical_domains(signals, weights, macro_quadrant)
        adverse = sum(item["state"] in {"둔화", "약화"} for item in domains)
        weak = sum(item["state"] == "약화" for item in domains)
        candidate = "전환" if weak >= 3 else "약화" if weak >= 2 or adverse >= 3 else "경계" if adverse >= 1 else "유지"
        growth_level = macro_quadrant.get("growth_level", {}).get("score")
        inflation_level = macro_quadrant.get("inflation_level", {}).get("score")
        conditions = macro_quadrant.get("financial_conditions", {})
        long_rate_score = conditions.get("long_rates", {}).get("score")
        # Phase 1 is macro-only: elevated inflation combined with restrictive
        # long rates is at least a watch/candidate state, while macro data alone
        # must never declare the investment thesis structurally transitioned.
        if inflation_level is not None and inflation_level >= 25 and long_rate_score is not None and long_rate_score >= 25:
            candidate = max((candidate, "경계"), key=REGIME_ORDER.index)
        if macro_quadrant.get("scope_status") == "macro_only" and candidate == "전환":
            candidate = "약화"
        regime_basis = self._fingerprint_payload(
            definitions, signals, macro_quadrant, include_triggers=False
        )
        regime_inputs = [
            (item["id"], item.get("observation_date"), item.get("value"))
            for item in available
            if item.get("usage") == "regime" and item.get("usable_for_decision")
        ]
        basis_fingerprint = hashlib.sha256(
            json.dumps(regime_basis, sort_keys=True).encode()
        ).hexdigest()
        confirmation_version = f"{RULE_VERSION}:{macro_quadrant.get('version', 'unknown')}"
        with self.db.connect() as conn:
            existing = conn.execute("SELECT * FROM regime_evaluations WHERE data_fingerprint=?", (fingerprint,)).fetchone()
            previous = conn.execute("SELECT * FROM regime_evaluations ORDER BY evaluated_at DESC LIMIT 1").fetchone()
        if existing:
            return self._evaluation_dict(dict(existing), signals, domains, macro_quadrant)
        current = previous["automatic_regime"] if previous else "유지"
        reasons = [f"{item['name']}: {reason}" for item in domains for reason in item["reasons"]]
        if not persist:
            return {
                "id": f"preview-{fingerprint[:16]}", "evaluated_at": _now(),
                "data_fingerprint": fingerprint,
                "candidate_regime": candidate, "automatic_regime": current,
                "signals": signals, "domains": domains, "reasons": reasons,
                "macro_quadrant": macro_quadrant,
            }
        with self.db.connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO regime_candidate_confirmations("
                "id,candidate_regime,basis_fingerprint,observed_at,evidence_json,rule_version) VALUES(?,?,?,?,?,?)",
                (str(uuid4()), candidate, basis_fingerprint, _now(), json.dumps(regime_inputs, ensure_ascii=False), confirmation_version),
            )
            recent_confirmations = conn.execute(
                "SELECT candidate_regime FROM regime_candidate_confirmations WHERE rule_version=? "
                "ORDER BY observed_at DESC LIMIT 2",
                (confirmation_version,),
            ).fetchall()
        confirmed = (
            len(recent_confirmations) >= 2
            and all(row["candidate_regime"] == candidate for row in recent_confirmations)
        )
        automatic = candidate if candidate == current or confirmed else current
        evaluation_id = str(uuid4())
        self.db.table("regime_evaluations").insert({
            "id": evaluation_id, "evaluated_at": _now(), "data_fingerprint": fingerprint,
            "candidate_regime": candidate, "automatic_regime": automatic,
            "signals_json": signals, "domains_json": domains, "reasons_json": reasons,
        }).execute()
        return {"id": evaluation_id, "evaluated_at": _now(), "candidate_regime": candidate,
                "data_fingerprint": fingerprint,
                "automatic_regime": automatic, "signals": signals, "domains": domains, "reasons": reasons,
                "macro_quadrant": macro_quadrant}

    @staticmethod
    def _evaluation_dict(row: dict[str, Any], signals: list[dict], domains: list[dict],
                         macro_quadrant: dict[str, Any]) -> dict[str, Any]:
        return {"id": row["id"], "evaluated_at": row["evaluated_at"],
                "data_fingerprint": row["data_fingerprint"],
                "candidate_regime": row["candidate_regime"], "automatic_regime": row["automatic_regime"],
                "signals": signals, "domains": domains, "reasons": json.loads(row["reasons_json"]),
                "macro_quadrant": macro_quadrant}

    def current(self, persist_state: bool = False) -> dict[str, Any]:
        from app.services.regime_events import RegimeEventService
        from app.services.regime_sec import SecCapexService
        from app.services.regime_memory import MemoryPriceService
        from app.services.regime_thesis import RegimeThesisDataService
        from app.services.regime_energy import EnergyShockService

        evaluation = self.evaluate(persist=False)
        # Thesis summaries are attached before snapshot comparison so the
        # Current inbox can surface their state changes without mixing them
        # into the macro regime or review-urgency calculation.
        evaluation["ai_capex"] = SecCapexService().summary()
        evaluation["memory_cycle"] = MemoryPriceService().summary()
        thesis_service = RegimeThesisDataService()
        evaluation["semiconductor_cycle"] = thesis_service.semiconductor_summary(
            evaluation["memory_cycle"]
        )
        evaluation["power_cycle"] = thesis_service.power_summary()
        energy_service = EnergyShockService()
        evaluation["energy_shock"] = energy_service.summary(evaluation["signals"])
        with self.db.connect() as conn:
            latest_fetch = conn.execute("SELECT * FROM regime_fetch_runs ORDER BY started_at DESC LIMIT 1").fetchone()
            latest_snapshot = conn.execute(
                "SELECT created_at,automatic_regime,domains_json,ai_capex_json,memory_cycle_json,"
                "semiconductor_cycle_json,power_cycle_json,energy_shock_json "
                "FROM regime_snapshots ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
            prior_evaluation = conn.execute(
                "SELECT automatic_regime FROM regime_evaluations WHERE id<>? ORDER BY evaluated_at DESC LIMIT 1",
                (evaluation["id"],),
            ).fetchone()
        evaluation["last_fetch"] = dict(latest_fetch) if latest_fetch else None
        evaluation["previous_snapshot"] = (
            {
                "created_at": latest_snapshot["created_at"],
                "automatic_regime": latest_snapshot["automatic_regime"],
            }
            if latest_snapshot else None
        )
        evaluation["changes_since_snapshot"] = []
        evaluation["thesis_changes_since_snapshot"] = []
        worsened_domains = 0
        if latest_snapshot:
            previous_domains = {item["id"]: item["state"] for item in json.loads(latest_snapshot["domains_json"])}
            evaluation["changes_since_snapshot"] = [
                f"{item['name']}: {previous_domains[item['id']]} → {item['state']}"
                for item in evaluation["domains"]
                if item["id"] in previous_domains and previous_domains[item["id"]] != item["state"]
            ]
            state_rank = {"강함": 0, "중립": 1, "둔화": 2, "약화": 3, "데이터 없음": 4}
            worsened_domains = sum(
                state_rank.get(item["state"], 4) > state_rank.get(previous_domains.get(item["id"], "데이터 없음"), 4)
                for item in evaluation["domains"] if item["id"] in previous_domains
            )
            previous_thesis = {
                "ai_capex": json.loads(latest_snapshot["ai_capex_json"])
                if latest_snapshot["ai_capex_json"] else None,
                "memory_cycle": json.loads(latest_snapshot["memory_cycle_json"])
                if latest_snapshot["memory_cycle_json"] else None,
                "semiconductor_cycle": json.loads(latest_snapshot["semiconductor_cycle_json"])
                if latest_snapshot["semiconductor_cycle_json"] else None,
                "power_cycle": json.loads(latest_snapshot["power_cycle_json"])
                if latest_snapshot["power_cycle_json"] else None,
            }
            evaluation["thesis_changes_since_snapshot"] = self._thesis_changes(
                previous_thesis, evaluation
            )
            previous_energy = (
                json.loads(latest_snapshot["energy_shock_json"])
                if latest_snapshot["energy_shock_json"] else None
            )
            if (
                previous_energy
                and previous_energy.get("state") != evaluation["energy_shock"].get("state")
            ):
                evaluation["changes_since_snapshot"].append(
                    "에너지 가격·공급충격: "
                    f"{previous_energy.get('state')} → {evaluation['energy_shock'].get('state')}"
                )
        # Reuse the full-history rate model already calculated for the macro
        # quadrant.  Recomputing from display-truncated signal histories would
        # shorten the 252-observation post-inversion memory by the 21-day
        # smoothing window and could make the card and trigger disagree.
        triggers, rate_decomposition = evaluate_triggers(
            evaluation["signals"],
            rate_model=evaluation["macro_quadrant"].get("financial_conditions"),
        )
        energy_trigger = evaluation["energy_shock"].get("trigger")
        if energy_trigger:
            triggers.append(energy_trigger)
            triggers.sort(
                key=lambda item: (-SEVERITY_RANK[item["severity"]], item["rule_id"])
            )
        coverage = calculate_coverage(evaluation["signals"])
        urgency, review_reasons = calculate_review_urgency(
            evaluation["automatic_regime"], evaluation["candidate_regime"], triggers, coverage, worsened_domains,
            bool(prior_evaluation and prior_evaluation["automatic_regime"] != evaluation["automatic_regime"]),
        )
        if persist_state and not evaluation["id"].startswith("preview-"):
            self._sync_triggers(triggers)
            self._save_assessment(evaluation["id"], urgency, review_reasons, coverage)
        assessment_fingerprint = self._assessment_fingerprint(
            evaluation["candidate_regime"], urgency, triggers, coverage
        )
        latest_ack = self._latest_acknowledgment()
        acknowledged = self._acknowledges(
            latest_ack, triggers, assessment_fingerprint, urgency
        )
        evaluation["macro_quadrant"]["recession_confirmation"] = (
            self._recession_confirmation(evaluation, triggers)
        )
        triggers = self._attach_trigger_lifecycle(triggers, latest_ack)
        evaluation.update({
            "rule_version": RULE_VERSION,
            "review_urgency": urgency,
            "review_reasons": review_reasons,
            "triggers": triggers,
            "rate_decomposition": rate_decomposition,
            "coverage": coverage,
            "latest_acknowledgment": latest_ack,
            "assessment_fingerprint": assessment_fingerprint,
            "review_acknowledged": acknowledged,
            "needs_new_review": urgency == "required" and not acknowledged,
        })
        evaluation["portfolio_signals"] = self._portfolio_signals(evaluation["domains"])
        portfolio, target = self._portfolio_context()
        evaluation["portfolio"] = portfolio
        evaluation["target_plan"] = target
        fetched_times = [
            datetime.fromisoformat(item["fetched_at"])
            for item in evaluation["signals"]
            if item.get("fetched_at") and item.get("usage") == "regime"
        ]
        evaluation["cache_age_hours"] = round(
            (datetime.now(timezone.utc) - min(fetched_times)).total_seconds() / 3600, 1
        ) if fetched_times else None
        evaluation["newest_cache_age_hours"] = round(
            (datetime.now(timezone.utc) - max(fetched_times)).total_seconds() / 3600, 1
        ) if fetched_times else None
        evaluation["is_stale"] = any(
            domain["stale"] for domain in coverage["domains"].values()
        )
        feed_health = self._feed_health()
        evaluation["data_quality"] = self._data_quality(
            evaluation["signals"], coverage, feed_health
        )
        event_service = RegimeEventService()
        evaluation["upcoming_events"] = event_service.upcoming()
        evaluation["feed_health"] = feed_health
        return evaluation

    def dashboard_summary(self) -> dict[str, Any]:
        """Return the last fully persisted review state without recomputation.

        The dashboard only needs a handful of fields.  Rebuilding the complete
        regime response here would recalculate every historical chart and block
        unrelated API requests.  Refreshes already persist the evaluation,
        assessment, active triggers, and acknowledgment needed for this view.
        """

        with self.db.connect() as conn:
            state = conn.execute(
                "SELECT e.id,e.evaluated_at,e.candidate_regime,e.automatic_regime,"
                "a.urgency,a.coverage_json "
                "FROM review_assessments a "
                "JOIN regime_evaluations e ON e.id=a.evaluation_id "
                "ORDER BY a.assessed_at DESC LIMIT 1"
            ).fetchone()
            triggers = [
                {"rule_id": row["rule_id"], "severity": row["severity"]}
                for row in conn.execute(
                    "SELECT rule_id,severity FROM regime_triggers "
                    "WHERE active=1 ORDER BY rule_id"
                ).fetchall()
            ]

        if not state:
            return {
                "available": False,
                "evaluated_at": None,
                "automatic_regime": None,
                "review_urgency": "not_needed",
                "review_acknowledged": False,
                "needs_new_review": False,
                "active_trigger_count": 0,
            }

        coverage = json.loads(state["coverage_json"])
        urgency = state["urgency"]
        fingerprint = self._assessment_fingerprint(
            state["candidate_regime"], urgency, triggers, coverage
        )
        acknowledgment = self._latest_acknowledgment()
        acknowledged = self._acknowledges(
            acknowledgment, triggers, fingerprint, urgency
        )
        return {
            "available": True,
            "evaluated_at": state["evaluated_at"],
            "automatic_regime": state["automatic_regime"],
            "review_urgency": urgency,
            "review_acknowledged": acknowledged,
            "needs_new_review": urgency == "required" and not acknowledged,
            "active_trigger_count": len(triggers),
        }

    @staticmethod
    def _thesis_changes(
        previous: dict[str, Any], current: dict[str, Any]
    ) -> list[str]:
        """Compare like-for-like thesis stages without changing macro state."""

        def nested(payload: dict[str, Any] | None, *path: str) -> Any:
            value: Any = payload
            for key in path:
                if not isinstance(value, dict):
                    return None
                value = value.get(key)
            return value

        comparisons = [
            ("AI 투자 강도", "ai_capex", ("state",)),
            ("DRAM 가격 표본", "memory_cycle", ("state",)),
            ("NAND 가격 표본", "memory_cycle", ("nand_state",)),
            ("DRAM 수급 핵심축", "semiconductor_cycle", ("dram_bottleneck", "state")),
            ("HBM·서버 DRAM 간접계측", "semiconductor_cycle", ("hbm_server_proxy", "state")),
            ("메모리 수요", "semiconductor_cycle", ("demand", "state")),
            ("완제품 재고 보조축", "semiconductor_cycle", ("supply", "state")),
            ("국내 기업 확인", "semiconductor_cycle", ("company_confirmation", "state")),
            ("전력 투자 근거", "power_cycle", ("state",)),
            ("전력 수요", "power_cycle", ("demand_axis", "state")),
            ("전력 운영 압력", "power_cycle", ("operations_axis", "state")),
            ("발전·저장 건설", "power_cycle", ("supply_axis", "state")),
            ("발전 접속 대기", "power_cycle", ("interconnection_axis", "state")),
            ("송전 투자 실행", "power_cycle", ("transmission_investment_axis", "state")),
        ]
        changes: list[str] = []
        for label, section, path in comparisons:
            before = nested(previous.get(section), *path)
            after = nested(current.get(section), *path)
            if before is not None and after is not None and before != after:
                changes.append(f"{label}: {before} → {after}")
        return changes

    @staticmethod
    def _data_quality(
        signals: list[dict[str, Any]],
        coverage: dict[str, Any],
        feed_health: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        scoped = [item for item in signals if item.get("domain") in {"growth", "inflation", "rates", "liquidity"}
                  and not item["id"].startswith("kr_") and item.get("usage") == "regime"]
        available = [item for item in scoped if item.get("observation_date")]
        unavailable = [item["name"] for item in scoped if item.get("status") == "unavailable"]
        stale_ids = {key for domain in coverage["domains"].values() for key in domain["stale"]}
        stale = [
            {"id": item["id"], "name": item["name"], "observation_date": item.get("observation_date")}
            for item in signals if item["id"] in stale_ids
        ]
        gapped = [
            {
                "id": item["id"], "name": item["name"],
                "missing_periods": item.get("continuity_gaps", []),
                "reason_code": "calendar_period_gap",
            }
            for item in scoped if item.get("continuity_gaps")
        ]
        auxiliary_stale = [
            {
                "id": item["id"],
                "name": item["name"],
                "observation_date": item.get("observation_date"),
                "source": item.get("source"),
                "frequency": item.get("frequency"),
                "age_days": item.get("age_days"),
                "max_age_days": item.get("max_age_days"),
                "reason_code": "reference_stale",
                "used_in_decision": False,
            }
            for item in signals
            if item.get("usage") == "display" and item.get("is_stale")
        ]
        observation_dates = [item["observation_date"] for item in available]
        fetched_at = [item["fetched_at"] for item in available if item.get("fetched_at")]
        status = (
            "판정 불가" if coverage["insufficient_domains"] >= 2
            else "제한" if stale or unavailable or gapped
            else "충분"
        )
        reasons = []
        if stale:
            reasons.append(f"오래된 지표 {len(stale)}개")
        if unavailable:
            reasons.append(f"미수집 지표 {len(unavailable)}개")
        if gapped:
            reasons.append(f"최근 달력 기간 누락 지표 {len(gapped)}개")
        if not reasons:
            reasons.append("핵심 데이터가 권장 갱신 범위 내에 있음")
        total = len(scoped)
        fresh_count = max(0, len(available) - len(stale))
        source_state = (feed_health or {}).get("macro") or {}
        source_status = source_state.get("status") or "unknown"
        if source_status in {"success", "cached"}:
            collection_label = "최근 수집 정상"
        elif source_status in {"partial", "failed"} and not stale and not unavailable:
            collection_label = "최근 수집 일부 실패·정상 캐시 사용"
        elif source_status == "configuration_required":
            collection_label = "수집 설정 필요·기존 캐시 확인"
        else:
            collection_label = "최근 수집 상태 확인 필요"
        contract_count = sum(
            bool(item.get("source_key") and item.get("frequency") and item.get("unit"))
            for item in scoped
        )
        vintage_count = sum(bool(item.get("vintage_history_available")) for item in scoped)
        return {
            "status": status, "overall_coverage": coverage["overall"], "reasons": reasons,
            "stale": stale, "unavailable": unavailable, "continuity_gaps": gapped,
            "scope": "us_macro_decision_inputs",
            "auxiliary_stale": auxiliary_stale,
            "observation_range": {"from": min(observation_dates) if observation_dates else None,
                                  "to": max(observation_dates) if observation_dates else None},
            "last_fetched_at": max(fetched_at) if fetched_at else None,
            "dimensions": {
                "decision_inputs": {
                    "available": len(available), "total": total,
                    "ratio": round(len(available) / total, 3) if total else 0,
                    "label": f"판정입력 {len(available)}/{total}",
                },
                "freshness": {
                    "fresh": fresh_count, "total": total,
                    "ratio": round(fresh_count / total, 3) if total else 0,
                    "label": f"권장 갱신범위 내 {fresh_count}/{total}",
                },
                "source_refresh": {
                    "status": source_status,
                    "label": collection_label,
                    "last_attempted_at": source_state.get("last_attempted_at"),
                    "last_success_at": source_state.get("last_success_at"),
                    "uses_cached_fallback": source_status in {"partial", "failed"}
                    and not stale and not unavailable,
                },
                "series_contract": {
                    "declared": contract_count, "total": total,
                    "label": f"계열 ID·단위·주기 명시 {contract_count}/{total}",
                    "official_value_crosscheck": "핵심 계열별 테스트",
                },
                "calendar_continuity": {
                    "complete": max(0, len(available) - len(gapped)),
                    "total": len(available),
                    "gapped": len(gapped),
                    "label": (
                        f"최근 비교기간 누락 {len(gapped)}개 계열"
                        if gapped else "최근 비교기간 연속성 확인"
                    ),
                },
                "revision_history": {
                    "available": vintage_count, "total": total,
                    "label": f"최초 발표 이력 {vintage_count}/{total}",
                },
                "anomaly_validation": {
                    "status": "rule_based_partial",
                    "label": "규칙·계열 계약 검사 적용 · 전 계열 공식값 자동 대조는 미구현",
                },
            },
        }

    @staticmethod
    def _recession_confirmation(
        evaluation: dict[str, Any], triggers: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Cross-check leading curve risk with coincident recession evidence."""

        conditions = evaluation.get("macro_quadrant", {}).get("financial_conditions", {})
        curve = conditions.get("yield_curve") or {}
        curve_score = curve.get("score")
        if curve_score is None:
            curve_status, curve_state = "unavailable", "판정자료 부족"
        elif curve_score >= 50:
            curve_status, curve_state = "elevated", "선행위험 높음"
        elif curve_score >= 25:
            curve_status, curve_state = "watch", "선행위험 경계"
        else:
            curve_status, curve_state = "clear", "선행위험 낮음"

        labor_triggers = [
            item for item in triggers
            if item.get("evidence_cluster") == "labor"
            or item.get("rule_id", "").startswith("recession.")
            and "yield_curve" not in item.get("rule_id", "")
        ]
        labor_rank = max(
            (SEVERITY_RANK.get(item.get("severity", ""), 0) for item in labor_triggers),
            default=0,
        )
        labor_status = "confirmed" if labor_rank >= 3 else "watch" if labor_rank >= 2 else "clear"
        labor_state = (
            "노동시장 악화 확인" if labor_status == "confirmed"
            else "노동시장 악화 관찰" if labor_status == "watch"
            else "현재 노동시장 악화 근거 없음"
        )

        activity_inputs = [
            item for item in evaluation.get("signals", [])
            if item.get("id") in {"us_gdp", "us_indpro", "us_retail"}
            and item.get("usable_for_decision")
        ]
        weak_activity = [
            item for item in activity_inputs if item.get("status") in {"둔화", "약화"}
        ]
        activity_status = (
            "confirmed" if len(weak_activity) >= 2
            else "watch" if len(weak_activity) == 1
            else "clear" if activity_inputs
            else "unavailable"
        )
        activity_state = (
            "복수 실물지표 약화" if activity_status == "confirmed"
            else "일부 실물지표 약화" if activity_status == "watch"
            else "현재 실물경제 악화 근거 없음" if activity_status == "clear"
            else "판정자료 부족"
        )

        credit = conditions.get("credit") or {}
        credit_score = credit.get("score")
        if credit_score is None:
            credit_status, credit_state = "unavailable", "판정자료 부족"
        elif credit_score >= 65:
            credit_status, credit_state = "confirmed", "신용여건 악화 확인"
        elif credit_score >= 25:
            credit_status, credit_state = "watch", "신용여건 악화 관찰"
        else:
            credit_status, credit_state = "clear", "현재 신용여건 악화 근거 없음"

        coincident_statuses = (labor_status, activity_status, credit_status)
        coincident_count = sum(status in {"watch", "confirmed"} for status in coincident_statuses)
        confirmed_count = sum(status == "confirmed" for status in coincident_statuses)
        if coincident_count >= 2 or confirmed_count >= 1 and coincident_count >= 1:
            status, label = "confirmed", "노동·실물·신용 중 복수 축 악화 확인"
        elif coincident_count == 1:
            status, label = "watch", "노동·실물·신용 중 1개 축 악화 관찰"
        elif curve_status in {"watch", "elevated"}:
            status, label = (
                "leading_only",
                "노동·실물·신용 3축의 악화 확인 없음 · 수익률곡선 선행 경고 관찰",
            )
        elif any(item == "unavailable" for item in coincident_statuses):
            status, label = "limited", "노동·실물·신용 3축 중 일부 자료 부족"
        else:
            status, label = "clear", "노동·실물·신용 3축에서 악화 확인 없음"

        return {
            "status": status,
            "label": label,
            "as_of_date": (
                curve.get("as_of_date")
                or conditions.get("as_of_date")
                or evaluation.get("macro_quadrant", {}).get("as_of_date")
            ),
            "coincident_risk_count": coincident_count,
            "methodology": "수익률곡선의 선행 경고와 노동·실물경제·신용의 현재 악화 여부를 함께 확인",
            "channels": [
                {"id": "yield_curve", "name": "수익률곡선", "status": curve_status, "state": curve_state},
                {"id": "labor", "name": "노동", "status": labor_status, "state": labor_state},
                {"id": "real_activity", "name": "실질활동", "status": activity_status, "state": activity_state},
                {"id": "credit", "name": "신용", "status": credit_status, "state": credit_state},
            ],
        }

    def _attach_trigger_lifecycle(
        self,
        triggers: list[dict[str, Any]],
        acknowledgment: dict[str, Any] | None,
    ) -> list[dict[str, Any]]:
        with self.db.connect() as conn:
            rows = {
                row["rule_id"]: dict(row)
                for row in conn.execute("SELECT * FROM regime_triggers").fetchall()
            }
        acknowledged = acknowledgment.get("trigger_state", {}) if acknowledgment else {}
        acknowledged_at = acknowledgment.get("completed_at") if acknowledgment else None
        result: list[dict[str, Any]] = []
        for trigger in triggers:
            row = rows.get(trigger["rule_id"])
            prior_rank = SEVERITY_RANK.get(acknowledged.get(trigger["rule_id"], ""), 0)
            current_rank = SEVERITY_RANK.get(trigger.get("severity", ""), 0)
            activated_at = (
                row.get("current_fired_at") or row.get("first_fired_at")
                if row else None
            )
            if prior_rank and current_rank > prior_rank:
                lifecycle = "worsened"
            elif prior_rank >= current_rank:
                lifecycle = "acknowledged"
            elif acknowledged_at and activated_at and activated_at > acknowledged_at:
                lifecycle = "new"
            else:
                lifecycle = "active"
            result.append({
                **trigger,
                "lifecycle": lifecycle,
                "activated_at": activated_at,
                "last_seen_at": row.get("last_fired_at") if row else None,
            })
        return result

    def _feed_health(self) -> dict[str, Any]:
        from app.services.regime_energy import EnergyShockService
        from app.services.regime_thesis import RegimeThesisDataService

        with self.db.connect() as conn:
            macro = conn.execute(
                "SELECT source,last_attempted_at,last_success_at,status,item_count,error FROM regime_feed_status "
                "WHERE source='macro'"
            ).fetchone()
            if not macro:
                run = conn.execute(
                    "SELECT source,started_at,finished_at,status,observations_saved,error "
                    "FROM regime_fetch_runs ORDER BY started_at DESC LIMIT 1"
                ).fetchone()
                macro = ({
                    "source": "macro", "last_attempted_at": run["started_at"],
                    "last_success_at": run["finished_at"] if run["status"] in {"success", "partial"} else None,
                    "status": run["status"], "item_count": run["observations_saved"], "error": run["error"],
                } if run else None)
            events = conn.execute(
                "SELECT * FROM regime_feed_status WHERE source='macro_events'"
            ).fetchone()
            treasury = conn.execute(
                "SELECT * FROM regime_feed_status WHERE source='treasury_curve'"
            ).fetchone()
            memory = conn.execute(
                "SELECT source,last_attempted_at,last_success_at,status,observation_count AS item_count,error "
                "FROM memory_price_fetch_status WHERE source='trendforce_public'"
            ).fetchone()
            companies = [dict(row) for row in conn.execute(
                "SELECT * FROM company_fetch_status ORDER BY company_id"
            ).fetchall()]
        company_statuses = [row["status"] for row in companies]
        ai_status = (
            "unavailable" if not companies
            else "success" if all(value == "success" for value in company_statuses)
            else "failed" if all(value == "failed" for value in company_statuses)
            else "partial"
        )
        ai_successes = [row["last_success_at"] for row in companies if row.get("last_success_at")]
        ai_attempts = [row["last_attempted_at"] for row in companies if row.get("last_attempted_at")]
        thesis_feeds = RegimeThesisDataService().feed_health()
        return {
            "macro": dict(macro) if macro else None,
            "events": dict(events) if events else None,
            "treasury": dict(treasury) if treasury else None,
            "ai_capex": {
                "source": "sec_capex", "status": ai_status,
                "last_attempted_at": max(ai_attempts) if ai_attempts else None,
                "last_success_at": min(ai_successes) if ai_successes else None,
                "item_count": len(ai_successes),
                "error": " · ".join(row["error"] for row in companies if row.get("error")) or None,
            },
            "memory": dict(memory) if memory else None,
            "kosis": thesis_feeds["kosis_semiconductor"],
            "customs": thesis_feeds["customs_memory_exports"],
            "opendart": thesis_feeds["opendart_semiconductor"],
            "eia": thesis_feeds["eia_power"],
            "energy": EnergyShockService().feed_health(),
            "lbnl_queue": thesis_feeds.get("lbnl_interconnection_queue"),
            "transmission_investment": thesis_feeds.get("pudl_ferc1_transmission_investment"),
        }

    def _sync_triggers(self, triggers: list[dict[str, Any]]) -> None:
        fired_at = _now()
        active_ids = {item["rule_id"] for item in triggers}
        with self.db.connect() as conn:
            existing = {row["rule_id"]: dict(row) for row in conn.execute("SELECT * FROM regime_triggers").fetchall()}
            for item in triggers:
                old = existing.get(item["rule_id"])
                payload = {
                    "rule_version": item["rule_version"], "domain": item["domain"],
                    "severity": item["severity"], "direction": item["direction"],
                    "evidence_cluster": item["evidence_cluster"], "summary": item["summary"],
                    "evidence_json": json.dumps(item["evidence"], ensure_ascii=False),
                    "last_fired_at": fired_at, "active": 1, "resolved_at": None,
                }
                if old:
                    payload["current_fired_at"] = (
                        old.get("current_fired_at") or old["first_fired_at"]
                        if old["active"] else fired_at
                    )
                    assignments = ",".join(f"{key}=?" for key in payload)
                    conn.execute(
                        f"UPDATE regime_triggers SET {assignments} WHERE rule_id=?",
                        (*payload.values(), item["rule_id"]),
                    )
                else:
                    conn.execute(
                        "INSERT INTO regime_triggers(id,rule_id,rule_version,domain,severity,direction,evidence_cluster,"
                        "summary,evidence_json,first_fired_at,last_fired_at,active,resolved_at,current_fired_at) "
                        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (str(uuid4()), item["rule_id"], item["rule_version"], item["domain"], item["severity"],
                         item["direction"], item["evidence_cluster"], item["summary"],
                         json.dumps(item["evidence"], ensure_ascii=False), fired_at, fired_at, 1, None, fired_at),
                    )
            for rule_id, old in existing.items():
                if old["active"] and rule_id not in active_ids:
                    conn.execute("UPDATE regime_triggers SET active=0,resolved_at=? WHERE rule_id=?", (fired_at, rule_id))

    def _save_assessment(self, evaluation_id: str, urgency: str, reasons: list[str], coverage: dict[str, Any]) -> None:
        with self.db.connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO review_assessments(id,evaluation_id,assessed_at,urgency,reasons_json,coverage_json,trigger_rule_version) "
                "VALUES(?,?,?,?,?,?,?)",
                (str(uuid4()), evaluation_id, _now(), urgency, json.dumps(reasons, ensure_ascii=False),
                 json.dumps(coverage, ensure_ascii=False), RULE_VERSION),
            )

    def _latest_acknowledgment(self) -> dict[str, Any] | None:
        with self.db.connect() as conn:
            row = conn.execute(
                "SELECT * FROM regime_review_acknowledgments ORDER BY completed_at DESC LIMIT 1"
            ).fetchone()
        if not row:
            return None
        result = dict(row)
        result["trigger_state"] = json.loads(result.pop("trigger_state_json"))
        return result

    @staticmethod
    def _assessment_fingerprint(
        candidate: str,
        urgency: str,
        triggers: list[dict[str, Any]],
        coverage: dict[str, Any],
    ) -> str:
        payload = {
            "candidate": candidate,
            "urgency": urgency,
            "triggers": sorted(
                (item["rule_id"], item["severity"]) for item in triggers
            ),
            "coverage": {
                key: {
                    "status": value["status"],
                    "stale": sorted(value["stale"]),
                    "usable": value["usable"],
                    "total": value["total"],
                }
                for key, value in sorted(coverage["domains"].items())
            },
        }
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()

    @staticmethod
    def _acknowledges(
        ack: dict[str, Any] | None,
        triggers: list[dict[str, Any]],
        assessment_fingerprint: str | None = None,
        urgency: str | None = None,
    ) -> bool:
        if not ack:
            return False
        if assessment_fingerprint and ack.get("assessment_fingerprint"):
            return ack["assessment_fingerprint"] == assessment_fingerprint
        if urgency == "required" and not triggers:
            return False
        prior = ack["trigger_state"]
        return all(
            item["rule_id"] in prior
            and SEVERITY_RANK.get(prior[item["rule_id"]], 0) >= SEVERITY_RANK[item["severity"]]
            for item in triggers
        )

    def complete_review(self, note: str | None = None) -> dict[str, Any]:
        self.evaluate(persist=True)
        current = self.current(persist_state=True)
        self._insert_acknowledgment(current, note)
        return self.current()

    def _insert_acknowledgment(self, current: dict[str, Any], note: str | None = None) -> None:
        self.db.table("regime_review_acknowledgments").insert(
            self._acknowledgment_payload(current, note)
        ).execute()

    @staticmethod
    def _acknowledgment_payload(current: dict[str, Any], note: str | None = None) -> dict[str, Any]:
        return {
            "id": str(uuid4()), "completed_at": _now(), "evaluation_id": current["id"],
            "trigger_state_json": {item["rule_id"]: item["severity"] for item in current["triggers"]},
            "assessment_fingerprint": current.get("assessment_fingerprint"),
            "candidate_regime": current.get("candidate_regime"),
            "urgency": current.get("review_urgency"),
            "note": note.strip()[:300] if note and note.strip() else None,
        }

    @staticmethod
    def _portfolio_signals(domains: list[dict]) -> list[str]:
        states = {item["id"]: item["state"] for item in domains}
        signals = []
        signals.append("주식 위험 경계" if states.get("growth") in {"둔화", "약화"} else "주식 위험 유지")
        signals.append("장기채 대기" if states.get("inflation") in {"둔화", "약화"} or states.get("rates") in {"둔화", "약화"} else "장기채 환경 중립")
        signals.append("단기채 방어 유지" if any(value in {"둔화", "약화"} for value in states.values()) else "단기채 방어 필요 낮음")
        return signals

    def create_snapshot(self, user_regime: str | None, user_note: str | None) -> dict[str, Any]:
        self.evaluate(persist=True)
        current = self.current(persist_state=True)
        if user_regime and user_regime not in REGIME_ORDER:
            raise ValueError("지원하지 않는 사용자 레짐")
        snapshot_id, created_at = str(uuid4()), _now()
        raw_inputs = self._snapshot_inputs(current["evaluated_at"])
        payload = {
            "id": snapshot_id, "created_at": created_at, "evaluation_id": current["id"],
            "automatic_regime": current["automatic_regime"], "user_regime": user_regime,
            "user_note": user_note, "raw_data_json": raw_inputs, "signals_json": current["signals"],
            "domains_json": current["domains"], "reasons_json": current["reasons"],
            "portfolio_json": current["portfolio"], "target_plan_json": current["target_plan"],
            "review_urgency": current["review_urgency"], "triggers_json": current["triggers"],
            "coverage_json": current["coverage"], "rule_version": current["rule_version"],
            "review_completed": True,
            "as_of_date": current["macro_quadrant"].get("as_of_date"),
            "last_fetched_at": current["data_quality"].get("last_fetched_at"),
            "observation_range_json": current["data_quality"].get("observation_range"),
            "macro_quadrant_json": current["macro_quadrant"],
            "ai_capex_json": current["ai_capex"],
            "upcoming_events_json": current["upcoming_events"],
            "memory_cycle_json": current["memory_cycle"],
            "semiconductor_cycle_json": current["semiconductor_cycle"],
            "power_cycle_json": current["power_cycle"],
            "energy_shock_json": current["energy_shock"],
            "input_fingerprint": current.get("data_fingerprint"),
            "assessment_fingerprint": current.get("assessment_fingerprint"),
            "feed_health_json": current.get("feed_health"),
            "snapshot_schema_version": "4",
        }
        acknowledgment = self._acknowledgment_payload(current, user_note)
        # Snapshot and its implicit review acknowledgment describe one user
        # action, so either both rows are committed or neither is.
        with self.db.connect() as conn:
            encoded = {
                key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value
                for key, value in payload.items()
            }
            columns = ",".join(encoded)
            conn.execute(
                f"INSERT INTO regime_snapshots({columns}) VALUES({','.join('?' for _ in encoded)})",
                tuple(encoded.values()),
            )
            ack_encoded = {
                key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value
                for key, value in acknowledgment.items()
            }
            ack_columns = ",".join(ack_encoded)
            conn.execute(
                f"INSERT INTO regime_review_acknowledgments({ack_columns}) "
                f"VALUES({','.join('?' for _ in ack_encoded)})",
                tuple(ack_encoded.values()),
            )
        return self.get_snapshot(snapshot_id)

    def _snapshot_inputs(self, captured_at: str) -> dict[str, Any]:
        """Capture every enabled source row used to reproduce this evaluation."""
        definitions = self._indicator_rows()
        indicators = []
        for definition in definitions:
            role = indicator_role(definition["id"])
            indicators.append({
                **{key: definition[key] for key in (
                    "id", "domain", "name", "source", "source_key", "unit",
                    "frequency", "direction", "weight", "enabled",
                )},
                **role,
                "timing": definition.get("timing"),
                "observations": definition["observations"],
            })
        return {
            "schema_version": "2",
            "captured_at": captured_at,
            "rule_version": RULE_VERSION,
            "indicators": indicators,
        }

    def _portfolio_context(self) -> tuple[dict[str, Any], dict[str, Any] | None]:
        with self.db.connect() as conn:
            portfolio = conn.execute("SELECT * FROM portfolios ORDER BY created_at LIMIT 1").fetchone()
            assets = conn.execute(
                "SELECT * FROM assets WHERE is_active=1 AND portfolio_id=? ORDER BY name",
                (portfolio["id"],),
            ).fetchall() if portfolio else []
            plan = conn.execute("SELECT * FROM rebalance_plans WHERE is_main=1 AND is_active=1 LIMIT 1").fetchone()
            target = None
            if plan:
                target = {
                    "plan": dict(plan),
                    "allocations": [dict(row) for row in conn.execute("SELECT * FROM plan_allocations WHERE plan_id=?", (plan["id"],)).fetchall()],
                    "groups": [dict(row) for row in conn.execute("SELECT * FROM allocation_groups WHERE plan_id=?", (plan["id"],)).fetchall()],
                }
        return {"portfolio": dict(portfolio) if portfolio else None, "assets": [dict(row) for row in assets]}, target

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any]:
        with self.db.connect() as conn:
            row = conn.execute("SELECT * FROM regime_snapshots WHERE id=?", (snapshot_id,)).fetchone()
        if not row:
            raise KeyError(snapshot_id)
        return self._snapshot_dict(dict(row))

    def history(self, include_raw: bool = False) -> list[dict[str, Any]]:
        with self.db.connect() as conn:
            rows = conn.execute("SELECT * FROM regime_snapshots ORDER BY created_at DESC").fetchall()
        return [self._snapshot_dict(dict(row), include_raw=include_raw) for row in rows]

    def update_judgment(self, snapshot_id: str, user_regime: str | None, user_note: str | None) -> dict[str, Any]:
        if user_regime and user_regime not in REGIME_ORDER:
            raise ValueError("지원하지 않는 사용자 레짐")
        self.db.table("regime_snapshots").update({"user_regime": user_regime, "user_note": user_note}).eq("id", snapshot_id).execute()
        return self.get_snapshot(snapshot_id)

    @staticmethod
    def _snapshot_dict(row: dict[str, Any], include_raw: bool = True) -> dict[str, Any]:
        row["raw_data_available"] = bool(row.get("raw_data_json"))
        json_fields = [
            "signals_json", "domains_json", "reasons_json", "portfolio_json",
            "target_plan_json", "triggers_json", "coverage_json",
            "observation_range_json", "macro_quadrant_json", "ai_capex_json",
            "upcoming_events_json", "memory_cycle_json", "feed_health_json",
            "semiconductor_cycle_json", "power_cycle_json",
            "energy_shock_json",
        ]
        if include_raw:
            json_fields.insert(0, "raw_data_json")
        else:
            row.pop("raw_data_json", None)
        for key in json_fields:
            row[key.removesuffix("_json")] = json.loads(row[key]) if row.get(key) else None
            row.pop(key, None)
        return row
