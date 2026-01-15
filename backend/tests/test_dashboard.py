"""
대시보드 API 테스트 냥~ 🐱
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_dashboard_summary(client: AsyncClient):
    """대시보드 요약 조회 테스트"""
    response = await client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()

    # 필수 필드 검증
    assert "total_value" in data
    assert "total_principal" in data
    assert "total_profit" in data
    assert "profit_rate" in data
    assert "asset_count" in data
    assert "allocations" in data
    assert "last_updated" in data


@pytest.mark.asyncio
async def test_get_dashboard_history(client: AsyncClient):
    """자산 히스토리 조회 테스트"""
    response = await client.get("/api/v1/dashboard/history")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_dashboard_history_with_params(client: AsyncClient):
    """자산 히스토리 조회 테스트 (파라미터 포함)"""
    response = await client.get(
        "/api/v1/dashboard/history",
        params={"days": 7}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_portfolio(client: AsyncClient):
    """포트폴리오 정보 조회 테스트"""
    response = await client.get("/api/v1/dashboard/portfolio")
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "name" in data


@pytest.mark.asyncio
async def test_get_rebalance_alerts(client: AsyncClient):
    """리밸런싱 알림 조회 테스트"""
    response = await client.get("/api/v1/dashboard/rebalance-alerts")
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    assert "threshold" in data
    assert "needs_rebalancing" in data


@pytest.mark.asyncio
async def test_get_goal_progress(client: AsyncClient):
    """목표 진행률 조회 테스트"""
    response = await client.get("/api/v1/dashboard/goal-progress")
    assert response.status_code == 200
    data = response.json()
    assert "target_value" in data
    assert "current_value" in data
    assert "progress_percentage" in data
