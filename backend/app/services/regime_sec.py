"""SEC EDGAR 공시를 캐시하고 하이퍼스케일러 CAPEX를 정규화한다."""

from __future__ import annotations

import json
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
            elif previous is not None:
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


def classify_ai_capex(companies: list[dict[str, Any]], expected: int = 4) -> tuple[str, str, float]:
    available = [item for item in companies if item.get("latest_capex") is not None]
    coverage = len(available) / expected
    yoy_values = [float(item["yoy"]) for item in available if item.get("yoy") is not None]
    positive = sum(value > 0 for value in yoy_values)
    negative = sum(value < 0 for value in yoy_values)
    if coverage < .75 or len(yoy_values) < 3:
        return "판정 불가", "4개사 중 3개사 이상의 최신·전년동기 분기 CAPEX가 필요합니다.", coverage
    if negative >= 2:
        return "감속 관찰", f"전년 대비 CAPEX 감소 기업이 {negative}개입니다.", coverage
    if positive >= 3 and sum(yoy_values) / len(yoy_values) >= 25:
        return "확대 가속", f"전년 대비 CAPEX 증가 기업이 {positive}개이고 평균 증가율이 25% 이상입니다.", coverage
    if positive >= 3:
        return "높은 투자 지속", f"전년 대비 CAPEX 증가 기업이 {positive}개입니다.", coverage
    return "혼조", "기업별 증가·감속 신호가 혼재해 다음 공시 확인이 필요합니다.", coverage


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
                    "SELECT * FROM company_metrics WHERE company_id=? AND metric='capex' ORDER BY period_end DESC LIMIT 12",
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
                companies.append({"id": company_id, "name": name, "latest_period": latest["period_end"] if latest else None,
                                  "latest_capex": latest["value"] if latest else None, "yoy": yoy, "ttm": ttm,
                                  "history": [{"period": row["period_end"], "value": row["value"]} for row in rows],
                                  "fetch_status": dict(status) if status else None})
        state, reason, coverage = classify_ai_capex(companies, len(COMPANIES))
        return {"state": state, "reason": reason, "coverage": coverage, "companies": companies,
                "methodology": "SEC 공시 현금 CAPEX · 누적 공시는 직전 누적값 차감 · 증가율 둔화만으로 종료 판정하지 않음"}
