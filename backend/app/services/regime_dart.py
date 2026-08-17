"""OpenDART cache for Samsung Electronics and SK hynix confirmation metrics."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.services.regime_external import ExternalObservationRepository, utc_now


DART_ENDPOINT = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"
DART_GUIDE_URL = "https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020"
FEED_ID = "opendart_semiconductor"
COMPANIES = {
    "samsung": {"name": "삼성전자", "corp_code": "00126380", "ticker": "005930"},
    "sk_hynix": {"name": "SK하이닉스", "corp_code": "00164779", "ticker": "000660"},
}
REPORT_PERIODS = {
    "11013": (3, 31, "1분기"),
    "11012": (6, 30, "반기"),
    "11014": (9, 30, "3분기"),
    "11011": (12, 31, "사업보고서"),
}
ACCOUNT_MAP = {
    "inventory": ("ifrs-full_Inventories", {"BS"}),
    "capex_ytd": ("ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", {"CF"}),
    "revenue_ytd": ("ifrs-full_Revenue", {"IS", "CIS"}),
    "operating_income_ytd": ("dart_OperatingIncomeLoss", {"IS", "CIS"}),
}


def _amount(value: Any) -> float | None:
    if value in (None, "", "-"):
        return None
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return None


def parse_dart_report(
    payload: dict[str, Any], company_id: str, business_year: int, report_code: str
) -> list[dict[str, Any]]:
    """Extract only stable consolidated accounts and retain derivation inputs."""
    if payload.get("status") == "013":
        return []
    if payload.get("status") != "000":
        raise ValueError(payload.get("message") or f"OpenDART 오류 {payload.get('status')}")
    if report_code not in REPORT_PERIODS or company_id not in COMPANIES:
        return []
    month, day, report_label = REPORT_PERIODS[report_code]
    period_end = f"{business_year:04d}-{month:02d}-{day:02d}"
    rows = payload.get("list") or []
    results: list[dict[str, Any]] = []
    for metric, (account_id, statement_types) in ACCOUNT_MAP.items():
        candidates = [
            row for row in rows
            if row.get("account_id") == account_id and row.get("sj_div") in statement_types
        ]
        if not candidates:
            continue
        row = candidates[0]
        # Income-statement Q2/Q3 responses expose the single quarter in
        # thstrm_amount and the year-to-date value in thstrm_add_amount.
        # Cash-flow values are already YTD; balance-sheet inventory is a level.
        if metric in {"revenue_ytd", "operating_income_ytd"} and report_code in {"11012", "11014"}:
            value = _amount(row.get("thstrm_add_amount"))
        else:
            value = _amount(row.get("thstrm_amount"))
        if value is None:
            continue
        receipt = row.get("rcept_no")
        source_url = (
            f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={receipt}" if receipt else DART_GUIDE_URL
        )
        results.append({
            "series_id": f"kr_company_{company_id}_{metric}",
            "observation_date": period_end,
            "value": value,
            "unit": "KRW",
            "source_url": source_url,
            "dimensions": {
                "company_id": company_id, "company_name": COMPANIES[company_id]["name"],
                "corp_code": COMPANIES[company_id]["corp_code"], "ticker": COMPANIES[company_id]["ticker"],
                "business_year": business_year, "report_code": report_code,
                "report_label": report_label, "receipt_number": receipt,
                "statement": row.get("sj_div"), "account_id": account_id,
                "account_name": row.get("account_nm"), "basis": "consolidated",
                "reported_current": row.get("thstrm_amount"),
                "reported_ytd": row.get("thstrm_add_amount"),
            },
        })
    return results


def derive_quarters(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert calendar-year YTD values to stand-alone quarters."""
    by_year: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_year[int(row["observation_date"][:4])].append(row)
    result: list[dict[str, Any]] = []
    for year_rows in by_year.values():
        previous: dict[str, Any] | None = None
        for row in sorted(year_rows, key=lambda item: item["observation_date"]):
            month = int(row["observation_date"][5:7])
            if month == 3:
                value = float(row["value"])
                derivation = "reported_q1"
            elif previous is not None and int(previous["observation_date"][5:7]) == month - 3:
                value = float(row["value"]) - float(previous["value"])
                derivation = "ytd_difference"
            else:
                previous = row
                continue
            result.append({
                "period": row["observation_date"], "value": value,
                "derivation": derivation, "source_periods": (
                    [row["observation_date"]] if derivation == "reported_q1"
                    else [row["observation_date"], previous["observation_date"]]
                ),
            })
            previous = row
    return sorted(result, key=lambda item: item["period"])


def _history_value(history: list[dict[str, Any]], period: str | None) -> float | None:
    if period is None:
        return None
    row = next((item for item in history if item["period"] == period), None)
    return float(row["value"]) if row is not None else None


def _yoy(history: list[dict[str, Any]], period: str | None = None) -> float | None:
    if not history:
        return None
    latest = history[-1] if period is None else next(
        (item for item in history if item["period"] == period), None
    )
    if latest is None:
        return None
    prior_date = f"{int(latest['period'][:4]) - 1}{latest['period'][4:]}"
    prior = next((item for item in history if item["period"] == prior_date), None)
    if not prior or not prior["value"]:
        return None
    return (latest["value"] / prior["value"] - 1) * 100


def classify_company_confirmation(companies: list[dict[str, Any]]) -> tuple[str, str, float]:
    usable = [
        company for company in companies
        if company.get("revenue_yoy") is not None and company.get("inventory_yoy") is not None
        and company.get("operating_margin") is not None
        and not company.get("is_stale")
    ]
    coverage = len(usable) / len(COMPANIES)
    if len(usable) < 2:
        return "판정 불가", "삼성전자와 SK하이닉스의 최신·전년동기 공시가 모두 필요합니다.", coverage
    weakening = sum(
        company["revenue_yoy"] < -5
        or company["operating_margin"] < 0
        or (
            company.get("operating_margin_change_yoy_pp") is not None
            and company["operating_margin_change_yoy_pp"] <= -5
        )
        for company in usable
    )
    inventory_pressure = sum(
        company["inventory_yoy"] >= 20
        and company["inventory_yoy"] >= company["revenue_yoy"] + 10
        for company in usable
    )
    expansion = sum(
        company["revenue_yoy"] >= 10
        and company["operating_margin"] > 0
        and (
            company.get("operating_margin_change_yoy_pp") is None
            or company["operating_margin_change_yoy_pp"] > -5
        )
        for company in usable
    )
    if weakening >= 2:
        return "실적 둔화", "두 회사 모두 매출 감소·영업손실·이익률 급락 중 하나의 조건에 해당합니다.", coverage
    if inventory_pressure >= 2:
        return "재고 부담", "두 회사 모두 재고자산이 20% 이상 늘고 매출보다 10%p 이상 빠르게 증가했습니다.", coverage
    if expansion >= 2:
        return "확장 확인", "두 회사 모두 매출이 10% 이상 증가하고 영업흑자이며 이익률 급락 조건에 해당하지 않습니다.", coverage
    return "혼조", "매출·수익성·재고 신호가 두 회사 사이에서 엇갈립니다.", coverage


class DartSemiconductorService:
    def __init__(self) -> None:
        self.repo = ExternalObservationRepository()

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        if not settings.opendart_api_key:
            return {"status": "configuration_required", "saved": 0, "error": "OPENDART_API_KEY가 없습니다."}
        if not force and not self.repo.is_due(FEED_ID):
            return {"status": "cached", "saved": 0}
        attempted = utc_now()
        observations: list[dict[str, Any]] = []
        errors: list[str] = []
        current_year = date.today().year
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            for company_id, company in COMPANIES.items():
                for year in range(current_year - 3, current_year + 1):
                    for report_code in REPORT_PERIODS:
                        try:
                            response = await client.get(DART_ENDPOINT, params={
                                "crtfc_key": settings.opendart_api_key,
                                "corp_code": company["corp_code"], "bsns_year": str(year),
                                "reprt_code": report_code, "fs_div": "CFS",
                            })
                            response.raise_for_status()
                            observations.extend(parse_dart_report(response.json(), company_id, year, report_code))
                        except Exception as exc:
                            errors.append(f"{company['name']} {year}/{report_code}: {exc}")
        if not observations:
            message = " · ".join(errors[:4]) or "OpenDART에 유효한 연결재무제표가 없습니다."
            self.repo.save_status(FEED_ID, "opendart", "semiconductor_filings", attempted,
                                  success=False, error=message)
            return {"status": "failed", "saved": 0, "error": message}
        fetched_at = datetime.now(timezone.utc).isoformat()
        for item in observations:
            item["fetched_at"] = fetched_at
        saved = self.repo.save_observations("opendart", "semiconductor_filings", observations)
        # Isolated report failures retain the usable cache and surface partial.
        self.repo.save_status(FEED_ID, "opendart", "semiconductor_filings", attempted,
                              success=True, item_count=saved, error=" · ".join(errors[:4]) or None,
                              status="partial" if errors else "success")
        return {"status": "partial" if errors else "success", "saved": saved, "errors": errors}

    def summary(self) -> dict[str, Any]:
        companies: list[dict[str, Any]] = []
        for company_id, definition in COMPANIES.items():
            capex = derive_quarters(self.repo.series(f"kr_company_{company_id}_capex_ytd"))
            revenue = derive_quarters(self.repo.series(f"kr_company_{company_id}_revenue_ytd"))
            operating_income = derive_quarters(self.repo.series(f"kr_company_{company_id}_operating_income_ytd"))
            inventory_rows = self.repo.series(f"kr_company_{company_id}_inventory")
            inventory = [{"period": row["observation_date"], "value": row["value"]} for row in inventory_rows]
            latest_periods = [history[-1]["period"] for history in (capex, revenue, operating_income, inventory) if history]
            confirmation_periods = (
                {item["period"] for item in revenue}
                & {item["period"] for item in operating_income}
                & {item["period"] for item in inventory}
            )
            confirmation_period = max(confirmation_periods) if confirmation_periods else None
            latest_period = confirmation_period or (max(latest_periods) if latest_periods else None)
            age_days = (
                (date.today() - date.fromisoformat(confirmation_period)).days
                if confirmation_period else None
            )
            revenue_latest = _history_value(revenue, confirmation_period)
            income_latest = _history_value(operating_income, confirmation_period)
            prior_period = (
                f"{int(confirmation_period[:4]) - 1}{confirmation_period[4:]}"
                if confirmation_period else None
            )
            revenue_prior = _history_value(revenue, prior_period)
            income_prior = _history_value(operating_income, prior_period)
            operating_margin = (
                income_latest / revenue_latest * 100
                if income_latest is not None and revenue_latest else None
            )
            operating_margin_prior = (
                income_prior / revenue_prior * 100
                if income_prior is not None and revenue_prior else None
            )
            companies.append({
                "id": company_id, "name": definition["name"], "ticker": definition["ticker"],
                "latest_period": latest_period, "age_days": age_days,
                "is_stale": age_days is None or age_days > 220,
                "latest_capex": capex[-1]["value"] if capex else None,
                "capex_period": capex[-1]["period"] if capex else None,
                "capex_yoy": _yoy(capex),
                "revenue_yoy": _yoy(revenue, confirmation_period),
                "inventory_yoy": _yoy(inventory, confirmation_period),
                "operating_margin": operating_margin,
                "operating_margin_prior": operating_margin_prior,
                "operating_margin_change_yoy_pp": (
                    operating_margin - operating_margin_prior
                    if operating_margin is not None and operating_margin_prior is not None
                    else None
                ),
                "histories": {"capex": capex[-12:], "revenue": revenue[-12:],
                              "operating_income": operating_income[-12:], "inventory": inventory[-12:]},
            })
        state, reason, coverage = classify_company_confirmation(companies)
        return {
            "state": state, "reason": reason, "coverage": coverage, "companies": companies,
            "source": "OpenDART 연결재무제표 전체계정", "source_url": DART_GUIDE_URL,
            "fetch_status": self.repo.status(FEED_ID),
            "methodology": "분기 누적 CAPEX·매출·영업이익은 직전 누적값을 차감하고 재고는 분기말 절대수준을 사용",
            "limitations": "삼성전자는 전사 공시라 메모리 부문만 분리하지 않으며 HBM·NAND 출하량이나 가이던스를 직접 측정하지 않음",
        }
