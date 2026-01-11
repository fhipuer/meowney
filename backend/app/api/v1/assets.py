"""
자산 관리 API 냥~ 🐱
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.api.deps import SupabaseDep
from app.models.schemas import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    MeowResponse,
)
from app.services.asset_service import AssetService
from app.services.finance_service import FinanceService

router = APIRouter()


@router.get("", response_model=list[AssetResponse])
async def get_assets(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID (없으면 기본 포트폴리오)"),
    include_inactive: bool = Query(False, description="비활성 자산 포함 여부"),
):
    """
    자산 목록 조회 냥~ 🐱
    yfinance로 현재가를 실시간 조회하여 평가액 계산 포함
    """
    asset_service = AssetService(db)
    finance_service = FinanceService()

    # 자산 목록 조회
    assets = await asset_service.get_assets(portfolio_id, include_inactive)

    # 실시간 가격 조회 및 계산
    enriched_assets = await finance_service.enrich_assets_with_prices(assets)

    return enriched_assets


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    db: SupabaseDep,
    asset_id: UUID,
):
    """
    특정 자산 상세 조회 냥~ 🐱
    """
    asset_service = AssetService(db)
    finance_service = FinanceService()

    asset = await asset_service.get_asset(asset_id)
    if not asset:
        raise HTTPException(
            status_code=404,
            detail="냥? 그런 자산은 없다옹! 🙀"
        )

    enriched = await finance_service.enrich_assets_with_prices([asset])
    return enriched[0]


@router.post("", response_model=AssetResponse)
async def create_asset(
    db: SupabaseDep,
    asset_data: AssetCreate,
):
    """
    새 자산 추가 냥~ 🐱
    """
    asset_service = AssetService(db)
    finance_service = FinanceService()

    # 티커 유효성 검증 (있는 경우)
    if asset_data.ticker:
        is_valid = await finance_service.validate_ticker(asset_data.ticker)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"냥~ '{asset_data.ticker}'는 유효하지 않은 티커다옹! 🙀"
            )

    new_asset = await asset_service.create_asset(asset_data)
    enriched = await finance_service.enrich_assets_with_prices([new_asset])
    return enriched[0]


@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    db: SupabaseDep,
    asset_id: UUID,
    asset_data: AssetUpdate,
):
    """
    자산 정보 수정 냥~ 🐱
    """
    asset_service = AssetService(db)
    finance_service = FinanceService()

    # 티커 유효성 검증 (변경하는 경우)
    if asset_data.ticker:
        is_valid = await finance_service.validate_ticker(asset_data.ticker)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"냥~ '{asset_data.ticker}'는 유효하지 않은 티커다옹! 🙀"
            )

    updated_asset = await asset_service.update_asset(asset_id, asset_data)
    if not updated_asset:
        raise HTTPException(
            status_code=404,
            detail="냥? 수정할 자산이 없다옹! 🙀"
        )

    enriched = await finance_service.enrich_assets_with_prices([updated_asset])
    return enriched[0]


@router.delete("/{asset_id}", response_model=MeowResponse)
async def delete_asset(
    db: SupabaseDep,
    asset_id: UUID,
    hard_delete: bool = Query(False, description="True면 완전 삭제, False면 비활성화"),
):
    """
    자산 삭제 (또는 비활성화) 냥~ 🐱
    """
    asset_service = AssetService(db)

    if hard_delete:
        success = await asset_service.hard_delete_asset(asset_id)
        message = "자산이 완전히 삭제되었다옹! 🗑️"
    else:
        success = await asset_service.soft_delete_asset(asset_id)
        message = "자산이 비활성화되었다옹! 😴"

    if not success:
        raise HTTPException(
            status_code=404,
            detail="냥? 삭제할 자산이 없다옹! 🙀"
        )

    return MeowResponse(message=message)
