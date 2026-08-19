"""SEC EDGAR 공시를 캐시하고 하이퍼스케일러 CAPEX를 정규화한다."""

from __future__ import annotations

import json
from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import httpx

from app.config import settings
from app.db.database import get_database_client


SEC_BASE = "https://data.sec.gov"
COMPANIES = {
    "microsoft": ("Microsoft", "0000789019"),
    "alphabet": ("Alphabet", "0001652044"),
    "meta": ("Meta", "0001326801"),
    "amazon": ("Amazon", "0001018724"),
}
CONCEPTS = {
    "capex": ("PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"),
    "revenue": ("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues"),
    "operating_cash_flow": ("NetCashProvidedByUsedInOperatingActivities",),
    "depreciation": (
        "DepreciationDepletionAndAmortization",
        "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
    ),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days(item: dict[str, Any]) -> int | None:
    if not item.get("start") or not item.get("end"):
        return None
    return (date.fromisoformat(item["end"]) - date.fromisoformat(item["start"])).days


def normalize_quarters(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """누적 현금흐름 공시를 단일 분기 값으로 변환한다.

    동일 기간의 수정 공시는 가장 늦게 제출된 값을 사용한다. 10-Q의 약 3개월
    값은 그대로 사용하고, 누적 6/9개월 및 10-K는 직전 누적값을 차감한다.
    """
    valid = [item for item in entries if item.get("form") in {"10-Q", "10-Q/A", "10-K", "10-K/A"}
             and item.get("start") and item.get("end") and item.get("val") is not None]
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for item in valid:
        key = (item["start"], item["end"])
        if key not in latest or item.get("filed", "") >= latest[key].get("filed", ""):
            latest[key] = item
    by_start: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in latest.values():
        by_start[item["start"]].append(item)

    result = []
    for start_entries in by_start.values():
        ordered = sorted(start_entries, key=lambda row: row["end"])
        previous: dict[str, Any] | None = None
        for item in ordered:
            duration = _days(item)
            if duration is None or duration < 45:
                continue
            if duration <= 125:
                value, derivation, sources = float(item["val"]), "reported_quarter", [item["accn"]]
            elif previous is not None and _days(previous) is not None and 45 <= duration - _days(previous) <= 125:
                value = float(item["val"]) - float(previous["val"])
                derivation = "ytd_difference"
                sources = [item["accn"], previous["accn"]]
            else:
                previous = item
                continue
            result.append({
                "period_end": item["end"], "fiscal_year": item.get("fy"),
                "fiscal_period": item.get("fp"), "value": value,
                "derivation": derivation, "source_accessions": sources,
            })
            previous = item
    # 서로 다른 회계연도 시작일로 중복된 기간은 최신 공시 기반 값을 우선한다.
    deduped: dict[str, dict[str, Any]] = {}
    for item in result:
        deduped[item["period_end"]] = item
    return sorted(deduped.values(), key=lambda row: row["period_end"])


def _shift_quarter(period: str, quarters: int) -> str:
    """분기말 문자열을 실제 달력 기준으로 이동한다."""

    current = date.fromisoformat(period)
    month_index = current.year * 12 + current.month - 1 + quarters * 3
    year, month_zero = divmod(month_index, 12)
    month = month_zero + 1
    day = monthrange(year, month)[1]
    return date(year, month, day).isoformat()


def build_capex_aggregate(
    companies: list[dict[str, Any]],
    *,
    expected: int = 4,
    today: date | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """동일 분기 4개사 현금 CAPEX의 단일 집계 계약을 만든다.

    부분 합계를 실제 총액처럼 보이지 않도록 완전한 동일 분기만 값을
    제공한다. YoY·QoQ·TTM도 배열 위치가 아니라 실제 분기말 날짜로 찾는다.
    """

    today = today or date.today()
    period_values: dict[str, dict[str, float]] = defaultdict(dict)
    company_history: dict[str, dict[str, float]] = {}
    for company in companies:
        history = {
            item["period"]: float(item["value"])
            for item in company.get("history", [])
            if item.get("period") and item.get("value") is not None
        }
        company_history[company["id"]] = history
        for period, value in history.items():
            period_values[period][company["id"]] = value

    periods = sorted(period_values)
    totals = {
        period: sum(values.values())
        for period, values in period_values.items()
        if len(values) == expected
    }

    def ttm_for(period: str) -> float | None:
        required = [_shift_quarter(period, offset) for offset in (0, -1, -2, -3)]
        if any(item not in totals for item in required):
            return None
        return sum(totals[item] for item in required)

    rows: list[dict[str, Any]] = []
    for period in periods:
        value = totals.get(period)
        prior_quarter = totals.get(_shift_quarter(period, -1))
        prior_year = totals.get(_shift_quarter(period, -4))
        ttm = ttm_for(period) if value is not None else None
        prior_ttm = ttm_for(_shift_quarter(period, -4)) if ttm is not None else None
        rows.append({
            "period": period,
            "value": value,
            "value_billion": value / 1_000_000_000 if value is not None else None,
            "coverage_count": len(period_values[period]),
            "expected_count": expected,
            "complete": value is not None,
            "qoq": (value / prior_quarter - 1) * 100
            if value is not None and prior_quarter not in (None, 0) else None,
            "yoy": (value / prior_year - 1) * 100
            if value is not None and prior_year not in (None, 0) else None,
            "ttm": ttm,
            "ttm_billion": ttm / 1_000_000_000 if ttm is not None else None,
            "ttm_yoy": (ttm / prior_ttm - 1) * 100
            if ttm is not None and prior_ttm not in (None, 0) else None,
        })

    reporting_period = max(
        (company.get("latest_period") for company in companies if company.get("latest_period")),
        default=None,
    )
    current = next((row for row in rows if row["period"] == reporting_period), None)
    last_complete = next((row for row in reversed(rows) if row["complete"]), None)
    age_days = (today - date.fromisoformat(reporting_period)).days if reporting_period else None
    complete = bool(current and current["complete"])
    aggregate = {
        "latest_period": reporting_period,
        "last_complete_period": last_complete["period"] if last_complete else None,
        "latest_value": current.get("value") if current else None,
        "latest_value_billion": current.get("value_billion") if current else None,
        "qoq": current.get("qoq") if current else None,
        "yoy": current.get("yoy") if current else None,
        "ttm": current.get("ttm") if current else None,
        "ttm_billion": current.get("ttm_billion") if current else None,
        "ttm_yoy": current.get("ttm_yoy") if current else None,
        "coverage_count": current.get("coverage_count", 0) if current else 0,
        "expected_count": expected,
        "coverage": (current.get("coverage_count", 0) / expected) if current else 0,
        "complete": complete,
        "age_days": age_days,
        "is_stale": not complete or age_days is None or age_days > 200,
        "history": rows,
    }

    company_yoy: list[float] = []
    if reporting_period:
        prior_period = _shift_quarter(reporting_period, -4)
        for history in company_history.values():
            latest, prior = history.get(reporting_period), history.get(prior_period)
            if latest is not None and prior not in (None, 0):
                company_yoy.append((latest / prior - 1) * 100)
    breadth = {
        "positive_count": sum(value > 0 for value in company_yoy),
        "negative_count": sum(value < 0 for value in company_yoy),
        "comparable_count": len(company_yoy),
        "expected_count": expected,
        "company_yoy": company_yoy,
    }
    return aggregate, breadth


def classify_ai_capex(
    aggregate: dict[str, Any], breadth: dict[str, Any]
) -> tuple[str, str, float]:
    """합계 YoY를 주축, TTM과 기업 확산도를 확인축으로 판정한다."""

    coverage = float(aggregate.get("coverage") or 0)
    yoy = aggregate.get("yoy")
    ttm_yoy = aggregate.get("ttm_yoy")
    positive = int(breadth.get("positive_count") or 0)
    negative = int(breadth.get("negative_count") or 0)
    comparable = int(breadth.get("comparable_count") or 0)
    expected = int(breadth.get("expected_count") or 4)
    if (
        not aggregate.get("complete")
        or aggregate.get("is_stale")
        or coverage < 1
        or yoy is None
        or comparable < expected
    ):
        return (
            "판정 불가",
            f"동일 분기 {expected}개사 전체의 최신·전년동기 현금 CAPEX가 필요합니다.",
            coverage,
        )
    if yoy < 0 or (ttm_yoy is not None and ttm_yoy < 0) or negative >= 2:
        return (
            "감속 관찰",
            f"4사 합산 CAPEX가 전년동기 대비 {yoy:+.1f}%이고 감소 기업은 {negative}개입니다.",
            coverage,
        )
    if yoy >= 25 and (ttm_yoy is None or ttm_yoy >= 15) and positive >= 3:
        return (
            "확대 강함",
            f"4사 합산 CAPEX가 전년동기 대비 {yoy:+.1f}%이고 {positive}/{expected}개사가 증가했습니다.",
            coverage,
        )
    if yoy >= 0 and (ttm_yoy is None or ttm_yoy >= 0) and positive >= 3:
        return (
            "높은 투자 지속",
            f"4사 합산 CAPEX가 전년동기 대비 {yoy:+.1f}%이고 {positive}/{expected}개사가 증가했습니다.",
            coverage,
        )
    return "혼조", "합계 증가율과 기업별 투자 방향이 같은 신호를 주지 않습니다.", coverage


class SecCapexService:
    def __init__(self) -> None:
        self.db = get_database_client()
        self.headers = {"User-Agent": settings.sec_user_agent, "Accept-Encoding": "gzip, deflate"}

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        saved = 0
        errors: list[str] = []
        async with httpx.AsyncClient(headers=self.headers, timeout=45, follow_redirects=True) as client:
            for company_id, (company_name, cik) in COMPANIES.items():
                if not force and not self._is_due(company_id):
                    continue
                attempted = _now()
                try:
                    submissions, facts = await self._fetch_company(client, cik)
                    saved += self._save_company(company_id, company_name, cik, submissions, facts)
                    self._save_status(company_id, attempted, True, None)
                except Exception as exc:
                    message = f"{company_name}: {type(exc).__name__}: {exc}"
                    errors.append(message)
                    self._save_status(company_id, attempted, False, message[:800])
        return {"status": "partial" if errors and saved else "failed" if errors else "success",
                "saved": saved, "errors": errors, "ai_capex": self.summary()}

    def _is_due(self, company_id: str) -> bool:
        with self.db.connect() as conn:
            row = conn.execute("SELECT * FROM company_fetch_status WHERE company_id=?", (company_id,)).fetchone()
        if not row or not row["last_success_at"]:
            return True
        if row["status"] == "failed" and row["retry_after"]:
            return datetime.fromisoformat(row["retry_after"]) <= datetime.now(timezone.utc)
        return datetime.now(timezone.utc) - datetime.fromisoformat(row["last_success_at"]) >= timedelta(hours=20)

    async def _fetch_company(self, client: httpx.AsyncClient, cik: str) -> tuple[dict, dict]:
        submissions_response, facts_response = await __import__("asyncio").gather(
            client.get(f"{SEC_BASE}/submissions/CIK{cik}.json"),
            client.get(f"{SEC_BASE}/api/xbrl/companyfacts/CIK{cik}.json"),
        )
        submissions_response.raise_for_status()
        facts_response.raise_for_status()
        return submissions_response.json(), facts_response.json()

    def _save_company(self, company_id: str, company_name: str, cik: str,
                      submissions: dict, payload: dict) -> int:
        fetched_at = _now()
        recent = submissions.get("filings", {}).get("recent", {})
        filings = []
        for index, form in enumerate(recent.get("form", [])):
            if form not in {"10-Q", "10-Q/A", "10-K", "10-K/A"}:
                continue
            accn = recent["accessionNumber"][index]
            filings.append((str(uuid4()), company_id, company_name, cik, accn, form,
                            recent["filingDate"][index], recent["reportDate"][index],
                            recent["primaryDocument"][index],
                            f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accn.replace('-', '')}/{recent['primaryDocument'][index]}",
                            fetched_at))

        us_gaap = payload.get("facts", {}).get("us-gaap", {})
        fact_rows = []
        metric_entries: dict[str, list[dict[str, Any]]] = {}
        for metric, candidates in CONCEPTS.items():
            available_concepts = [candidate for candidate in candidates if candidate in us_gaap]
            concept = max(
                available_concepts,
                key=lambda candidate: max(
                    (item.get("end", "") for item in us_gaap[candidate].get("units", {}).get("USD", [])),
                    default="",
                ),
                default=None,
            )
            if not concept:
                continue
            entries = us_gaap[concept].get("units", {}).get("USD", [])
            metric_entries[metric] = entries
            for item in entries:
                if item.get("form") not in {"10-Q", "10-Q/A", "10-K", "10-K/A"} or not item.get("end"):
                    continue
                fact_rows.append((str(uuid4()), company_id, concept, "USD", float(item["val"]),
                                  item.get("start"), item["end"], item.get("fy"), item.get("fp"),
                                  item["form"], item["filed"], item["accn"], item.get("frame"),
                                  f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{item['accn'].replace('-', '')}", fetched_at))

        metric_rows = []
        for metric, entries in metric_entries.items():
            for item in normalize_quarters(entries):
                metric_rows.append((str(uuid4()), company_id, company_name, metric, item["period_end"],
                                    item.get("fiscal_year"), item.get("fiscal_period"), item["value"], "USD",
                                    item["derivation"], json.dumps(item["source_accessions"]), fetched_at))
        with self.db.connect() as conn:
            conn.executemany("INSERT INTO company_filings VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(company_id,accession_number) DO UPDATE SET fetched_at=excluded.fetched_at", filings)
            conn.executemany("INSERT INTO company_facts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(company_id,concept,accession_number,period_start,period_end) DO UPDATE SET value=excluded.value,filed_at=excluded.filed_at,fetched_at=excluded.fetched_at", fact_rows)
            conn.executemany("INSERT INTO company_metrics VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(company_id,metric,period_end) DO UPDATE SET value=excluded.value,derivation=excluded.derivation,source_accessions_json=excluded.source_accessions_json,calculated_at=excluded.calculated_at", metric_rows)
        return len(filings) + len(fact_rows) + len(metric_rows)

    def _save_status(self, company_id: str, attempted: str, success: bool, error: str | None) -> None:
        retry = None if success else (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        with self.db.connect() as conn:
            conn.execute("INSERT INTO company_fetch_status VALUES(?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET last_attempted_at=excluded.last_attempted_at,last_success_at=COALESCE(excluded.last_success_at,company_fetch_status.last_success_at),status=excluded.status,retry_after=excluded.retry_after,error=excluded.error",
                         (company_id, attempted, attempted if success else None, "success" if success else "failed", retry, error))

    def summary(self) -> dict[str, Any]:
        companies = []
        with self.db.connect() as conn:
            for company_id, (name, _cik) in COMPANIES.items():
                rows = [dict(row) for row in conn.execute(
                    "SELECT * FROM company_metrics WHERE company_id=? AND metric='capex' ORDER BY period_end DESC LIMIT 16",
                    (company_id,),
                ).fetchall()][::-1]
                status = conn.execute("SELECT * FROM company_fetch_status WHERE company_id=?", (company_id,)).fetchone()
                latest = rows[-1] if rows else None
                prior_period = None
                if latest:
                    latest_date = date.fromisoformat(latest["period_end"])
                    prior_period = latest_date.replace(year=latest_date.year - 1).isoformat()
                prior = next((row for row in rows if row["period_end"] == prior_period), None)
                yoy = ((latest["value"] / prior["value"] - 1) * 100) if latest and prior and prior["value"] else None
                ttm = sum(row["value"] for row in rows[-4:]) if len(rows) >= 4 else None
                age_days = (date.today() - date.fromisoformat(latest["period_end"])).days if latest else None
                is_stale = age_days is None or age_days > 200
                companies.append({"id": company_id, "name": name, "latest_period": latest["period_end"] if latest else None,
                                  "latest_capex": latest["value"] if latest else None, "yoy": yoy, "ttm": ttm,
                                  "age_days": age_days, "is_stale": is_stale,
                                  "history": [{"period": row["period_end"], "value": row["value"],
                                               "derivation": row["derivation"],
                                               "source_accessions": json.loads(row["source_accessions_json"])} for row in rows],
                                  "fetch_status": dict(status) if status else None})
        aggregate, breadth = build_capex_aggregate(companies, expected=len(COMPANIES))
        state, reason, coverage = classify_ai_capex(aggregate, breadth)
        periods = [item["latest_period"] for item in companies if item.get("latest_period")]
        return {"state": state, "reason": reason, "coverage": coverage, "companies": companies,
                "aggregate": aggregate, "breadth": breadth,
                "decision_as_of": aggregate.get("latest_period"),
                "as_of_range": {"from": min(periods) if periods else None, "to": max(periods) if periods else None},
                "period_alignment": "exact_period_end",
                "methodology": "SEC 공시 4사 전체 현금 CAPEX · 동일 분기 완전 집계의 합계 YoY가 주판정 · 합산 TTM과 증가 기업 수는 확인축 · 누적 공시는 직전 누적값 차감 · AI 전용 금액이나 비현금 리스는 분리하지 않음"}
