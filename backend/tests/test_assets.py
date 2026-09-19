"""
자산 API 테스트 냥~ 🐱
"""
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.services.finance_service import FinanceService, get_finance_service


@pytest.mark.asyncio
async def test_get_assets(client: AsyncClient):
    """자산 목록 조회 테스트 (v0.7.0 - summary 포함 응답)"""
    response = await client.get("/api/v1/assets")
    assert response.status_code == 200
    data = response.json()
    # v0.7.0: 응답이 { assets: [...], summary: {...} } 구조로 변경됨
    assert "assets" in data
    assert "summary" in data
    assert isinstance(data["assets"], list)
    # summary 필드 검증
    summary = data["summary"]
    assert "total_value" in summary
    assert "total_principal" in summary
    assert "total_profit" in summary
    assert "profit_rate" in summary


@pytest.mark.asyncio
async def test_create_asset(client: AsyncClient):
    """자산 생성 테스트 (cleanup 보장)"""
    asset_id = None
    try:
        asset_data = {
            "name": "테스트 자산",
            "asset_type": "stock",
            "quantity": "10",
            "average_price": "50000",
            "currency": "KRW"
        }
        response = await client.post("/api/v1/assets", json=asset_data)
        assert response.status_code == 200
        data = response.json()
        asset_id = data["id"]
        assert data["name"] == "테스트 자산"
    finally:
        # 정리 - 삭제
        if asset_id:
            await client.delete(f"/api/v1/assets/{asset_id}")


@pytest.mark.asyncio
async def test_create_and_update_asset(client: AsyncClient):
    """자산 생성 및 수정 테스트 (cleanup 보장)"""
    asset_id = None
    try:
        # 생성
        asset_data = {
            "name": "수정 테스트용 자산",
            "asset_type": "stock",
            "quantity": "5",
            "average_price": "10000",
            "currency": "KRW"
        }
        create_response = await client.post("/api/v1/assets", json=asset_data)
        assert create_response.status_code == 200
        created_asset = create_response.json()
        asset_id = created_asset["id"]

        # 수정
        update_data = {
            "name": "수정된 자산 이름",
            "quantity": "15"
        }
        update_response = await client.put(f"/api/v1/assets/{asset_id}", json=update_data)
        assert update_response.status_code == 200
        updated_asset = update_response.json()
        assert updated_asset["name"] == "수정된 자산 이름"
    finally:
        # 정리 - 삭제
        if asset_id:
            await client.delete(f"/api/v1/assets/{asset_id}")


@pytest.mark.asyncio
async def test_create_and_delete_asset(client: AsyncClient):
    """자산 생성 및 삭제 테스트"""
    # 생성
    asset_data = {
        "name": "삭제 테스트용 자산",
        "asset_type": "stock",
        "quantity": "1",
        "average_price": "1000",
        "currency": "KRW"
    }
    create_response = await client.post("/api/v1/assets", json=asset_data)
    assert create_response.status_code == 200
    created_asset = create_response.json()
    asset_id = created_asset["id"]

    # 삭제
    delete_response = await client.delete(f"/api/v1/assets/{asset_id}")
    assert delete_response.status_code == 200
    delete_data = delete_response.json()
    assert delete_data["success"] is True


@pytest.mark.asyncio
async def test_create_krx_mini_gold_asset_uses_official_close(client: AsyncClient, monkeypatch):
    asset_id = None
    service = get_finance_service()
    FinanceService._price_cache.pop("M04020100", None)
    monkeypatch.setattr(
        service._krx_gold_service,
        "get_price",
        AsyncMock(return_value={
            "ticker": "M04020100",
            "current_price": 195400,
            "currency": "KRW",
            "name": "미니금 99.99_100g",
            "exchange": "KRX 금시장",
            "valid": True,
            "price_kind": "close",
            "source": "KRX Open API",
        }),
    )
    monkeypatch.setattr(service, "get_exchange_rate", AsyncMock(return_value=1300.0))

    try:
        response = await client.post("/api/v1/assets", json={
            "name": "KRX 미니금 테스트",
            "ticker": "M04020100",
            "asset_type": "gold",
            "quantity": 148,
            "average_price": 175179.25,
            "currency": "KRW",
        })

        assert response.status_code == 200
        asset = response.json()
        asset_id = asset["id"]
        assert asset["ticker"] == "M04020100"
        assert Decimal(asset["current_price"]) == Decimal("195400")
        assert Decimal(asset["market_value"]) == Decimal("28919200")
        assert asset["price_status"] == "close"
        assert asset["price_source"] == "KRX Open API"
    finally:
        FinanceService._price_cache.pop("M04020100", None)
        if asset_id:
            await client.delete(f"/api/v1/assets/{asset_id}")


@pytest.mark.asyncio
async def test_usd_asset_response_includes_return_breakdown(client: AsyncClient, monkeypatch):
    asset_id = None
    service = get_finance_service()
    monkeypatch.setattr(
        service,
        "get_stock_price",
        AsyncMock(return_value={
            "ticker": "FXSPLIT",
            "current_price": 100,
            "currency": "USD",
            "valid": True,
        }),
    )
    monkeypatch.setattr(service, "get_exchange_rate", AsyncMock(return_value=1300.0))

    try:
        response = await client.post("/api/v1/assets", json={
            "name": "환율 분해 테스트",
            "ticker": "FXSPLIT",
            "asset_type": "stock",
            "quantity": 3,
            "average_price": 80,
            "purchase_exchange_rate": 1200,
            "currency": "USD",
        })

        assert response.status_code == 200
        asset = response.json()
        asset_id = asset["id"]
        assert asset["native_profit_rate"] == 25.0
        assert asset["fx_change_rate"] == pytest.approx(8.3333333333)
        assert Decimal(asset["asset_price_effect_krw"]) == Decimal("72000")
        assert Decimal(asset["fx_effect_krw"]) == Decimal("30000")
        assert (
            Decimal(asset["asset_price_effect_krw"])
            + Decimal(asset["fx_effect_krw"])
            == Decimal(asset["profit_loss"])
        )
    finally:
        if asset_id:
            await client.delete(f"/api/v1/assets/{asset_id}")
