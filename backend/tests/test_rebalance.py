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
    """플랜 생성 테스트 (cleanup 보장)"""
    plan_id = None
    try:
        plan_data = {
            "name": "테스트 플랜",
            "description": "테스트용 리밸런싱 플랜입니다.",
            "is_main": False
        }
        response = await client.post("/api/v1/rebalance/plans", json=plan_data)
        assert response.status_code == 200
        data = response.json()
        plan_id = data["id"]
        assert data["name"] == "테스트 플랜"
        assert data["description"] == "테스트용 리밸런싱 플랜입니다."
    finally:
        # 정리 - 삭제
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_create_and_get_plan(client: AsyncClient):
    """플랜 생성 및 상세 조회 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리 - 삭제
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_create_and_update_plan(client: AsyncClient):
    """플랜 생성 및 수정 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리 - 삭제
        if plan_id:
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
    """메인 플랜 설정 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리 - 삭제
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_save_allocations(client: AsyncClient):
    """배분 설정 저장 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리 - 삭제
        if plan_id:
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
    """빈 그룹 목록 조회 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_save_groups(client: AsyncClient):
    """그룹 저장 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_save_multiple_groups(client: AsyncClient):
    """다중 그룹 저장 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_groups_with_alias(client: AsyncClient):
    """별칭(alias)을 사용한 그룹 저장 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_replace_groups(client: AsyncClient):
    """그룹 교체 테스트 (기존 그룹 삭제 후 새로 저장, cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_groups_in_plan_response(client: AsyncClient):
    """플랜 응답에 그룹 포함 확인 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
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
    """티커 기반 배분 저장 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_save_allocations_with_alias(client: AsyncClient):
    """별칭 기반 배분 저장 테스트 (cleanup 보장)"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_mixed_allocations_and_groups(client: AsyncClient):
    """혼합 배분 (개별 + 그룹) 테스트"""
    plan_id = None
    try:
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
    finally:
        # 정리
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


# ============================================
# 메인 플랜 전환 및 대시보드 연동 테스트 냥~
# ============================================

@pytest.mark.asyncio
async def test_switch_main_plan(client: AsyncClient):
    """메인 플랜 전환 테스트 - 기존 메인 플랜이 자동 해제되는지 확인"""
    created_plans = []
    try:
        # 플랜 2개 생성
        plan1 = await client.post("/api/v1/rebalance/plans", json={"name": "플랜A", "is_main": False})
        assert plan1.status_code == 200
        created_plans.append(plan1.json()["id"])

        plan2 = await client.post("/api/v1/rebalance/plans", json={"name": "플랜B", "is_main": False})
        assert plan2.status_code == 200
        created_plans.append(plan2.json()["id"])

        # 플랜A를 메인으로 설정
        set_main_a = await client.post(f"/api/v1/rebalance/plans/{created_plans[0]}/set-main")
        assert set_main_a.status_code == 200
        assert set_main_a.json()["is_main"] is True

        # 플랜B를 메인으로 설정
        set_main_b = await client.post(f"/api/v1/rebalance/plans/{created_plans[1]}/set-main")
        assert set_main_b.status_code == 200
        assert set_main_b.json()["is_main"] is True

        # 플랜A가 is_main=false인지 확인
        plan_a = await client.get(f"/api/v1/rebalance/plans/{created_plans[0]}")
        assert plan_a.status_code == 200
        assert plan_a.json()["is_main"] is False

        # 플랜B가 is_main=true인지 확인
        plan_b = await client.get(f"/api/v1/rebalance/plans/{created_plans[1]}")
        assert plan_b.status_code == 200
        assert plan_b.json()["is_main"] is True
    finally:
        # 정리
        for plan_id in created_plans:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_main_plan_with_groups_dashboard(client: AsyncClient):
    """그룹이 있는 메인 플랜 설정 후 대시보드 API 테스트"""
    plan_id = None
    try:
        # 플랜 생성
        plan = await client.post("/api/v1/rebalance/plans", json={"name": "대시보드 테스트 플랜", "is_main": False})
        assert plan.status_code == 200
        plan_id = plan.json()["id"]

        # 그룹 추가
        groups = [{"name": "테스트그룹", "target_percentage": 50.0, "items": [{"ticker": "AAPL", "weight": 100}]}]
        groups_response = await client.put(f"/api/v1/rebalance/plans/{plan_id}/groups", json=groups)
        assert groups_response.status_code == 200

        # 메인 플랜으로 설정
        set_main = await client.post(f"/api/v1/rebalance/plans/{plan_id}/set-main")
        assert set_main.status_code == 200

        # 대시보드 API 정상 응답 확인
        summary = await client.get("/api/v1/dashboard/summary")
        assert summary.status_code == 200

        alerts = await client.get("/api/v1/dashboard/rebalance-alerts")
        assert alerts.status_code == 200
    finally:
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


# ============================================
# 그룹 계산 단순화 테스트 (weight 제거) 냥~
# ============================================

@pytest.mark.asyncio
async def test_save_groups_without_weight(client: AsyncClient):
    """weight 없이 그룹 저장 테스트 (단순화된 방식)"""
    plan_id = None
    try:
        # 플랜 생성
        plan_data = {"name": "weight 없는 그룹 테스트", "is_main": False}
        create_response = await client.post("/api/v1/rebalance/plans", json=plan_data)
        assert create_response.status_code == 200
        plan_id = create_response.json()["id"]

        # weight 없이 그룹 저장
        groups_data = [
            {
                "name": "단순 그룹",
                "target_percentage": 40.0,
                "items": [
                    {"ticker": "AAPL"},  # weight 없음
                    {"ticker": "MSFT"},  # weight 없음
                    {"alias": "금현물"}   # weight 없음
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
        assert saved_groups[0]["name"] == "단순 그룹"
        assert len(saved_groups[0]["items"]) == 3
    finally:
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


# ============================================
# 메인 플랜 자동 계산 테스트 냥~
# ============================================

@pytest.mark.asyncio
async def test_calculate_main_no_plan(client: AsyncClient):
    """메인 플랜 없을 때 자동 계산 실패 테스트"""
    # 기존 메인 플랜이 있을 수 있으므로 404 또는 성공 둘 다 가능
    response = await client.post("/api/v1/rebalance/calculate-main")
    # 메인 플랜이 없으면 404, 있으면 200
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_calculate_main_with_plan(client: AsyncClient):
    """메인 플랜 자동 계산 테스트"""
    plan_id = None
    try:
        # 플랜 생성 및 메인 설정
        plan = await client.post("/api/v1/rebalance/plans", json={
            "name": "자동 계산 테스트 플랜",
            "is_main": True  # 생성 시 메인 설정
        })
        assert plan.status_code == 200
        plan_id = plan.json()["id"]

        # 개별 배분 설정
        allocations = [{"ticker": "AAPL", "target_percentage": 50.0}]
        await client.put(f"/api/v1/rebalance/plans/{plan_id}/allocations", json=allocations)

        # 메인 플랜 자동 계산
        result = await client.post("/api/v1/rebalance/calculate-main")
        assert result.status_code == 200
        data = result.json()
        assert data["plan_name"] == "자동 계산 테스트 플랜"
        assert "suggestions" in data
        assert "total_value" in data
    finally:
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


@pytest.mark.asyncio
async def test_calculate_plan_with_groups(client: AsyncClient):
    """그룹이 있는 플랜 리밸런싱 계산 테스트"""
    plan_id = None
    try:
        # 플랜 생성
        plan = await client.post("/api/v1/rebalance/plans", json={
            "name": "그룹 계산 테스트 플랜",
            "is_main": False
        })
        assert plan.status_code == 200
        plan_id = plan.json()["id"]

        # 그룹 추가 (weight 없이)
        groups = [{
            "name": "테스트 그룹",
            "target_percentage": 30.0,
            "items": [
                {"ticker": "AAPL"},
                {"ticker": "MSFT"}
            ]
        }]
        await client.put(f"/api/v1/rebalance/plans/{plan_id}/groups", json=groups)

        # 리밸런싱 계산
        result = await client.post(f"/api/v1/rebalance/plans/{plan_id}/calculate")
        assert result.status_code == 200
        data = result.json()

        # 그룹 제안 확인
        assert "group_suggestions" in data
        if len(data["group_suggestions"]) > 0:
            group_sugg = data["group_suggestions"][0]
            assert group_sugg["group_name"] == "테스트 그룹"
            assert group_sugg["target_percentage"] == 30.0
            # 아이템에 weight 필드가 없어야 함
            for item in group_sugg["items"]:
                assert "weight" not in item or item.get("weight") is None
    finally:
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


# ============================================
# 대시보드 요약 메인 플랜 정보 테스트 냥~
# ============================================

@pytest.mark.asyncio
async def test_dashboard_summary_includes_main_plan(client: AsyncClient):
    """대시보드 요약에 메인 플랜 정보 포함 테스트"""
    plan_id = None
    try:
        # 플랜 생성 및 메인 설정
        plan = await client.post("/api/v1/rebalance/plans", json={
            "name": "대시보드 메인 플랜",
            "is_main": True
        })
        assert plan.status_code == 200
        plan_id = plan.json()["id"]

        # 대시보드 요약 조회
        summary = await client.get("/api/v1/dashboard/summary")
        assert summary.status_code == 200
        data = summary.json()

        # 메인 플랜 정보 확인
        assert "main_plan_id" in data
        assert "main_plan_name" in data
        assert data["main_plan_name"] == "대시보드 메인 플랜"
    finally:
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")


# ============================================
# 리밸런싱 알림 메인 플랜 기반 테스트 냥~
# ============================================

@pytest.mark.asyncio
async def test_rebalance_alerts_with_main_plan(client: AsyncClient):
    """메인 플랜 기반 리밸런싱 알림 테스트"""
    plan_id = None
    try:
        # 플랜 생성 및 메인 설정
        plan = await client.post("/api/v1/rebalance/plans", json={
            "name": "알림 테스트 플랜",
            "is_main": True
        })
        assert plan.status_code == 200
        plan_id = plan.json()["id"]

        # 배분 설정 (100%로 설정하여 이탈 발생 유도)
        allocations = [
            {"ticker": "AAPL", "target_percentage": 50.0},
            {"ticker": "NONEXISTENT_TICKER", "target_percentage": 50.0}  # 매칭 안 되는 티커
        ]
        await client.put(f"/api/v1/rebalance/plans/{plan_id}/allocations", json=allocations)

        # 알림 조회 (threshold=0으로 모든 이탈 표시)
        alerts = await client.get("/api/v1/dashboard/rebalance-alerts?threshold=0")
        assert alerts.status_code == 200
        data = alerts.json()

        # 알림 구조 확인
        assert "alerts" in data
        assert "threshold" in data
        assert "needs_rebalancing" in data
    finally:
        if plan_id:
            await client.delete(f"/api/v1/rebalance/plans/{plan_id}")
