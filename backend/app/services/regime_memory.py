"""TrendForce 공개 가격표에서 DRAM·NAND 가격 표본을 저빈도로 수집한다."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import httpx
from bs4 import BeautifulSoup

from app.db.database import get_database_client


SOURCE_URL = "https://www.trendforce.com/price/dram/module_spot"
NAND_SOURCE_URL = "https://www.trendforce.com/price/flash/pcc_oem_ssd_contract"
SERIES = {
    ("spot", "DDR5 16Gb (2Gx8) 4800/5600"): "dram_spot_ddr5_16gb",
    ("spot", "DDR5 16Gb (2Gx8) eTT"): "dram_spot_ddr5_16gb_ett",
    ("spot", "DDR4 16Gb (2Gx8) 3200"): "dram_spot_ddr4_16gb",
    ("contract", "DDR5 8GB SO-DIMM"): "dram_contract_ddr5_sodimm_8gb",
    ("contract", "DDR4 16Gb 2Gx8"): "dram_contract_ddr4_16gb",
    ("module_spot", "DDR5 RDIMM 32GB 4800/5600"): "dram_module_spot_ddr5_rdimm_32gb",
}
NAND_SERIES = {
    ("nand_wafer_spot", "512Gb TLC"): "nand_wafer_spot_512gb_tlc",
    ("nand_wafer_spot", "256Gb TLC"): "nand_wafer_spot_256gb_tlc",
    ("nand_client_ssd_contract", "1TB-mSATA/M.2 TLC PCIe-Value Grade"): "nand_client_ssd_contract_1tb",
    ("nand_client_ssd_contract", "512GB-mSATA/M.2 TLC PCIe-Value Grade"): "nand_client_ssd_contract_512gb",
}
MEMORY_MAX_AGE_DAYS = {
    "spot": 14,
    "module_spot": 14,
    "contract": 75,
    "nand_wafer_spot": 14,
    "nand_client_ssd_contract": 150,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _number(value: str) -> float | None:
    match = re.search(r"-?\d[\d,]*(?:\.\d+)?", value.replace("−", "-"))
    return float(match.group(0).replace(",", "")) if match else None


def _change(value: str) -> float | None:
    number = _number(value)
    if number is None:
        return None
    return -abs(number) if "▼" in value or "-" in value else number


def parse_memory_price_page(html: str) -> list[dict[str, Any]]:
    """제품명과 열 이름을 함께 검증해 공개 가격표를 구조화한다."""
    soup = BeautifulSoup(html, "html.parser")
    observations: list[dict[str, Any]] = []
    for title in soup.select(".price-title"):
        title_text = title.get_text(" ", strip=True)
        if title_text.startswith("DRAM Spot Price"):
            market_type = "spot"
        elif title_text.startswith("DRAM Contract Price"):
            market_type = "contract"
        elif title_text.startswith("Module Spot Price"):
            market_type = "module_spot"
        else:
            continue
        container = title.find_next("div", class_="table-container")
        update = title.find_next("div", class_="price-last-update")
        if not container or not update:
            continue
        date_match = re.search(r"(20\d{2}-\d{2}-\d{2})", update.get_text(" ", strip=True))
        table = container.find("table")
        if not table or not date_match:
            continue
        headers = [cell.get_text(" ", strip=True) for cell in table.select("thead th")]
        required = {"Item", "Session High", "Session Low", "Session Average"}
        change_header = next(
            (candidate for candidate in (
                "Average Change" if market_type in {"contract", "module_spot"} else "Session Change",
                "Session Change",
                "Average Change",
            ) if candidate in headers),
            None,
        )
        if not required.issubset(headers) or not change_header:
            continue
        indices = {name: headers.index(name) for name in (*required, change_header)}
        period = None
        period_match = re.search(r"\(([^)]+)\)", title_text)
        if period_match:
            period = period_match.group(1)
        for row in table.select("tbody tr"):
            cells = [cell.get_text(" ", strip=True) for cell in row.find_all("td", recursive=False)]
            if not cells:
                continue
            product = cells[indices["Item"]]
            series_id = SERIES.get((market_type, product))
            if not series_id:
                continue
            average = _number(cells[indices["Session Average"]])
            if average is None or average <= 0:
                continue
            observations.append({
                "series_id": series_id,
                "market_type": market_type,
                "product_name": product,
                "observation_date": date_match.group(1),
                "period_label": period,
                "price_high": _number(cells[indices["Session High"]]),
                "price_low": _number(cells[indices["Session Low"]]),
                "price_average": average,
                "change_percent": _change(cells[indices[change_header]]),
            })
    return observations


def parse_nand_price_page(html: str) -> list[dict[str, Any]]:
    """대표성이 비교적 높은 TLC wafer spot과 client SSD 계약가격만 읽는다."""
    soup = BeautifulSoup(html, "html.parser")
    observations: list[dict[str, Any]] = []
    for title in soup.select(".price-title"):
        title_text = title.get_text(" ", strip=True)
        if title_text.startswith("Wafer Spot Price"):
            market_type = "nand_wafer_spot"
            required = ("Item", "Session High", "Session Low", "Session Average", "Session Change")
        elif title_text.startswith("PC-Client OEM SSD Contract Price"):
            market_type = "nand_client_ssd_contract"
            required = ("Item", "High", "Low", "Average")
        else:
            continue
        container = title.find_next("div", class_="table-container")
        update = title.find_next("div", class_="price-last-update")
        if not container or not update:
            continue
        date_match = re.search(r"(20\d{2}-\d{2}-\d{2})", update.get_text(" ", strip=True))
        table = container.find("table")
        if not table or not date_match:
            continue
        headers = [cell.get_text(" ", strip=True) for cell in table.select("thead th")]
        if not set(required).issubset(headers):
            continue
        indices = {name: headers.index(name) for name in required}
        period_match = re.search(r"\(([^)]+)\)", title_text)
        for row in table.select("tbody tr"):
            cells = [cell.get_text(" ", strip=True) for cell in row.find_all("td", recursive=False)]
            if not cells:
                continue
            product = cells[indices["Item"]]
            series_id = NAND_SERIES.get((market_type, product))
            if not series_id:
                continue
            average_key = "Session Average" if market_type == "nand_wafer_spot" else "Average"
            average = _number(cells[indices[average_key]])
            if average is None or average <= 0:
                continue
            high_key = "Session High" if market_type == "nand_wafer_spot" else "High"
            low_key = "Session Low" if market_type == "nand_wafer_spot" else "Low"
            observations.append({
                "series_id": series_id, "market_type": market_type, "product_name": product,
                "observation_date": date_match.group(1),
                "period_label": period_match.group(1) if period_match else None,
                "price_high": _number(cells[indices[high_key]]),
                "price_low": _number(cells[indices[low_key]]), "price_average": average,
                "change_percent": _change(cells[indices["Session Change"]])
                if market_type == "nand_wafer_spot" else None,
                "source_url": NAND_SOURCE_URL,
            })
    return observations


def classify_memory_cycle(latest: list[dict[str, Any]]) -> tuple[str, str]:
    by_id = {item["series_id"]: item for item in latest if not item.get("is_stale", False)}
    contract = by_id.get("dram_contract_ddr5_sodimm_8gb")
    spot = by_id.get("dram_spot_ddr5_16gb")
    if not contract:
        return "판정 불가", "공개 DDR5 월간 Contract 가격이 없습니다."
    contract_change = contract.get("change_percent")
    spot_change = spot.get("change_percent") if spot else None
    if contract_change is None:
        return "판정 제한", "DDR5 Contract 전월 변화율을 확인하지 못했습니다."
    if contract_change >= 5:
        return "가격 확장", f"DDR5 Contract가 공개 표 비교 기준 {contract_change:+.1f}% 상승했습니다."
    if contract_change > 0:
        return "가격 상승", f"DDR5 Contract가 공개 표 비교 기준 {contract_change:+.1f}% 상승했습니다."
    if contract_change < 0 and spot_change is not None and spot_change < 0:
        return "하락 관찰", "DDR5 Contract와 Spot이 함께 하락했습니다."
    if contract_change < 0:
        return "혼조", "DDR5 Contract는 하락했지만 Spot 확인이 더 필요합니다."
    return "가격 유지", "DDR5 Contract 전월 변화가 없으며 다음 월간 발표를 기다립니다."


def classify_nand_prices(latest: list[dict[str, Any]]) -> tuple[str, str]:
    primary = next((item for item in latest if item["series_id"] == "nand_wafer_spot_512gb_tlc" and not item.get("is_stale", False)), None)
    if not primary:
        return "판정 불가", "512Gb TLC wafer spot 가격이 없습니다."
    change = primary.get("change_percent")
    if change is None:
        return "판정 제한", "512Gb TLC wafer spot 변화율을 확인하지 못했습니다."
    if change >= 5:
        return "관측가격 큰 폭 상승", f"512Gb TLC wafer spot이 최근 세션 대비 {change:+.1f}% 상승했습니다."
    if change > 0:
        return "관측가격 상승", f"512Gb TLC wafer spot이 최근 세션 대비 {change:+.1f}% 상승했습니다."
    if change < 0:
        return "관측가격 하락", f"512Gb TLC wafer spot이 최근 세션 대비 {change:+.1f}% 하락했습니다."
    return "관측가격 변화 미미", "512Gb TLC wafer spot의 최근 세션 변화가 없습니다."


class MemoryPriceService:
    def __init__(self) -> None:
        self.db = get_database_client()

    def _is_due(self) -> bool:
        with self.db.connect() as conn:
            row = conn.execute("SELECT * FROM memory_price_fetch_status WHERE source='trendforce_public'").fetchone()
        if not row or not row["last_success_at"]:
            return True
        if row["status"] == "failed":
            return datetime.now(timezone.utc) - datetime.fromisoformat(row["last_attempted_at"]) >= timedelta(hours=1)
        return datetime.now(timezone.utc) - datetime.fromisoformat(row["last_success_at"]) >= timedelta(hours=20)

    async def refresh(self, force: bool = False) -> dict[str, Any]:
        if not force and not self._is_due():
            return {"status": "cached", "saved": 0, "memory_cycle": self.summary()}
        attempted = _now()
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True,
                                         headers={"User-Agent": "Meowney personal portfolio monitor/1.0"}) as client:
                dram_response, nand_response = await client.get(SOURCE_URL), await client.get(NAND_SOURCE_URL)
                dram_response.raise_for_status()
                nand_response.raise_for_status()
            items = parse_memory_price_page(dram_response.text) + parse_nand_price_page(nand_response.text)
            required_ids = {"dram_spot_ddr5_16gb", "dram_contract_ddr5_sodimm_8gb", "nand_wafer_spot_512gb_tlc"}
            if not required_ids.issubset({item["series_id"] for item in items}):
                raise ValueError("필수 DDR5 Spot/Contract 표 구조가 변경됐습니다")
            fetched_at = _now()
            raw_hash = hashlib.sha256(dram_response.content + nand_response.content).hexdigest()
            with self.db.connect() as conn:
                conn.executemany(
                    "INSERT INTO memory_price_observations(id,series_id,market_type,product_name,observation_date,"
                    "period_label,price_high,price_low,price_average,change_percent,source_url,fetched_at,raw_hash) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(series_id,observation_date) DO UPDATE SET "
                    "product_name=excluded.product_name,period_label=excluded.period_label,price_high=excluded.price_high,"
                    "price_low=excluded.price_low,price_average=excluded.price_average,change_percent=excluded.change_percent,"
                    "fetched_at=excluded.fetched_at,raw_hash=excluded.raw_hash",
                    [(str(uuid4()), item["series_id"], item["market_type"], item["product_name"],
                      item["observation_date"], item["period_label"], item["price_high"], item["price_low"],
                      item["price_average"], item["change_percent"], item.get("source_url", SOURCE_URL), fetched_at, raw_hash) for item in items],
                )
                conn.execute(
                    "INSERT INTO memory_price_fetch_status VALUES('trendforce_public',?,?, 'success',?,NULL) "
                    "ON CONFLICT(source) DO UPDATE SET last_attempted_at=excluded.last_attempted_at,"
                    "last_success_at=excluded.last_success_at,status='success',observation_count=excluded.observation_count,error=NULL",
                    (attempted, fetched_at, len(items)),
                )
            return {"status": "success", "saved": len(items), "memory_cycle": self.summary()}
        except Exception as exc:
            with self.db.connect() as conn:
                conn.execute(
                    "INSERT INTO memory_price_fetch_status VALUES('trendforce_public',?,NULL,'failed',0,?) "
                    "ON CONFLICT(source) DO UPDATE SET last_attempted_at=excluded.last_attempted_at,status='failed',error=excluded.error",
                    (attempted, str(exc)[:800]),
                )
            return {"status": "failed", "saved": 0, "error": str(exc), "memory_cycle": self.summary()}

    def summary(self) -> dict[str, Any]:
        with self.db.connect() as conn:
            latest = [dict(row) for row in conn.execute(
                "SELECT p.* FROM memory_price_observations p JOIN (SELECT series_id,MAX(observation_date) date "
                "FROM memory_price_observations GROUP BY series_id) x ON x.series_id=p.series_id AND x.date=p.observation_date "
                "ORDER BY p.market_type,p.series_id"
            ).fetchall()]
            status = conn.execute("SELECT * FROM memory_price_fetch_status WHERE source='trendforce_public'").fetchone()
            histories = {}
            for item in latest:
                histories[item["series_id"]] = [dict(row) for row in conn.execute(
                    "SELECT observation_date,price_average,change_percent FROM memory_price_observations "
                    "WHERE series_id=? ORDER BY observation_date DESC LIMIT 24", (item["series_id"],)
                ).fetchall()][::-1]
        for item in latest:
            age_days = max(0, (datetime.now(timezone.utc).date() - datetime.fromisoformat(item["observation_date"]).date()).days)
            item["age_days"] = age_days
            item["max_age_days"] = MEMORY_MAX_AGE_DAYS.get(item["market_type"], 75)
            item["is_stale"] = age_days > item["max_age_days"]
            item["currency"] = "USD"
            item["price_basis"] = "TrendForce 공개 표기 평균"
            item["history"] = histories[item["series_id"]]
        state, reason = classify_memory_cycle(latest)
        nand_state, nand_reason = classify_nand_prices(latest)
        primary_dram = next(
            (
                item for item in latest
                if item["series_id"] == "dram_contract_ddr5_sodimm_8gb"
                and not item.get("is_stale", False)
            ),
            None,
        )
        return {"state": state, "reason": reason, "nand_state": nand_state, "nand_reason": nand_reason,
                "decision_as_of": primary_dram.get("observation_date") if primary_dram else None,
                "source": "TrendForce 공개 가격표",
                "source_url": SOURCE_URL, "series": latest, "fetch_status": dict(status) if status else None,
                "nand_source_url": NAND_SOURCE_URL,
                "limitations": "공개 최신값을 자체 축적하며 HBM·Server DRAM·Enterprise SSD 계약가격을 직접 대체하지 않음"}
