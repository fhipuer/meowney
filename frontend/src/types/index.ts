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
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // 계산된 필드 (API에서 반환)
  current_price: number | null
  market_value: number | null
  profit_loss: number | null
  profit_rate: number | null
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
