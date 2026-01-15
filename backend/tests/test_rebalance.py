"""
리밸런싱 플랜 API 테스트 냥~ 🐱
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_plans(client: AsyncClient):
    """플랜 목록 조회 테스트"""
    response = await client.get("/api/v1/rebalance/plans")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_main_plan(client: AsyncClient):
    """메인 플랜 조회 테스트"""
    response = await client.get("/api/v1/rebalance/main-plan")
    assert response.status_code == 200
    # 메인 플랜이 없을 수도 있음 (null)


@pytest.mark.asyncio
async def test_create_plan(client: AsyncClient):
    """플랜 생성 테스트"""
    plan_data = {
        "name": "테스트 플랜",
        "description": "테스트용 리밸런싱 플랜입니다.",
        "is_main": False
    }
    response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "테스트 플랜"
    assert data["description"] == "테스트용 리밸런싱 플랜입니다."

    # 정리 - 삭제
    plan_id = data["id"]
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_create_and_get_plan(client: AsyncClient):
    """플랜 생성 및 상세 조회 테스트"""
    # 생성
    plan_data = {
        "name": "상세조회 테스트 플랜",
        "description": "상세 조회 테스트용",
        "is_main": False
    }
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    created_plan = create_response.json()
    plan_id = created_plan["id"]

    # 상세 조회
    get_response = await client.get(f"/api/v1/rebalance/plans/{plan_id}")
    assert get_response.status_code == 200
    plan = get_response.json()
    assert plan["name"] == "상세조회 테스트 플랜"

    # 정리 - 삭제
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_create_and_update_plan(client: AsyncClient):
    """플랜 생성 및 수정 테스트"""
    # 생성
    plan_data = {
        "name": "수정 테스트 플랜",
        "description": "수정 전 설명",
        "is_main": False
    }
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    created_plan = create_response.json()
    plan_id = created_plan["id"]

    # 수정
    update_data = {
        "name": "수정된 플랜 이름",
        "description": "수정된 설명"
    }
    update_response = await client.put(f"/api/v1/rebalance/plans/{plan_id}", json=update_data)
    assert update_response.status_code == 200
    updated_plan = update_response.json()
    assert updated_plan["name"] == "수정된 플랜 이름"
    assert updated_plan["description"] == "수정된 설명"

    # 정리 - 삭제
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_create_and_delete_plan(client: AsyncClient):
    """플랜 생성 및 삭제 테스트"""
    # 생성
    plan_data = {
        "name": "삭제 테스트 플랜",
        "is_main": False
    }
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    created_plan = create_response.json()
    plan_id = created_plan["id"]

    # 삭제
    delete_response = await client.delete(f"/api/v1/rebalance/plans/{plan_id}")
    assert delete_response.status_code == 200
    delete_data = delete_response.json()
    assert delete_data["success"] is True


@pytest.mark.asyncio
async def test_set_main_plan(client: AsyncClient):
    """메인 플랜 설정 테스트"""
    # 플랜 생성
    plan_data = {
        "name": "메인 플랜 테스트",
        "is_main": False
    }
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    created_plan = create_response.json()
    plan_id = created_plan["id"]

    # 메인 플랜으로 설정
    set_main_response = await client.post(f"/api/v1/rebalance/plans/{plan_id}/set-main")
    assert set_main_response.status_code == 200
    main_plan = set_main_response.json()
    assert main_plan["is_main"] is True

    # 정리 - 삭제
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_save_allocations(client: AsyncClient):
    """배분 설정 저장 테스트"""
    # 플랜 생성
    plan_data = {
        "name": "배분 테스트 플랜",
        "is_main": False
    }
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    created_plan = create_response.json()
    plan_id = created_plan["id"]

    # 배분 설정 저장 (빈 배분)
    allocations = []
    alloc_response = await client.put(
        f"/api/v1/rebalance/plans/{plan_id}/allocations",
        json=allocations
    )
    assert alloc_response.status_code == 200

    # 정리 - 삭제
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_get_nonexistent_plan(client: AsyncClient):
    """존재하지 않는 플랜 조회 테스트"""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.get(f"/api/v1/rebalance/plans/{fake_id}")
    assert response.status_code == 404
