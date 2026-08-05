"""
리밸런싱 플랜 API 엔드포인트 냥~ 🐱
"""
from typing import Optional
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response

from app.models.schemas import (
    MeowResponse,
    RebalancePlanResponse,
    RebalancePlanCreate,
    RebalancePlanUpdate,
    PlanAllocationCreate,
    AllocationGroupCreate,
    AllocationGroupResponse,
    AssetRebalanceResponse,
)
from app.services.rebalance_service import RebalanceService
from app.services.decision_prompt_service import DecisionPromptService

router = APIRouter(prefix="/rebalance", tags=["Rebalance Plans"])


@router.get("/plans", response_model=list[RebalancePlanResponse])
async def get_plans(portfolio_id: Optional[UUID] = None):
    """리밸런싱 플랜 목록 조회 냥~"""
    service = RebalanceService()
    plans = await service.get_plans(portfolio_id)
    return plans


@router.get("/main-plan", response_model=Optional[RebalancePlanResponse])
async def get_main_plan(portfolio_id: Optional[UUID] = None):
    """메인 플랜 조회 냥~"""
    service = RebalanceService()
    plan = await service.get_main_plan(portfolio_id)
    return plan


@router.post("/plans", response_model=RebalancePlanResponse)
async def create_plan(plan: RebalancePlanCreate):
    """리밸런싱 플랜 생성 냥~"""
    service = RebalanceService()
    try:
        created_plan = await service.create_plan(plan.model_dump())
        return created_plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/plans/{plan_id}", response_model=RebalancePlanResponse)
async def get_plan(plan_id: UUID):
    """리밸런싱 플랜 상세 조회 냥~"""
    service = RebalanceService()
    plan = await service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="플랜을 찾을 수 없다옹! 🙀")
    return plan


@router.get("/plans/{plan_id}/decision-prompt")
async def download_decision_prompt(plan_id: UUID):
    """최신 평가액을 포함한 AI 의사결정 Markdown을 내려준다."""
    try:
        markdown, filename = await DecisionPromptService().export_markdown(plan_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(
        content=markdown,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.put("/plans/{plan_id}", response_model=RebalancePlanResponse)
async def update_plan(plan_id: UUID, plan: RebalancePlanUpdate):
    """리밸런싱 플랜 수정 냥~"""
    service = RebalanceService()
    try:
        updated_plan = await service.update_plan(
            plan_id, plan.model_dump(exclude_unset=True)
        )
        return updated_plan
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/plans/{plan_id}", response_model=MeowResponse)
async def delete_plan(plan_id: UUID):
    """리밸런싱 플랜 삭제 냥~"""
    service = RebalanceService()
    await service.delete_plan(plan_id)
    return MeowResponse(
        success=True, message="플랜이 삭제됐다옹! 🐱"
    )


@router.post("/plans/{plan_id}/set-main", response_model=RebalancePlanResponse)
async def set_main_plan(plan_id: UUID):
    """메인 플랜 설정 냥~"""
    service = RebalanceService()
    try:
        plan = await service.set_main_plan(plan_id)
        return plan
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/plans/{plan_id}/allocations", response_model=RebalancePlanResponse)
async def save_allocations(plan_id: UUID, allocations: list[PlanAllocationCreate]):
    """배분 설정 저장 냥~"""
    service = RebalanceService()
    plan = await service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="플랜을 찾을 수 없다옹! 🙀")

    await service.save_allocations(plan_id, [a.model_dump() for a in allocations])
    return await service.get_plan(plan_id)


@router.post("/plans/{plan_id}/calculate", response_model=AssetRebalanceResponse)
async def calculate_rebalance(plan_id: UUID, portfolio_id: Optional[UUID] = None):
    """플랜 기준 리밸런싱 계산 냥~"""
    service = RebalanceService()
    try:
        result = await service.calculate_rebalance_by_plan(plan_id, portfolio_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate-main", response_model=AssetRebalanceResponse)
async def calculate_main_plan_rebalance(portfolio_id: Optional[UUID] = None):
    """메인 플랜 기준 리밸런싱 자동 계산 냥~

    메인 플랜을 자동으로 찾아서 리밸런싱 계산을 수행합니다.
    """
    service = RebalanceService()
    main_plan = await service.get_main_plan(portfolio_id)

    if not main_plan:
        raise HTTPException(status_code=404, detail="메인 플랜이 없다옹! 🙀")

    try:
        result = await service.calculate_rebalance_by_plan(
            UUID(main_plan["id"]), portfolio_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# 배분 그룹 API 냥~
# ============================================

@router.get("/plans/{plan_id}/groups", response_model=list[AllocationGroupResponse])
async def get_groups(plan_id: UUID):
    """플랜의 배분 그룹 목록 조회 냥~"""
    service = RebalanceService()
    plan = await service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="플랜을 찾을 수 없다옹! 🙀")

    groups = await service.get_groups(plan_id)
    return groups


@router.put("/plans/{plan_id}/groups", response_model=list[AllocationGroupResponse])
async def save_groups(plan_id: UUID, groups: list[AllocationGroupCreate]):
    """배분 그룹 저장 냥~"""
    service = RebalanceService()
    plan = await service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="플랜을 찾을 수 없다옹! 🙀")

    saved_groups = await service.save_groups(plan_id, [g.model_dump() for g in groups])
    return saved_groups
