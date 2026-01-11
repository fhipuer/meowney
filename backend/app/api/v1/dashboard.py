"""
대시보드 API 냥~ 🐱
"""
from uuid import UUID
from datetime import date, timedelta
from fastapi import APIRouter, Query
from typing import Optional

from app.api.deps import SupabaseDep
from app.models.schemas import (
    DashboardSummary,
    AssetHistoryResponse,
    RebalanceTarget,
    RebalanceResponse,
)
from app.services.asset_service import AssetService
from app.services.finance_service import FinanceService

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
):
    """
    대시보드 요약 정보 조회 냥~ 🐱
    - 총 자산가치, 수익률
    - 카테고리별 배분 비율
    """
    asset_service = AssetService(db)
    finance_service = FinanceService()

    # 자산 목록 조회
    assets = await asset_service.get_assets(portfolio_id)

    # 현재가 조회 및 계산
    enriched_assets = await finance_service.enrich_assets_with_prices(assets)

    # 요약 정보 계산
    summary = await asset_service.calculate_summary(enriched_assets, portfolio_id)

    return summary


@router.get("/history", response_model=list[AssetHistoryResponse])
async def get_asset_history(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
    start_date: Optional[date] = Query(None, description="시작일"),
    end_date: Optional[date] = Query(None, description="종료일"),
    limit: int = Query(30, ge=1, le=365, description="조회 개수"),
):
    """
    자산 히스토리 조회 냥~ 🐱
    일별 자산 추이 데이터
    """
    asset_service = AssetService(db)

    # 기본값: 최근 30일
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=limit)

    history = await asset_service.get_asset_history(
        portfolio_id, start_date, end_date, limit
    )

    return history


@router.post("/rebalance", response_model=RebalanceResponse)
async def calculate_rebalance(
    db: SupabaseDep,
    targets: list[RebalanceTarget],
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
):
    """
    리밸런싱 계산 냥~ 🐱
    목표 비율에 맞추기 위한 매수/매도 금액 계산
    """
    asset_service = AssetService(db)
    finance_service = FinanceService()

    # 현재 자산 조회
    assets = await asset_service.get_assets(portfolio_id)
    enriched_assets = await finance_service.enrich_assets_with_prices(assets)

    # 리밸런싱 계산
    result = await asset_service.calculate_rebalance(enriched_assets, targets)

    return result
