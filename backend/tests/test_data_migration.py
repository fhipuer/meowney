"""
데이터 마이그레이션 API 테스트 냥~ 🐱
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_export_data(client: AsyncClient):
    """데이터 내보내기 테스트 냥~"""
    response = await client.get("/api/v1/data/export")
    assert response.status_code == 200

    data = response.json()
    # 스키마 버전 확인
    assert "schema_version" in data
    assert data["schema_version"].startswith("1.")
    # 필수 필드 확인
    assert "export_date" in data
    assert "portfolios" in data
    assert "assets" in data
    assert "rebalance_plans" in data
    assert "plan_allocations" in data


@pytest.mark.asyncio
async def test_get_schema_info(client: AsyncClient):
    """스키마 정보 조회 테스트 냥~"""
    response = await client.get("/api/v1/data/schema-info")
    assert response.status_code == 200

    data = response.json()
    assert "current_version" in data
    assert "supported_versions" in data
    assert "fields" in data
    # 지원 버전 목록에 현재 버전 포함 확인
    assert data["current_version"] in data["supported_versions"]


@pytest.mark.asyncio
async def test_import_invalid_schema(client: AsyncClient):
    """잘못된 스키마 가져오기 테스트 냥~"""
    invalid_data = {
        "data": {
            "schema_version": "0.0.0",  # 지원하지 않는 버전
            "portfolios": [],
            "assets": []
        }
    }
    response = await client.post("/api/v1/data/import", json=invalid_data)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_import_missing_schema(client: AsyncClient):
    """스키마 버전 누락 가져오기 테스트 냥~"""
    invalid_data = {
        "data": {
            "portfolios": [],
            "assets": []
        }
    }
    response = await client.post("/api/v1/data/import", json=invalid_data)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_export_import_roundtrip(client: AsyncClient):
    """내보내기 -> 가져오기 라운드트립 테스트 냥~"""
    # 1. 현재 데이터 내보내기
    export_response = await client.get("/api/v1/data/export")
    assert export_response.status_code == 200
    exported_data = export_response.json()

    # 2. 내보낸 데이터 다시 가져오기 (merge 모드)
    import_response = await client.post("/api/v1/data/import", json={
        "data": exported_data,
        "merge_strategy": "merge"
    })
    # 디버깅: 에러 응답 출력
    if import_response.status_code != 200:
        print(f"Import failed: {import_response.status_code}")
        print(f"Response: {import_response.text}")
    # 성공 또는 빈 데이터의 경우 200
    assert import_response.status_code == 200

    data = import_response.json()
    assert data["success"] == True
    assert "stats" in data
