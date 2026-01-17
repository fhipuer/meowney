// Meowney 타입 정의 냥~ 🐱

// 자산 카테고리
export interface AssetCategory {
  id: string
  name: string
  color: string
  icon: string
  display_order: number
}

// 자산 기본 정보
export interface Asset {
  id: string
  portfolio_id: string
  category_id: string | null
  name: string
  ticker: string | null
  asset_type: string
  quantity: number
  average_price: number
  currency: string
  current_value: number | null
  purchase_exchange_rate: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // 계산된 필드 (API에서 반환)
  current_price: number | null
  market_value: number | null
  profit_loss: number | null
  profit_rate: number | null
  cost_basis_krw: number | null
  current_exchange_rate: number | null
  category_name: string | null
  category_color: string | null
}

// 자산 생성 요청
export interface AssetCreate {
  name: string
  ticker?: string
  asset_type: string
  category_id?: string
  quantity: number
  average_price: number
  currency?: string
  current_value?: number
  purchase_exchange_rate?: number
  notes?: string
  portfolio_id?: string
}

// 자산 수정 요청
export interface AssetUpdate {
  name?: string
  ticker?: string
  asset_type?: string
  category_id?: string
  quantity?: number
  average_price?: number
  currency?: string
  current_value?: number
  purchase_exchange_rate?: number
  notes?: string
  is_active?: boolean
}

// 카테고리별 배분
export interface CategoryAllocation {
  category_id: string | null
  category_name: string
  color: string
  market_value: number
  percentage: number
  target_percentage?: number
}

// 대시보드 요약
export interface DashboardSummary {
  total_value: number
  total_principal: number
  total_profit: number
  profit_rate: number
  asset_count: number
  allocations: CategoryAllocation[]
  last_updated: string
  // 메인 플랜 정보 냥~
  main_plan_id?: string
  main_plan_name?: string
}

// 자산 히스토리
export interface AssetHistory {
  id: string
  portfolio_id: string
  snapshot_date: string
  total_value: number
  total_principal: number
  total_profit: number
  profit_rate: number | null
  category_breakdown: Record<string, number> | null
  created_at: string
}

// 리밸런싱 목표
export interface RebalanceTarget {
  category_id: string
  target_percentage: number
}

// 리밸런싱 제안
export interface RebalanceSuggestion {
  category_name: string
  current_value: number
  current_percentage: number
  target_percentage: number
  difference_percentage: number
  suggested_amount: number
}

// 리밸런싱 응답
export interface RebalanceResponse {
  total_value: number
  suggestions: RebalanceSuggestion[]
}

// API 공통 응답
export interface MeowResponse {
  success: boolean
  message: string
  data?: Record<string, unknown>
}

// 환율 응답
export interface ExchangeRateResponse {
  rate: number
  from_currency: string
  to_currency: string
  timestamp: string
}

// 벤치마크 데이터 포인트
export interface BenchmarkDataPoint {
  date: string
  close: number
  return_rate: number | null
}

// 벤치마크 응답
export interface BenchmarkResponse {
  ticker: string
  name: string
  data: BenchmarkDataPoint[]
}

// 기간별 수익률
export interface PeriodReturn {
  period: string
  return_rate: number | null
  start_value: number | null
  end_value: number | null
}

// 성과 지표
export interface PerformanceMetrics {
  period_returns: PeriodReturn[]
  max_drawdown: number | null
  max_drawdown_period: string | null
  current_drawdown: number | null
}

// 리밸런싱 알림
export interface RebalanceAlert {
  category_name: string
  current_percentage: number
  target_percentage: number
  deviation: number
  direction: 'over' | 'under'
}

// 리밸런싱 알림 응답
export interface RebalanceAlertsResponse {
  alerts: RebalanceAlert[]
  threshold: number
  needs_rebalancing: boolean
}

// 목표 진행률
export interface GoalProgressResponse {
  target_value: number
  current_value: number
  progress_percentage: number
  remaining_amount: number
  is_achieved: boolean
}

// 포트폴리오
export interface Portfolio {
  id: string
  name: string
  description: string | null
  base_currency: string
  target_value: number | null
  created_at: string
  updated_at: string
}

// 티커 검증 응답
export interface TickerValidation {
  valid: boolean
  ticker: string
  name: string | null
  current_price: number | null
  currency: string | null
  exchange: string | null
  error: string | null
}

// ============================================
// 리밸런싱 플랜 관련 타입
// ============================================

// 플랜 배분 설정
export interface PlanAllocation {
  id: string
  plan_id: string
  asset_id: string | null
  ticker: string | null
  alias: string | null  // 티커 없는 자산용 별칭 냥~
  display_name: string | null  // 커스텀 표시명 냥~
  target_percentage: number
  asset_name?: string
  matched_asset?: Asset  // 매칭된 자산 정보 냥~
  current_percentage?: number
  created_at: string
  updated_at: string
}

// 배분 그룹 아이템 냥~ (weight 제거됨 - 단순 소속 관계만)
export interface AllocationGroupItem {
  id?: string
  asset_id?: string
  ticker?: string
  alias?: string
  matched_asset?: Asset
  // weight 필드 제거: 그룹 내 비중은 더 이상 사용하지 않음
}

// 배분 그룹 냥~
export interface AllocationGroup {
  id?: string
  plan_id?: string
  name: string
  target_percentage: number
  display_order?: number
  items: AllocationGroupItem[]
  current_value?: number
  current_percentage?: number
  created_at?: string
  updated_at?: string
}

// 리밸런싱 플랜
export interface RebalancePlan {
  id: string
  portfolio_id: string
  name: string
  description: string | null
  strategy_prompt: string | null
  is_main: boolean
  is_active: boolean
  allocations: PlanAllocation[]
  groups: AllocationGroup[]  // 배분 그룹 냥~
  created_at: string
  updated_at: string
}

// 플랜 생성 요청
export interface RebalancePlanCreate {
  name: string
  description?: string
  strategy_prompt?: string
  is_main?: boolean
  portfolio_id?: string
  allocations?: PlanAllocationCreate[]
}

// 플랜 수정 요청
export interface RebalancePlanUpdate {
  name?: string
  description?: string
  strategy_prompt?: string
  is_main?: boolean
  is_active?: boolean
}

// 배분 생성 요청
export interface PlanAllocationCreate {
  asset_id?: string
  ticker?: string
  alias?: string  // 티커 없는 자산용 별칭 냥~
  display_name?: string  // 커스텀 표시명 냥~
  target_percentage: number
}

// 그룹 아이템 생성 요청 (weight 제거됨)
export interface AllocationGroupItemCreate {
  asset_id?: string
  ticker?: string
  alias?: string
  // weight 필드 제거: 그룹 내 비중은 더 이상 사용하지 않음
}

// 그룹 생성 요청
export interface AllocationGroupCreate {
  name: string
  target_percentage: number
  display_order?: number
  items?: AllocationGroupItemCreate[]
}

// 자산 기준 리밸런싱 제안
export interface AssetRebalanceSuggestion {
  asset_id: string | null
  asset_name: string
  ticker: string | null
  alias: string | null  // 티커 없는 자산용 별칭 냥~
  current_value: number
  current_percentage: number
  target_percentage: number
  difference_percentage: number
  suggested_amount: number
  suggested_quantity: number | null
  is_matched: boolean  // 보유 자산과 매칭 여부 냥~
}

// 그룹 아이템 정보 (단순화: 개별 목표 없음)
export interface GroupItemSuggestion {
  asset_id: string | null
  asset_name?: string | null
  ticker: string | null
  alias: string | null
  current_value: number
  is_matched: boolean
  // weight, target_value, suggested_amount 제거됨 - 그룹 단위 계산만 수행
}

// 그룹 리밸런싱 제안
export interface GroupRebalanceSuggestion {
  group_id: string | null
  group_name: string
  target_percentage: number
  current_percentage: number
  current_value: number
  target_value: number
  suggested_amount: number
  items: GroupItemSuggestion[]
}

// 자산 기준 리밸런싱 응답
export interface AssetRebalanceResponse {
  plan_id: string
  plan_name: string
  total_value: number
  suggestions: AssetRebalanceSuggestion[]
  group_suggestions: GroupRebalanceSuggestion[]  // 그룹 제안 냥~
}

// 티커 히스토리 (Sparkline용)
export interface TickerHistoryPoint {
  date: string
  close: number
}

export interface TickerHistoryResponse {
  ticker: string
  data: TickerHistoryPoint[]
  change_rate: number
}

// ============================================
// 데이터 마이그레이션 타입 냥~
// ============================================

// 내보내기 데이터 구조
export interface ExportData {
  schema_version: string
  export_date: string
  portfolios: ExportPortfolio[]
  assets: ExportAsset[]
  rebalance_plans: ExportPlan[]
  plan_allocations: ExportAllocation[]
}

export interface ExportPortfolio {
  name: string
  description: string | null
  base_currency: string
  target_value: number | null
}

export interface ExportAsset {
  name: string
  ticker: string | null
  asset_type: string
  quantity: number
  average_price: number
  currency: string
  current_value: number | null
  purchase_exchange_rate: number | null
  notes: string | null
  is_active: boolean
  _portfolio_name: string | null
}

export interface ExportPlan {
  name: string
  description: string | null
  strategy_prompt: string | null
  is_main: boolean
  is_active: boolean
  _portfolio_name: string | null
}

export interface ExportAllocation {
  ticker: string | null
  target_percentage: number
  _plan_name: string | null
}

// 가져오기 응답
export interface ImportResponse {
  success: boolean
  message: string
  stats: {
    portfolios_created: number
    assets_created: number
    plans_created: number
    allocations_created: number
  }
}

// 스키마 정보
export interface SchemaInfo {
  current_version: string
  supported_versions: string[]
  fields: Record<string, string[]>
}

// ============================================
// 시장 지표 타입 냥~
// ============================================

export interface MarketIndicator {
  ticker: string
  name: string
  price: number
  change_rate: number
  currency: string
}

export interface MarketIndicatorsResponse {
  indicators: MarketIndicator[]
  timestamp: string
}
