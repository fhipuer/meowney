"""
Pydantic 스키마 정의 냥~ 🐱
API 요청/응답 데이터 검증
"""
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional


# ============================================
# Asset (자산) 스키마
# ============================================

class AssetBase(BaseModel):
    """자산 기본 스키마"""
    name: str = Field(..., min_length=1, max_length=100, description="자산명")
    ticker: Optional[str] = Field(None, max_length=20, description="티커 심볼")
    asset_type: str = Field(default="stock", description="자산 유형")
    category_id: Optional[UUID] = None
    quantity: Decimal = Field(default=Decimal("0"), ge=0, description="보유 수량")
    average_price: Decimal = Field(default=Decimal("0"), ge=0, description="평균 매수가")
    currency: str = Field(default="KRW", max_length=10)
    current_value: Optional[Decimal] = Field(None, description="직접 입력한 현재가치 (현금용)")
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    """자산 생성 요청"""
    portfolio_id: Optional[UUID] = None  # None이면 기본 포트폴리오 사용


class AssetUpdate(BaseModel):
    """자산 수정 요청 - 부분 업데이트 가능"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    ticker: Optional[str] = None
    asset_type: Optional[str] = None
    category_id: Optional[UUID] = None
    quantity: Optional[Decimal] = Field(None, ge=0)
    average_price: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = None
    current_value: Optional[Decimal] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class AssetResponse(AssetBase):
    """자산 응답 (현재가 포함)"""
    id: UUID
    portfolio_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # 계산된 필드 (yfinance에서 실시간 조회)
    current_price: Optional[Decimal] = Field(None, description="현재가 (실시간)")
    market_value: Optional[Decimal] = Field(None, description="평가금액")
    profit_loss: Optional[Decimal] = Field(None, description="손익금액")
    profit_rate: Optional[float] = Field(None, description="수익률 (%)")
    category_name: Optional[str] = None
    category_color: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================
# Dashboard (대시보드) 스키마
# ============================================

class CategoryAllocation(BaseModel):
    """카테고리별 배분"""
    category_id: Optional[UUID]
    category_name: str
    color: str
    market_value: Decimal
    percentage: float
    target_percentage: Optional[float] = None


class DashboardSummary(BaseModel):
    """대시보드 요약 정보"""
    total_value: Decimal = Field(..., description="총 평가액")
    total_principal: Decimal = Field(..., description="총 투자원금")
    total_profit: Decimal = Field(..., description="총 손익")
    profit_rate: float = Field(..., description="총 수익률 (%)")
    asset_count: int = Field(..., description="보유 자산 수")
    allocations: list[CategoryAllocation] = Field(default_factory=list)
    last_updated: datetime


# ============================================
# Asset History (자산 히스토리) 스키마
# ============================================

class AssetHistoryResponse(BaseModel):
    """자산 히스토리 응답"""
    id: UUID
    portfolio_id: UUID
    snapshot_date: date
    total_value: Decimal
    total_principal: Decimal
    total_profit: Decimal
    profit_rate: Optional[float]
    category_breakdown: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Rebalance (리밸런싱) 스키마
# ============================================

class RebalanceTarget(BaseModel):
    """목표 배분 설정"""
    category_id: UUID
    target_percentage: float = Field(..., ge=0, le=100)


class RebalanceSuggestion(BaseModel):
    """리밸런싱 제안"""
    category_name: str
    current_value: Decimal
    current_percentage: float
    target_percentage: float
    difference_percentage: float
    suggested_amount: Decimal  # 양수면 매수, 음수면 매도


class RebalanceResponse(BaseModel):
    """리밸런싱 계산 응답"""
    total_value: Decimal
    suggestions: list[RebalanceSuggestion]


# ============================================
# 공통 응답 스키마
# ============================================

class MeowResponse(BaseModel):
    """귀여운 API 응답 냥~ 🐱"""
    success: bool = True
    message: str = "냥~ 성공이다옹! 🐱"
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    """에러 응답 - 고양이가 화났다옹!"""
    success: bool = False
    message: str
    error_code: Optional[str] = None
    detail: Optional[str] = None
