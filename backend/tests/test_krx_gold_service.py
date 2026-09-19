from datetime import date
from decimal import Decimal
from pathlib import Path
import sqlite3

import httpx
import pytest

from app.services.krx_gold_service import (
    KRX_GOLD_SOURCE,
    KrxGoldService,
    is_krx_gold_ticker,
    normalize_krx_gold_ticker,
)


def client_factory(handler):
    transport = httpx.MockTransport(handler)
    return lambda **kwargs: httpx.AsyncClient(transport=transport, **kwargs)


def test_normalizes_supported_gold_product_codes():
    assert normalize_krx_gold_ticker("M04020100") == "M04020100"
    assert normalize_krx_gold_ticker("04020100") == "M04020100"
    assert is_krx_gold_ticker("m04020000") is True
    assert normalize_krx_gold_ticker("GC=F") is None


@pytest.mark.asyncio
async def test_fetches_mini_gold_close_and_skips_weekend():
    requested_dates = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_dates.append(request.url.params["basDd"])
        assert request.headers["AUTH_KEY"] == "test-key"
        return httpx.Response(
            200,
            json={
                "OutBlock_1": [
                    {
                        "BAS_DD": "20260904",
                        "ISU_CD": "04020000",
                        "ISU_NM": "금 99.99_1kg",
                        "TDD_CLSPRC": "196,000",
                    },
                    {
                        "BAS_DD": "20260904",
                        "ISU_CD": "04020100",
                        "ISU_NM": "미니금 99.99_100g",
                        "TDD_CLSPRC": "195,400",
                    },
                ]
            },
        )

    service = KrxGoldService(
        "test-key",
        client_factory=client_factory(handler),
        today_provider=lambda: date(2026, 9, 5),  # 토요일
    )
    result = await service.get_price("M04020100")

    assert requested_dates == ["20260904"]
    assert result["valid"] is True
    assert result["ticker"] == "M04020100"
    assert result["current_price"] == Decimal("195400")
    assert result["currency"] == "KRW"
    assert result["source"] == KRX_GOLD_SOURCE
    assert result["price_kind"] == "close"
    assert result["timestamp"].isoformat() == "2026-09-04T15:30:00+09:00"


@pytest.mark.asyncio
async def test_looks_back_to_previous_business_day_when_today_has_no_rows():
    requested_dates = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_date = request.url.params["basDd"]
        requested_dates.append(requested_date)
        rows = []
        if requested_date == "20260904":
            rows = [{
                "BAS_DD": "20260904",
                "ISU_CD": "04020100",
                "ISU_NM": "미니금 99.99_100g",
                "TDD_CLSPRC": "195400",
            }]
        return httpx.Response(200, json={"OutBlock_1": rows})

    service = KrxGoldService(
        "test-key",
        client_factory=client_factory(handler),
        today_provider=lambda: date(2026, 9, 7),  # 월요일 장 시작 전
    )
    result = await service.get_price("04020100")

    assert requested_dates == ["20260907", "20260904"]
    assert result["current_price"] == Decimal("195400")


@pytest.mark.asyncio
async def test_reports_missing_service_permission_without_exposing_key():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"respCode": "401", "respMsg": "Unauthorized API Call"})

    service = KrxGoldService(
        "secret-test-key",
        client_factory=client_factory(handler),
        today_provider=lambda: date(2026, 9, 4),
    )
    result = await service.get_price("M04020100")

    assert result["valid"] is False
    assert "서비스 이용신청" in result["error"]
    assert "secret-test-key" not in result["error"]


@pytest.mark.asyncio
async def test_missing_key_fails_before_creating_http_client():
    def fail_factory(**_kwargs):
        raise AssertionError("HTTP client should not be created")

    result = await KrxGoldService(api_key="", client_factory=fail_factory).get_price("M04020100")

    assert result["valid"] is False
    assert result["error"] == "KRX_API_KEY가 설정되지 않았습니다."


def test_migration_only_links_the_confirmed_active_domestic_gold_asset():
    migration = (
        Path(__file__).resolve().parents[1]
        / "app"
        / "db"
        / "migrations"
        / "028_krx_mini_gold.sql"
    ).read_text(encoding="utf-8")
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE assets (name TEXT, ticker TEXT, asset_type TEXT, "
        "is_active INTEGER, updated_at TEXT)"
    )
    connection.executemany(
        "INSERT INTO assets(name,ticker,asset_type,is_active) VALUES (?,?,?,?)",
        [
            ("국내 금현물", None, "gold", 1),
            ("국내 금현물", None, "gold", 0),
            ("골드바", None, "gold", 1),
        ],
    )

    connection.executescript(migration)
    rows = connection.execute("SELECT name,ticker,is_active FROM assets ORDER BY rowid").fetchall()

    assert rows == [
        ("국내 금현물", "M04020100", 1),
        ("국내 금현물", None, 0),
        ("골드바", None, 1),
    ]
