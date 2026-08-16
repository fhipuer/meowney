"""거시 데이터 캐시와 결정론적 투자 레짐 판정 서비스."""

from __future__ import annotations

import hashlib
import json
import asyncio
from datetime import datetime, timezone
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
    evaluate_triggers,
)
from app.services.regime_quadrant import calculate_us_macro_quadrant
from app.services.regime_vintage import (
    RegimeVintageRepository,
    initial_release_params,
    parse_initial_release_observations,
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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _change(values: list[float], periods: int) -> float | None:
    if len(values) <= periods or values[-periods - 1] == 0:
        return None
    return (values[-1] / values[-periods - 1] - 1) * 100


class RegimeService:
    def __init__(self) -> None:
        self.db = get_database_client()

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        """FRED 관측값을 SQLite에 저장한다. 키가 없으면 기존 캐시를 유지한다."""
        if not settings.fred_api_key:
            return {"status": "configuration_required", "source": "fred", "saved": 0}

        if not force:
            with self.db.connect() as conn:
                latest = conn.execute(
                    "SELECT finished_at FROM regime_fetch_runs WHERE source='fred' AND status IN ('success','partial') "
                    "ORDER BY finished_at DESC LIMIT 1"
                ).fetchone()
            if latest and latest["finished_at"]:
                age = datetime.now(timezone.utc) - datetime.fromisoformat(latest["finished_at"])
                if age.total_seconds() < 20 * 3600:
                    return {"status": "cached", "source": "fred", "saved": 0, "evaluation": self.evaluate()}

        with self.db.connect() as conn:
            indicators = [dict(row) for row in conn.execute(
                "SELECT * FROM regime_indicators WHERE source='fred' AND enabled=1"
            ).fetchall()]
        run_id, started_at, saved = str(uuid4()), _now(), 0
        self.db.table("regime_fetch_runs").insert({
            "id": run_id, "source": "fred", "started_at": started_at, "status": "running"
        }).execute()
        try:
            semaphore = asyncio.Semaphore(6)

            async def fetch_indicator(client: httpx.AsyncClient, indicator: dict[str, Any]) -> list[tuple]:
                try:
                    async with semaphore:
                        params = {
                            "series_id": indicator["source_key"], "api_key": settings.fred_api_key,
                            "file_type": "json", "sort_order": "desc", "limit": 420,
                        }
                        response = await client.get(
                            "https://api.stlouisfed.org/fred/series/observations", params=params
                        )
                        if response.is_error:
                            raise RuntimeError(f"FRED HTTP {response.status_code}")
                        fetched_at = _now()
                        rows = []
                        for item in response.json().get("observations", []):
                            value = _float(item.get("value"))
                            if value is not None:
                                rows.append((str(uuid4()), indicator["id"], item["date"], value, fetched_at, "fred"))
                        return rows
                except Exception as exc:
                    raise RuntimeError(f"{indicator['id']}: {type(exc).__name__}") from None

            async def fetch_initial_vintage(client: httpx.AsyncClient, indicator: dict[str, Any]) -> list[Any]:
                if indicator["id"] not in PIT_TIER1:
                    return []
                try:
                    async with semaphore:
                        response = await client.get(
                            "https://api.stlouisfed.org/fred/series/observations",
                            params=initial_release_params(indicator["source_key"], settings.fred_api_key, limit=420),
                        )
                        if response.is_error:
                            raise RuntimeError(f"FRED vintage HTTP {response.status_code}")
                        return parse_initial_release_observations(indicator["id"], response.json(), _now())
                except Exception as exc:
                    raise RuntimeError(f"{indicator['id']}.vintage: {type(exc).__name__}") from None

            async with httpx.AsyncClient(timeout=30) as client:
                batches, vintage_batches = await asyncio.gather(
                    asyncio.gather(*(fetch_indicator(client, indicator) for indicator in indicators), return_exceptions=True),
                    asyncio.gather(*(fetch_initial_vintage(client, indicator) for indicator in indicators), return_exceptions=True),
                )
            errors = [str(result) for result in batches if isinstance(result, Exception)]
            errors.extend(str(result) for result in vintage_batches if isinstance(result, Exception))
            rows = [row for batch in batches if isinstance(batch, list) for row in batch]
            vintage_rows = [row for batch in vintage_batches if isinstance(batch, list) for row in batch]
            if not rows and errors:
                raise RuntimeError("; ".join(errors[:3]))
            with self.db.connect() as conn:
                conn.executemany(
                    "INSERT INTO regime_observations(id,indicator_id,observation_date,value,fetched_at,source) "
                    "VALUES(?,?,?,?,?,?) ON CONFLICT(indicator_id,observation_date) DO UPDATE SET "
                    "value=excluded.value,fetched_at=excluded.fetched_at,source=excluded.source",
                    rows,
                )
            RegimeVintageRepository(self.db).save(vintage_rows, run_id)
            saved = len(rows)
            self.db.table("regime_fetch_runs").update({
                "finished_at": _now(), "status": "partial" if errors else "success",
                "observations_saved": saved, "error": "; ".join(errors[:3]) if errors else None,
            }).eq("id", run_id).execute()
        except Exception as exc:
            self.db.table("regime_fetch_runs").update({
                "finished_at": _now(), "status": "failed", "error": str(exc)[:1000]
            }).eq("id", run_id).execute()
            raise
        evaluation = self.evaluate()
        return {"status": "partial" if errors else "success", "source": "fred", "saved": saved,
                "errors": errors[:3], "evaluation": evaluation}

    def _indicator_rows(self) -> list[dict[str, Any]]:
        with self.db.connect() as conn:
            definitions = [dict(row) for row in conn.execute(
                "SELECT * FROM regime_indicators WHERE enabled=1 ORDER BY domain,id"
            ).fetchall()]
            for definition in definitions:
                definition["observations"] = [dict(row) for row in conn.execute(
                    "SELECT observation_date,value,fetched_at,source FROM regime_observations "
                    "WHERE indicator_id=? ORDER BY observation_date",
                    (definition["id"],),
                ).fetchall()]
        return definitions

    def _signal(self, indicator: dict[str, Any]) -> dict[str, Any]:
        observations = indicator["observations"]
        values = [float(row["value"]) for row in observations]
        if not values:
            return {**{key: indicator[key] for key in ("id", "domain", "name", "unit", "source", "frequency")},
                    "status": "unavailable", "score": 0, "reason": "수집된 데이터 없음"}
        p1, p3, p12 = FREQUENCY_PERIODS[indicator["frequency"]]
        latest, change1, change3, change12 = values[-1], _change(values, p1), _change(values, p3), _change(values, p12)
        score, reason = self._score(indicator["id"], latest, change3, change12, values, p3, p12)
        status = "강함" if score >= 0.75 else "중립" if score > -0.5 else "둔화" if score > -1.5 else "약화"
        return {
            **{key: indicator[key] for key in ("id", "domain", "name", "unit", "source", "frequency")},
            "observation_date": observations[-1]["observation_date"],
            "fetched_at": observations[-1]["fetched_at"],
            "value": latest,
            "change_1m": change1,
            "change_3m": change3,
            "change_12m": change12,
            "score": score,
            "status": status,
            "reason": reason,
            "history": [{"date": row["observation_date"], "value": float(row["value"])} for row in observations[-52:]],
        }

    @staticmethod
    def _score(key: str, latest: float, c3: float | None, c12: float | None,
               values: list[float], p3: int, p12: int) -> tuple[float, str]:
        delta3 = latest - values[-p3 - 1] if len(values) > p3 else 0
        yoy = c12 or 0
        if key == "us_unemployment":
            return (-2 if delta3 >= .3 else -1 if delta3 >= .15 else .5, f"3개월 {delta3:+.2f}%p")
        if key == "us_claims":
            return (-2 if (c3 or 0) >= 15 else -1 if (c3 or 0) >= 7 else .5, f"3개월 {c3 or 0:+.1f}%")
        if key in {"cpi", "core_cpi", "pce", "core_pce", "ppi", "wages"}:
            annualized = ((latest / values[-p3 - 1]) ** (12 / 3) - 1) * 100 if len(values) > p3 and values[-p3 - 1] else 0
            return (-2 if annualized >= 4 else -1 if annualized >= 3 else .75 if annualized < 2.5 else 0,
                    f"3개월 연율 {annualized:.1f}%")
        if key == "hy_oas":
            return (-2 if latest >= 5 else -1 if latest >= 4 else .5, f"현재 {latest:.2f}%p")
        if key == "ig_oas":
            return (-1.5 if latest >= 1.5 else -.75 if latest >= 1.2 else .5, f"현재 {latest:.2f}%p")
        if key == "nfci":
            return (-2 if latest >= .5 else -1 if latest >= 0 else .5, f"현재 {latest:.2f}")
        if key in {"us10y", "tips10y", "bei10y", "term_premium", "fedfunds"}:
            return (-1.5 if delta3 >= .5 else -.75 if delta3 >= .25 else .25, f"3개월 {delta3:+.2f}%p")
        if key == "curve2s10s":
            return (-1 if latest < -.5 else -.5 if latest < 0 else .5, f"현재 {latest:+.2f}%p")
        direction = 1 if key in {"us_gdp", "us_payrolls", "us_retail", "us_indpro", "fed_assets", "bank_reserves"} else 0
        if direction:
            return (-1.5 if yoy < -2 else -.75 if yoy < 0 else .75, f"12개월 {yoy:+.1f}%")
        return (0, "중립 규칙")

    def evaluate(self) -> dict[str, Any]:
        definitions = self._indicator_rows()
        weights = {item["id"]: float(item["weight"]) for item in definitions}
        signals = [self._signal(item) for item in definitions]
        macro_quadrant = calculate_us_macro_quadrant([
            {"id": item["id"], "name": item["name"], "frequency": item["frequency"],
             "history": [{"date": row["observation_date"], "value": float(row["value"])}
                         for row in item["observations"]]}
            for item in definitions
        ])
        available = [item for item in signals if item["status"] != "unavailable"]
        fingerprint_source = {
            "model_version": macro_quadrant.get("version"), "rule_version": RULE_VERSION,
            "observations": [(item["id"], item.get("observation_date"), item.get("value")) for item in available],
        }
        fingerprint = hashlib.sha256(json.dumps(fingerprint_source, sort_keys=True).encode()).hexdigest()
        domains: list[dict[str, Any]] = []
        for key, label in DOMAIN_LABELS.items():
            items = [item for item in available if item["domain"] == key and not item["id"].startswith("kr_")]
            weighted = sum(item["score"] * weights[item["id"]] for item in items)
            total_weight = sum(weights[item["id"]] for item in items)
            score = weighted / total_weight if total_weight else 0
            state = "강함" if score >= .5 else "중립" if score > -.5 else "둔화" if score > -1.2 else "약화"
            reasons = [item["reason"] for item in sorted(items, key=lambda row: row["score"])[:2] if item["score"] < 0]
            domains.append({"id": key, "name": label, "state": state if items else "데이터 없음", "score": round(score, 3), "reasons": reasons})
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
        with self.db.connect() as conn:
            existing = conn.execute("SELECT * FROM regime_evaluations WHERE data_fingerprint=?", (fingerprint,)).fetchone()
            previous = conn.execute("SELECT * FROM regime_evaluations ORDER BY evaluated_at DESC LIMIT 1").fetchone()
            prior_two = conn.execute("SELECT candidate_regime FROM regime_evaluations ORDER BY evaluated_at DESC LIMIT 2").fetchall()
        if existing:
            return self._evaluation_dict(dict(existing), signals, domains, macro_quadrant)
        current = previous["automatic_regime"] if previous else "유지"
        confirmed = len(prior_two) >= 1 and all(row["candidate_regime"] == candidate for row in prior_two[:1])
        automatic = candidate if candidate == current or confirmed else current
        reasons = [f"{item['name']}: {reason}" for item in domains for reason in item["reasons"]]
        evaluation_id = str(uuid4())
        self.db.table("regime_evaluations").insert({
            "id": evaluation_id, "evaluated_at": _now(), "data_fingerprint": fingerprint,
            "candidate_regime": candidate, "automatic_regime": automatic,
            "signals_json": signals, "domains_json": domains, "reasons_json": reasons,
        }).execute()
        return {"id": evaluation_id, "evaluated_at": _now(), "candidate_regime": candidate,
                "automatic_regime": automatic, "signals": signals, "domains": domains, "reasons": reasons,
                "macro_quadrant": macro_quadrant}

    @staticmethod
    def _evaluation_dict(row: dict[str, Any], signals: list[dict], domains: list[dict],
                         macro_quadrant: dict[str, Any]) -> dict[str, Any]:
        return {"id": row["id"], "evaluated_at": row["evaluated_at"],
                "candidate_regime": row["candidate_regime"], "automatic_regime": row["automatic_regime"],
                "signals": signals, "domains": domains, "reasons": json.loads(row["reasons_json"]),
                "macro_quadrant": macro_quadrant}

    def current(self) -> dict[str, Any]:
        evaluation = self.evaluate()
        with self.db.connect() as conn:
            latest_fetch = conn.execute("SELECT * FROM regime_fetch_runs ORDER BY started_at DESC LIMIT 1").fetchone()
            latest_snapshot = conn.execute("SELECT created_at,automatic_regime,domains_json FROM regime_snapshots ORDER BY created_at DESC LIMIT 1").fetchone()
            prior_evaluation = conn.execute(
                "SELECT automatic_regime FROM regime_evaluations WHERE id<>? ORDER BY evaluated_at DESC LIMIT 1",
                (evaluation["id"],),
            ).fetchone()
        evaluation["last_fetch"] = dict(latest_fetch) if latest_fetch else None
        evaluation["previous_snapshot"] = dict(latest_snapshot) if latest_snapshot else None
        evaluation["changes_since_snapshot"] = []
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
            evaluation["previous_snapshot"].pop("domains_json", None)
        triggers, rate_decomposition = evaluate_triggers(evaluation["signals"])
        coverage = calculate_coverage(evaluation["signals"])
        urgency, review_reasons = calculate_review_urgency(
            evaluation["automatic_regime"], evaluation["candidate_regime"], triggers, coverage, worsened_domains,
            bool(prior_evaluation and prior_evaluation["automatic_regime"] != evaluation["automatic_regime"]),
        )
        self._sync_triggers(triggers)
        self._save_assessment(evaluation["id"], urgency, review_reasons, coverage)
        latest_ack = self._latest_acknowledgment()
        acknowledged = self._acknowledges(latest_ack, triggers)
        evaluation.update({
            "rule_version": RULE_VERSION,
            "review_urgency": urgency,
            "review_reasons": review_reasons,
            "triggers": triggers,
            "rate_decomposition": rate_decomposition,
            "coverage": coverage,
            "latest_acknowledgment": latest_ack,
            "review_acknowledged": acknowledged,
            "needs_new_review": urgency == "required" and not acknowledged,
        })
        evaluation["portfolio_signals"] = self._portfolio_signals(evaluation["domains"])
        portfolio, target = self._portfolio_context()
        evaluation["portfolio"] = portfolio
        evaluation["target_plan"] = target
        fetched_times = [datetime.fromisoformat(item["fetched_at"]) for item in evaluation["signals"] if item.get("fetched_at")]
        evaluation["cache_age_hours"] = round((datetime.now(timezone.utc) - max(fetched_times)).total_seconds() / 3600, 1) if fetched_times else None
        evaluation["is_stale"] = evaluation["cache_age_hours"] is not None and evaluation["cache_age_hours"] > 48
        evaluation["data_quality"] = self._data_quality(evaluation["signals"], coverage)
        return evaluation

    @staticmethod
    def _data_quality(signals: list[dict[str, Any]], coverage: dict[str, Any]) -> dict[str, Any]:
        scoped = [item for item in signals if item.get("domain") in {"growth", "inflation", "rates", "liquidity"}
                  and not item["id"].startswith("kr_")]
        available = [item for item in scoped if item.get("observation_date")]
        unavailable = [item["name"] for item in scoped if item.get("status") == "unavailable"]
        stale_ids = {key for domain in coverage["domains"].values() for key in domain["stale"]}
        stale = [
            {"id": item["id"], "name": item["name"], "observation_date": item.get("observation_date")}
            for item in signals if item["id"] in stale_ids
        ]
        observation_dates = [item["observation_date"] for item in available]
        fetched_at = [item["fetched_at"] for item in available if item.get("fetched_at")]
        status = "판정 불가" if coverage["insufficient_domains"] >= 2 else "제한" if stale or unavailable else "충분"
        reasons = []
        if stale:
            reasons.append(f"오래된 지표 {len(stale)}개")
        if unavailable:
            reasons.append(f"미수집 지표 {len(unavailable)}개")
        if not reasons:
            reasons.append("핵심 데이터가 권장 갱신 범위 내에 있음")
        return {
            "status": status, "overall_coverage": coverage["overall"], "reasons": reasons,
            "stale": stale, "unavailable": unavailable,
            "observation_range": {"from": min(observation_dates) if observation_dates else None,
                                  "to": max(observation_dates) if observation_dates else None},
            "last_fetched_at": max(fetched_at) if fetched_at else None,
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
                    assignments = ",".join(f"{key}=?" for key in payload)
                    conn.execute(f"UPDATE regime_triggers SET {assignments} WHERE rule_id=?", (*payload.values(), item["rule_id"]))
                else:
                    conn.execute(
                        "INSERT INTO regime_triggers(id,rule_id,rule_version,domain,severity,direction,evidence_cluster,"
                        "summary,evidence_json,first_fired_at,last_fired_at,active,resolved_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (str(uuid4()), item["rule_id"], item["rule_version"], item["domain"], item["severity"],
                         item["direction"], item["evidence_cluster"], item["summary"],
                         json.dumps(item["evidence"], ensure_ascii=False), fired_at, fired_at, 1, None),
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
    def _acknowledges(ack: dict[str, Any] | None, triggers: list[dict[str, Any]]) -> bool:
        if not ack:
            return False
        prior = ack["trigger_state"]
        return all(
            item["rule_id"] in prior
            and SEVERITY_RANK.get(prior[item["rule_id"]], 0) >= SEVERITY_RANK[item["severity"]]
            for item in triggers
        )

    def complete_review(self, note: str | None = None) -> dict[str, Any]:
        current = self.current()
        self._insert_acknowledgment(current, note)
        return self.current()

    def _insert_acknowledgment(self, current: dict[str, Any], note: str | None = None) -> None:
        acknowledgment = {
            "id": str(uuid4()), "completed_at": _now(), "evaluation_id": current["id"],
            "trigger_state_json": {item["rule_id"]: item["severity"] for item in current["triggers"]},
            "note": note.strip()[:300] if note and note.strip() else None,
        }
        self.db.table("regime_review_acknowledgments").insert(acknowledgment).execute()

    @staticmethod
    def _portfolio_signals(domains: list[dict]) -> list[str]:
        states = {item["id"]: item["state"] for item in domains}
        signals = []
        signals.append("주식 위험 경계" if states.get("growth") in {"둔화", "약화"} else "주식 위험 유지")
        signals.append("장기채 대기" if states.get("inflation") in {"둔화", "약화"} or states.get("rates") in {"둔화", "약화"} else "장기채 환경 중립")
        signals.append("단기채 방어 유지" if any(value in {"둔화", "약화"} for value in states.values()) else "단기채 방어 필요 낮음")
        return signals

    def create_snapshot(self, user_regime: str | None, user_note: str | None,
                        review_completed: bool = False) -> dict[str, Any]:
        current = self.current()
        if user_regime and user_regime not in REGIME_ORDER:
            raise ValueError("지원하지 않는 사용자 레짐")
        snapshot_id, created_at = str(uuid4()), _now()
        payload = {
            "id": snapshot_id, "created_at": created_at, "evaluation_id": current["id"],
            "automatic_regime": current["automatic_regime"], "user_regime": user_regime,
            "user_note": user_note, "raw_data_json": current["signals"], "signals_json": current["signals"],
            "domains_json": current["domains"], "reasons_json": current["reasons"],
            "portfolio_json": current["portfolio"], "target_plan_json": current["target_plan"],
            "review_urgency": current["review_urgency"], "triggers_json": current["triggers"],
            "coverage_json": current["coverage"], "rule_version": current["rule_version"],
            "review_completed": review_completed,
            "as_of_date": current["macro_quadrant"].get("as_of_date"),
            "last_fetched_at": current["data_quality"].get("last_fetched_at"),
            "observation_range_json": current["data_quality"].get("observation_range"),
            "macro_quadrant_json": current["macro_quadrant"],
        }
        self.db.table("regime_snapshots").insert(payload).execute()
        if review_completed:
            self._insert_acknowledgment(current, user_note)
        return self.get_snapshot(snapshot_id)

    def _portfolio_context(self) -> tuple[dict[str, Any], dict[str, Any] | None]:
        with self.db.connect() as conn:
            portfolio = conn.execute("SELECT * FROM portfolios ORDER BY created_at LIMIT 1").fetchone()
            assets = conn.execute("SELECT * FROM assets WHERE is_active=1 ORDER BY name").fetchall()
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

    def history(self) -> list[dict[str, Any]]:
        with self.db.connect() as conn:
            rows = conn.execute("SELECT * FROM regime_snapshots ORDER BY created_at DESC").fetchall()
        return [self._snapshot_dict(dict(row)) for row in rows]

    def update_judgment(self, snapshot_id: str, user_regime: str | None, user_note: str | None) -> dict[str, Any]:
        if user_regime and user_regime not in REGIME_ORDER:
            raise ValueError("지원하지 않는 사용자 레짐")
        self.db.table("regime_snapshots").update({"user_regime": user_regime, "user_note": user_note}).eq("id", snapshot_id).execute()
        return self.get_snapshot(snapshot_id)

    @staticmethod
    def _snapshot_dict(row: dict[str, Any]) -> dict[str, Any]:
        for key in ("raw_data_json", "signals_json", "domains_json", "reasons_json", "portfolio_json", "target_plan_json", "triggers_json", "coverage_json", "observation_range_json", "macro_quadrant_json"):
            row[key.removesuffix("_json")] = json.loads(row[key]) if row.get(key) else None
            row.pop(key, None)
        return row

    def export_markdown(self) -> str:
        current, history = self.current(), self.history()
        lines = ["# Meowney 투자 레짐 분석 데이터", "", f"- 기준시각: {current['evaluated_at']}",
                 f"- 자동 레짐: {current['automatic_regime']}", "", "## 영역별 상태", ""]
        lines += [f"- {item['name']}: {item['state']} ({item['score']:+.2f})" for item in current["domains"]]
        lines += ["", "## 판정 사유", ""] + [f"- {reason}" for reason in current["reasons"]]
        lines += ["", "## 현재 포트폴리오", ""]
        lines += [f"- {item.get('name')}: {item.get('ticker') or item.get('asset_type')}" for item in current["portfolio"]["assets"]]
        if current["target_plan"]:
            lines += ["", f"- 목표 플랜: {current['target_plan']['plan']['name']}"]
        lines += ["", "## 공식 스냅샷 이력", ""]
        lines += [f"- {item['created_at']}: 자동 {item['automatic_regime']} / 사용자 {item.get('user_regime') or '미입력'}" for item in history]
        return "\n".join(lines) + "\n"
