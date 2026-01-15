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


# ============================================
# 배분 그룹 테스트 냥~ 🐱
# ============================================

@pytest.mark.asyncio
async def test_get_groups_empty(client: AsyncClient):
    """빈 그룹 목록 조회 테스트"""
    # 플랜 생성
    plan_data = {"name": "그룹 테스트 플랜", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 그룹 목록 조회 (비어있어야 함)
    groups_response = await client.get(f"/api/v1/rebalance/plans/{plan_id}/groups")
    assert groups_response.status_code == 200
    groups = groups_response.json()
    assert isinstance(groups, list)
    assert len(groups) == 0

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_save_groups(client: AsyncClient):
    """그룹 저장 테스트"""
    # 플랜 생성
    plan_data = {"name": "그룹 저장 테스트 플랜", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 그룹 저장
    groups_data = [
        {
            "name": "단기채",
            "target_percentage": 30.0,
            "items": [
                {"ticker": "SGOV", "weight": 50},
                {"ticker": "SHY", "weight": 50}
            ]
        }
    ]
    save_response = await client.put(
        f"/api/v1/rebalance/plans/{plan_id}/groups",
        json=groups_data
    )
    assert save_response.status_code == 200
    saved_groups = save_response.json()
    assert len(saved_groups) == 1
    assert saved_groups[0]["name"] == "단기채"
    assert saved_groups[0]["target_percentage"] == 30.0
    assert len(saved_groups[0]["items"]) == 2

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_save_multiple_groups(client: AsyncClient):
    """다중 그룹 저장 테스트"""
    # 플랜 생성
    plan_data = {"name": "다중 그룹 테스트 플랜", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 여러 그룹 저장
    groups_data = [
        {
            "name": "단기채",
            "target_percentage": 20.0,
            "items": [{"ticker": "SGOV", "weight": 100}]
        },
        {
            "name": "배당주",
            "target_percentage": 30.0,
            "items": [
                {"ticker": "SCHD", "weight": 60},
                {"ticker": "VYM", "weight": 40}
            ]
        },
        {
            "name": "금현물",
            "target_percentage": 10.0,
            "items": [{"alias": "금현물", "weight": 100}]
        }
    ]
    save_response = await client.put(
        f"/api/v1/rebalance/plans/{plan_id}/groups",
        json=groups_data
    )
    assert save_response.status_code == 200
    saved_groups = save_response.json()
    assert len(saved_groups) == 3

    # 그룹 조회로 확인
    get_response = await client.get(f"/api/v1/rebalance/plans/{plan_id}/groups")
    assert get_response.status_code == 200
    fetched_groups = get_response.json()
    assert len(fetched_groups) == 3

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_groups_with_alias(client: AsyncClient):
    """별칭(alias)을 사용한 그룹 저장 테스트"""
    # 플랜 생성
    plan_data = {"name": "별칭 그룹 테스트 플랜", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 별칭 아이템이 포함된 그룹 저장
    groups_data = [
        {
            "name": "현금성 자산",
            "target_percentage": 15.0,
            "items": [
                {"alias": "CMA 계좌", "weight": 50},
                {"alias": "MMF", "weight": 50}
            ]
        }
    ]
    save_response = await client.put(
        f"/api/v1/rebalance/plans/{plan_id}/groups",
        json=groups_data
    )
    assert save_response.status_code == 200
    saved_groups = save_response.json()
    assert len(saved_groups) == 1
    assert saved_groups[0]["items"][0]["alias"] == "CMA 계좌"
    assert saved_groups[0]["items"][1]["alias"] == "MMF"

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_replace_groups(client: AsyncClient):
    """그룹 교체 테스트 (기존 그룹 삭제 후 새로 저장)"""
    # 플랜 생성
    plan_data = {"name": "그룹 교체 테스트 플랜", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 첫 번째 그룹 저장
    groups_data_1 = [
        {"name": "그룹A", "target_percentage": 50.0, "items": [{"ticker": "AAPL", "weight": 100}]}
    ]
    await client.put(f"/api/v1/rebalance/plans/{plan_id}/groups", json=groups_data_1)

    # 다른 그룹으로 교체
    groups_data_2 = [
        {"name": "그룹B", "target_percentage": 30.0, "items": [{"ticker": "MSFT", "weight": 100}]},
        {"name": "그룹C", "target_percentage": 20.0, "items": [{"ticker": "GOOGL", "weight": 100}]}
    ]
    save_response = await client.put(
        f"/api/v1/rebalance/plans/{plan_id}/groups",
        json=groups_data_2
    )
    assert save_response.status_code == 200
    saved_groups = save_response.json()
    assert len(saved_groups) == 2
    group_names = [g["name"] for g in saved_groups]
    assert "그룹A" not in group_names  # 기존 그룹 삭제됨
    assert "그룹B" in group_names
    assert "그룹C" in group_names

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_groups_in_plan_response(client: AsyncClient):
    """플랜 응답에 그룹 포함 확인 테스트"""
    # 플랜 생성
    plan_data = {"name": "플랜 응답 그룹 테스트", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 그룹 저장
    groups_data = [
        {"name": "테스트그룹", "target_percentage": 25.0, "items": [{"ticker": "VTI", "weight": 100}]}
    ]
    await client.put(f"/api/v1/rebalance/plans/{plan_id}/groups", json=groups_data)

    # 플랜 상세 조회 시 그룹 포함 확인
    plan_response = await client.get(f"/api/v1/rebalance/plans/{plan_id}")
    assert plan_response.status_code == 200
    plan = plan_response.json()
    assert "groups" in plan
    assert len(plan["groups"]) == 1
    assert plan["groups"][0]["name"] == "테스트그룹"

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_get_groups_nonexistent_plan(client: AsyncClient):
    """존재하지 않는 플랜의 그룹 조회 테스트"""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.get(f"/api/v1/rebalance/plans/{fake_id}/groups")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_save_groups_nonexistent_plan(client: AsyncClient):
    """존재하지 않는 플랜에 그룹 저장 테스트"""
    fake_id = "00000000-0000-0000-0000-000000000000"
    groups_data = [{"name": "테스트", "target_percentage": 10.0, "items": []}]
    response = await client.put(
        f"/api/v1/rebalance/plans/{fake_id}/groups",
        json=groups_data
    )
    assert response.status_code == 404


# ============================================
# 확장된 배분 테스트 (티커/별칭) 냥~
# ============================================

@pytest.mark.asyncio
async def test_save_allocations_with_ticker(client: AsyncClient):
    """티커 기반 배분 저장 테스트"""
    # 플랜 생성
    plan_data = {"name": "티커 배분 테스트 플랜", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 티커 기반 배분 저장
    allocations = [
        {"ticker": "AAPL", "target_percentage": 20.0, "display_name": "애플"},
        {"ticker": "MSFT", "target_percentage": 15.0, "display_name": "마이크로소프트"},
        {"ticker": "GOOGL", "target_percentage": 10.0}
    ]
    alloc_response = await client.put(
        f"/api/v1/rebalance/plans/{plan_id}/allocations",
        json=allocations
    )
    assert alloc_response.status_code == 200
    plan = alloc_response.json()
    assert len(plan["allocations"]) == 3

    # 티커 확인
    tickers = [a["ticker"] for a in plan["allocations"]]
    assert "AAPL" in tickers
    assert "MSFT" in tickers

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_save_allocations_with_alias(client: AsyncClient):
    """별칭 기반 배분 저장 테스트"""
    # 플랜 생성
    plan_data = {"name": "별칭 배분 테스트 플랜", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 별칭 기반 배분 저장
    allocations = [
        {"alias": "금현물", "target_percentage": 10.0, "display_name": "KB금현물"},
        {"alias": "CMA", "target_percentage": 5.0}
    ]
    alloc_response = await client.put(
        f"/api/v1/rebalance/plans/{plan_id}/allocations",
        json=allocations
    )
    assert alloc_response.status_code == 200
    plan = alloc_response.json()
    assert len(plan["allocations"]) == 2

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_mixed_allocations_and_groups(client: AsyncClient):
    """혼합 배분 (개별 + 그룹) 테스트"""
    # 플랜 생성
    plan_data = {"name": "혼합 배분 테스트 플랜", "is_main": False}
    create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
    assert create_response.status_code == 200
    plan_id = create_response.json()["id"]

    # 개별 배분 저장
    allocations = [
        {"ticker": "AAPL", "target_percentage": 20.0},
        {"alias": "금현물", "target_percentage": 10.0}
    ]
    await client.put(f"/api/v1/rebalance/plans/{plan_id}/allocations", json=allocations)

    # 그룹 배분 저장
    groups = [
        {
            "name": "단기채",
            "target_percentage": 30.0,
            "items": [{"ticker": "SGOV", "weight": 60}, {"ticker": "SHY", "weight": 40}]
        }
    ]
    await client.put(f"/api/v1/rebalance/plans/{plan_id}/groups", json=groups)

    # 플랜 조회로 확인
    plan_response = await client.get(f"/api/v1/rebalance/plans/{plan_id}")
    assert plan_response.status_code == 200
    plan = plan_response.json()

    # 개별 배분 2개 + 그룹 1개 확인
    assert len(plan["allocations"]) == 2
    assert len(plan["groups"]) == 1
    assert plan["groups"][0]["name"] == "단기채"

    # 정리
    await client.delete(f"/api/v1/rebalance/plans/{plan_id}")
