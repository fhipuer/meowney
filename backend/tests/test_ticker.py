"""
티커 검증 API 테스트 냥~ 🐱
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_validate_ticker_valid(client: AsyncClient):
    """유효한 티커 검증 테스트"""
    # AAPL은 보통 유효한 티커
    response = await client.get("/api/v1/assets/validate-ticker/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert "valid" in data
    assert "ticker" in data
    assert data["ticker"] == "AAPL"
    # 유효한 티커라면 이름과 현재가가 있어야 함
    if data["valid"]:
        assert data["name"] is not None
        assert data["current_price"] is not None


@pytest.mark.asyncio
async def test_validate_ticker_invalid(client: AsyncClient):
    """무효한 티커 검증 테스트"""
    # 존재하지 않는 티커
    response = await client.get("/api/v1/assets/validate-ticker/ZZZZZZZZZ123")
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert "error" in data or data.get("name") is None


@pytest.mark.asyncio
async def test_validate_ticker_korean_stock(client: AsyncClient):
    """한국 주식 티커 검증 테스트"""
    # 삼성전자 (005930.KS)
    response = await client.get("/api/v1/assets/validate-ticker/005930.KS")
    assert response.status_code == 200
    data = response.json()
    assert "valid" in data
    assert data["ticker"] == "005930.KS"


@pytest.mark.asyncio
async def test_validate_ticker_etf(client: AsyncClient):
    """ETF 티커 검증 테스트"""
    # SPY는 S&P 500 ETF
    response = await client.get("/api/v1/assets/validate-ticker/SPY")
    assert response.status_code == 200
    data = response.json()
    assert "valid" in data
    assert data["ticker"] == "SPY"


@pytest.mark.asyncio
async def test_validate_ticker_crypto(client: AsyncClient):
    """암호화폐 티커 검증 테스트"""
    # BTC-USD는 비트코인
    response = await client.get("/api/v1/assets/validate-ticker/BTC-USD")
    assert response.status_code == 200
    data = response.json()
    assert "valid" in data
    assert data["ticker"] == "BTC-USD"
