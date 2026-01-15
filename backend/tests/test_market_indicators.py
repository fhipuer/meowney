"""
시장 지표 API 테스트 냥~ 🐱
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_market_indicators(client: AsyncClient):
    """시장 지표 조회 테스트 냥~"""
    response = await client.get("/api/v1/dashboard/market-indicators")
    assert response.status_code == 200

    data = response.json()
    assert "indicators" in data
    assert "timestamp" in data
    assert isinstance(data["indicators"], list)


@pytest.mark.asyncio
async def test_market_indicators_structure(client: AsyncClient):
    """시장 지표 구조 테스트 냥~"""
    response = await client.get("/api/v1/dashboard/market-indicators")
    assert response.status_code == 200

    data = response.json()
    indicators = data["indicators"]

    # 지표가 있으면 구조 확인
    if len(indicators) > 0:
        indicator = indicators[0]
        assert "ticker" in indicator
        assert "name" in indicator
        assert "price" in indicator
        assert "change_rate" in indicator
        assert "currency" in indicator


@pytest.mark.asyncio
async def test_exchange_rate_endpoint(client: AsyncClient):
    """환율 조회 테스트 냥~"""
    response = await client.get("/api/v1/dashboard/exchange-rate")
    assert response.status_code == 200

    data = response.json()
    assert "rate" in data
    assert "from_currency" in data
    assert "to_currency" in data
    assert data["from_currency"] == "USD"
    assert data["to_currency"] == "KRW"
    # 환율은 합리적인 범위 내에 있어야 함 (1000 ~ 2000)
    assert 1000 <= float(data["rate"]) <= 2000
