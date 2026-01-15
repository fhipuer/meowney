"""
자산 API 테스트 냥~ 🐱
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_assets(client: AsyncClient):
    """자산 목록 조회 테스트"""
    response = await client.get("/api/v1/assets")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_asset(client: AsyncClient):
    """자산 생성 테스트"""
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
    assert data["name"] == "테스트 자산"

    # 정리 - 삭제
    asset_id = data["id"]
    await client.delete(f"/api/v1/assets/{asset_id}")


@pytest.mark.asyncio
async def test_create_and_update_asset(client: AsyncClient):
    """자산 생성 및 수정 테스트"""
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

    # 정리 - 삭제
    delete_response = await client.delete(f"/api/v1/assets/{asset_id}")
    assert delete_response.status_code == 200


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
