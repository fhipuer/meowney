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
    purchase_exchange_rate: Optional[Decimal] = Field(None, ge=0, description="매수 시점 환율 (USD자산용)")
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
    purchase_exchange_rate: Optional[Decimal] = Field(None, ge=0)
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
    market_value: Optional[Decimal] = Field(None, description="평가금액 (KRW)")
    market_value_usd: Optional[Decimal] = Field(None, description="USD 자산의 달러 원본 금액")
    profit_loss: Optional[Decimal] = Field(None, description="손익금액")
    profit_rate: Optional[float] = Field(None, description="수익률 (%)")
    cost_basis_krw: Optional[Decimal] = Field(None, description="원화 환산 매입가 (USD자산용)")
    current_exchange_rate: Optional[Decimal] = Field(None, description="현재 환율")
    category_name: Optional[str] = None
    category_color: Optional[str] = None

    class Config:
        from_attributes = True


class AssetsSummary(BaseModel):
    """자산 목록 요약 정보 (v0.7.0) 냥~"""
    total_value: Decimal = Field(..., description="총 평가금액 (KRW)")
    total_principal: Decimal = Field(..., description="총 투자원금 (KRW)")
    total_profit: Decimal = Field(..., description="총 손익 (KRW)")
    profit_rate: float = Field(..., description="수익률 (%)")


class AssetsListResponse(BaseModel):
    """자산 목록 응답 (v0.7.0) - summary 포함 냥~"""
    assets: list[AssetResponse]
    summary: AssetsSummary


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
    # 메인 플랜 정보 냥~
    main_plan_id: Optional[UUID] = Field(None, description="메인 플랜 ID")
    main_plan_name: Optional[str] = Field(None, description="메인 플랜 이름")


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


# ============================================
# Portfolio (포트폴리오) 스키마
# ============================================

class PortfolioBase(BaseModel):
    """포트폴리오 기본 스키마"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    base_currency: str = Field(default="KRW", max_length=10)
    target_value: Optional[Decimal] = Field(None, ge=0, description="목표 자산 금액")


class PortfolioUpdate(BaseModel):
    """포트폴리오 수정 요청"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    target_value: Optional[Decimal] = Field(None, ge=0)


class PortfolioResponse(PortfolioBase):
    """포트폴리오 응답"""
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Exchange Rate (환율) 스키마
# ============================================

class ExchangeRateResponse(BaseModel):
    """환율 조회 응답 냥~"""
    rate: Decimal
    from_currency: str = "USD"
    to_currency: str = "KRW"
    timestamp: datetime


# ============================================
# Rebalance Alert (리밸런싱 알림) 스키마
# ============================================

class RebalanceAlert(BaseModel):
    """리밸런싱 알림"""
    category_name: str
    current_percentage: float
    target_percentage: float
    deviation: float  # 이탈도 (절대값)
    direction: str  # "over" 또는 "under"


class RebalanceAlertsResponse(BaseModel):
    """리밸런싱 알림 목록 응답"""
    alerts: list[RebalanceAlert]
    threshold: float
    needs_rebalancing: bool


# ============================================
# Goal Progress (목표 진행률) 스키마
# ============================================

class GoalProgressResponse(BaseModel):
    """목표 진행률 응답"""
    target_value: Decimal
    current_value: Decimal
    progress_percentage: float
    remaining_amount: Decimal
    is_achieved: bool


# ============================================
# Ticker Validation (티커 검증) 스키마
# ============================================

class TickerValidationResponse(BaseModel):
    """티커 검증 응답"""
    valid: bool
    ticker: str
    name: Optional[str] = None
    current_price: Optional[Decimal] = None
    currency: Optional[str] = None
    exchange: Optional[str] = None
    error: Optional[str] = None


# ============================================
# Rebalance Plan (리밸런싱 플랜) 스키마
# ============================================

class PlanAllocationBase(BaseModel):
    """플랜 배분 기본"""
    asset_id: Optional[UUID] = None
    ticker: Optional[str] = None
    alias: Optional[str] = None  # 티커 없는 자산용 별칭 냥~
    display_name: Optional[str] = None  # 커스텀 표시명 냥~
    target_percentage: float = Field(..., ge=0, le=100)
    absolute_band: Optional[float] = Field(None, ge=0, le=100, description="절대 밴드 (%p), None이면 전역 기본값 사용")
    relative_band: Optional[float] = Field(None, ge=0, le=200, description="상대 밴드 (%), None이면 전역 기본값 사용")


class PlanAllocationCreate(PlanAllocationBase):
    """플랜 배분 생성"""
    pass


class PlanAllocationResponse(PlanAllocationBase):
    """플랜 배분 응답"""
    id: UUID
    plan_id: UUID
    asset_name: Optional[str] = None
    matched_asset: Optional[dict] = None  # 매칭된 자산 정보 냥~
    matched_asset_name: Optional[str] = None  # 매칭된 자산명 냥~
    current_value: Optional[float] = None  # 현재 시가 냥~
    current_percentage: Optional[float] = None  # 현재 비율 냥~

    class Config:
        from_attributes = True


# ============================================
# Allocation Groups (배분 그룹) 스키마 냥~
# ============================================

class AllocationGroupItemBase(BaseModel):
    """그룹 아이템 기본 (weight 제거됨 - 단순 소속 관계만)"""
    asset_id: Optional[UUID] = None
    ticker: Optional[str] = None
    alias: Optional[str] = None
    # weight 필드 제거: 그룹 내 비중은 더 이상 사용하지 않음 냥~


class AllocationGroupItemCreate(AllocationGroupItemBase):
    """그룹 아이템 생성"""
    pass


class AllocationGroupItemResponse(AllocationGroupItemBase):
    """그룹 아이템 응답"""
    id: UUID
    matched_asset: Optional[dict] = None

    class Config:
        from_attributes = True


class AllocationGroupBase(BaseModel):
    """배분 그룹 기본"""
    name: str = Field(..., min_length=1, max_length=100)
    target_percentage: float = Field(..., ge=0, le=100)
    display_order: int = 0


class AllocationGroupCreate(AllocationGroupBase):
    """배분 그룹 생성"""
    items: list[AllocationGroupItemCreate] = []


class AllocationGroupResponse(AllocationGroupBase):
    """배분 그룹 응답"""
    id: UUID
    plan_id: UUID
    items: list[AllocationGroupItemResponse] = []
    current_value: Optional[float] = None
    current_percentage: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RebalancePlanBase(BaseModel):
    """리밸런싱 플랜 기본"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    strategy_prompt: Optional[str] = Field(None, max_length=10000, description="전략 프롬프트 (AI 조언용)")
    is_main: bool = False


class RebalancePlanCreate(RebalancePlanBase):
    """리밸런싱 플랜 생성"""
    portfolio_id: Optional[UUID] = None
    allocations: list[PlanAllocationCreate] = []


class RebalancePlanUpdate(BaseModel):
    """리밸런싱 플랜 수정"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    strategy_prompt: Optional[str] = Field(None, max_length=10000)
    is_main: Optional[bool] = None
    is_active: Optional[bool] = None


class RebalancePlanResponse(RebalancePlanBase):
    """리밸런싱 플랜 응답"""
    id: UUID
    portfolio_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    allocations: list[PlanAllocationResponse] = []
    groups: list[AllocationGroupResponse] = []  # 배분 그룹 냥~

    class Config:
        from_attributes = True


# ============================================
# Asset-based Rebalance (자산 기준 리밸런싱) 스키마
# ============================================

class AssetRebalanceSuggestion(BaseModel):
    """자산 기준 리밸런싱 제안"""
    asset_id: Optional[UUID]
    asset_name: str
    ticker: Optional[str]
    alias: Optional[str] = None  # 티커 없는 자산용 별칭 냥~
    current_value: Decimal
    current_percentage: float
    target_percentage: float
    difference_percentage: float
    suggested_amount: Decimal  # 양수면 매수, 음수면 매도
    suggested_quantity: Optional[Decimal] = None  # 매수/매도 수량
    is_matched: bool = True  # 보유 자산과 매칭 여부 냥~
    effective_band: float = 5.0
    action: str = "hold"


# ============================================
# 그룹 리밸런싱 제안 스키마 냥~
# ============================================

class GroupItemSuggestion(BaseModel):
    """그룹 아이템 정보 (단순화: 개별 목표 없음)"""
    asset_id: Optional[UUID]
    asset_name: Optional[str] = None
    ticker: Optional[str]
    alias: Optional[str]
    current_value: Decimal
    is_matched: bool = False
    # weight, target_value, suggested_amount 제거됨 - 그룹 단위 계산만 수행


class GroupRebalanceSuggestion(BaseModel):
    """그룹 리밸런싱 제안"""
    group_id: Optional[UUID]
    group_name: str
    target_percentage: float
    current_percentage: float
    current_value: Decimal
    target_value: Decimal
    suggested_amount: Decimal
    items: list[GroupItemSuggestion] = []
    effective_band: float = 5.0
    action: str = "hold"


class AssetRebalanceResponse(BaseModel):
    """자산 기준 리밸런싱 응답"""
    plan_id: UUID
    plan_name: str
    total_value: Decimal
    suggestions: list[AssetRebalanceSuggestion]
    group_suggestions: list[GroupRebalanceSuggestion] = []  # 그룹 제안 냥~


# ============================================
# Manual Asset History (과거 데이터 수동 입력) 스키마
# ============================================

class ManualHistoryEntry(BaseModel):
    """과거 데이터 수동 입력 항목"""
    snapshot_date: date
    total_value: Decimal = Field(..., ge=0, description="총 자산")
    total_principal: Decimal = Field(..., ge=0, description="투자 원금")


class ManualHistoryCreate(BaseModel):
    """과거 데이터 수동 입력 요청"""
    entries: list[ManualHistoryEntry]


class ManualHistoryResponse(BaseModel):
    """과거 데이터 조회 응답"""
    id: UUID
    portfolio_id: UUID
    snapshot_date: date
    total_value: Decimal
    total_principal: Decimal
    total_profit: Decimal
    profit_rate: Optional[float]
    is_manual: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Benchmark History (벤치마크 히스토리 - DB 기반) 스키마
# ============================================

class BenchmarkHistoryRequest(BaseModel):
    """벤치마크 히스토리 조회 요청"""
    tickers: list[str] = Field(..., description="티커 목록 (예: ['^KS11', '^GSPC', '^IXIC'])")
    period: Optional[str] = Field("1M", description="기간 (1W, 1M, 3M, 6M, 1Y)")
    start_date: Optional[date] = None
    end_date: Optional[date] = None


# ============================================
# User Settings (사용자 설정) 스키마 냥~
# ============================================

class UserSettingsBase(BaseModel):
    """사용자 설정 기본"""
    default_absolute_band: float = Field(5.0, ge=0, le=100, description="기본 절대 밴드 (%p)")
    default_relative_band: float = Field(25.0, ge=0, le=200, description="기본 상대 밴드 (%)")


class UserSettingsUpdate(BaseModel):
    """사용자 설정 수정 요청"""
    default_absolute_band: Optional[float] = Field(None, ge=0, le=100)
    default_relative_band: Optional[float] = Field(None, ge=0, le=200)


class UserSettingsResponse(UserSettingsBase):
    """사용자 설정 응답"""
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


