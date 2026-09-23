/**
 * API 클라이언트 냥~ 🐱
 * axios 기반 API 통신 모듈
 */
import axios from 'axios'
import type {
  Asset,
  AssetCreate,
  AssetUpdate,
  AssetsListResponse,
  DashboardSummary,
  AssetHistory,
  AssetCategory,
  MeowResponse,
  ExchangeRateResponse,
  RebalanceAlertsResponse,
  GoalProgressResponse,
  TickerValidation,
  RebalancePlan,
  RebalancePlanCreate,
  RebalancePlanUpdate,
  PlanAllocationCreate,
  AllocationGroup,
  AllocationGroupCreate,
  AssetRebalanceResponse,
  TickerHistoryResponse,
  ExportData,
  ImportResponse,
  SchemaInfo,
  MarketIndicatorsResponse,
  ManualHistoryEntry,
  ManualHistoryItem,
  ManualHistoryCreateResponse,
  UserSettings,
  UserSettingsUpdate,
  RegimeCurrent,
  RegimeDashboardSummary,
  RegimeLevel,
  RegimeSnapshot,
} from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

// axios 인스턴스 생성
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 요청 인터셉터 (필요시 토큰 추가)
apiClient.interceptors.request.use(
  (config) => {
    // TODO: 인증 토큰 추가 시 여기에 구현
    return config
  },
  (error) => Promise.reject(error)
)

// 응답 인터셉터 (에러 처리)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

// ============================================
// Assets API 냥~
// ============================================

export const assetsApi = {
  // 자산 목록 조회 (v0.7.0 - summary 포함)
  getAll: async (portfolioId?: string, includeInactive = false): Promise<AssetsListResponse> => {
    const params = new URLSearchParams()
    if (portfolioId) params.append('portfolio_id', portfolioId)
    if (includeInactive) params.append('include_inactive', 'true')

    const { data } = await apiClient.get<AssetsListResponse>(`/assets?${params}`)
    return data
  },

  // 특정 자산 조회
  getById: async (assetId: string): Promise<Asset> => {
    const { data } = await apiClient.get<Asset>(`/assets/${assetId}`)
    return data
  },

  // 자산 생성
  create: async (asset: AssetCreate): Promise<Asset> => {
    const { data } = await apiClient.post<Asset>('/assets', asset)
    return data
  },

  // 자산 수정
  update: async (assetId: string, asset: AssetUpdate): Promise<Asset> => {
    const { data } = await apiClient.put<Asset>(`/assets/${assetId}`, asset)
    return data
  },

  // 자산 삭제
  delete: async (assetId: string, hardDelete = false): Promise<MeowResponse> => {
    const { data } = await apiClient.delete<MeowResponse>(
      `/assets/${assetId}?hard_delete=${hardDelete}`
    )
    return data
  },

  // 티커 검증
  validateTicker: async (ticker: string): Promise<TickerValidation> => {
    const { data } = await apiClient.get<TickerValidation>(`/assets/validate-ticker/${ticker}`)
    return data
  },
}

// ============================================
// Dashboard API 냥~
// ============================================

export const dashboardApi = {
  // 대시보드 요약 조회
  getSummary: async (portfolioId?: string): Promise<DashboardSummary> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.get<DashboardSummary>(`/dashboard/summary${params}`)
    return data
  },

  // 자산 히스토리 조회
  getHistory: async (
    portfolioId?: string,
    startDate?: string,
    endDate?: string,
    limit = 30
  ): Promise<AssetHistory[]> => {
    const params = new URLSearchParams()
    if (portfolioId) params.append('portfolio_id', portfolioId)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    params.append('limit', limit.toString())

    const { data } = await apiClient.get<AssetHistory[]>(`/dashboard/history?${params}`)
    return data
  },

  // 현재 환율 조회 냥~
  getExchangeRate: async (): Promise<ExchangeRateResponse> => {
    const { data } = await apiClient.get<ExchangeRateResponse>('/dashboard/exchange-rate')
    return data
  },

  // 리밸런싱 알림 조회 냥~
  getRebalanceAlerts: async (
    portfolioId?: string,
    threshold = 5.0
  ): Promise<RebalanceAlertsResponse> => {
    const params = new URLSearchParams()
    if (portfolioId) params.append('portfolio_id', portfolioId)
    params.append('threshold', threshold.toString())

    const { data } = await apiClient.get<RebalanceAlertsResponse>(
      `/dashboard/rebalance-alerts?${params}`
    )
    return data
  },

  // 목표 진행률 조회 냥~
  getGoalProgress: async (portfolioId?: string): Promise<GoalProgressResponse> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.get<GoalProgressResponse>(
      `/dashboard/goal-progress${params}`
    )
    return data
  },

  // 티커 히스토리 조회 (Sparkline용) 냥~
  getTickerHistory: async (ticker: string, days = 30): Promise<TickerHistoryResponse> => {
    const { data } = await apiClient.get<TickerHistoryResponse>(
      `/dashboard/ticker-history/${ticker}?days=${days}`
    )
    return data
  },

  // 시장 지표 조회 냥~
  getMarketIndicators: async (): Promise<MarketIndicatorsResponse> => {
    const { data } = await apiClient.get<MarketIndicatorsResponse>('/dashboard/market-indicators')
    return data
  },

  // 자산 히스토리 조회 (기간 파라미터 지원) 냥~
  getHistoryByPeriod: async (
    period: string,
    portfolioId?: string
  ): Promise<AssetHistory[]> => {
    const params = new URLSearchParams()
    params.append('period', period)
    if (portfolioId) params.append('portfolio_id', portfolioId)

    const { data } = await apiClient.get<AssetHistory[]>(`/dashboard/history?${params}`)
    return data
  },

  // 과거 데이터 수동 입력 냥~
  createManualHistory: async (
    entries: ManualHistoryEntry[],
    portfolioId?: string
  ): Promise<ManualHistoryCreateResponse> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.post<ManualHistoryCreateResponse>(
      `/dashboard/asset-history/manual${params}`,
      { entries }
    )
    return data
  },

  // 수동 입력된 과거 데이터 조회 냥~
  getManualHistory: async (portfolioId?: string): Promise<ManualHistoryItem[]> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.get<ManualHistoryItem[]>(
      `/dashboard/asset-history/manual${params}`
    )
    return data
  },

  // 자산 히스토리 삭제 냥~
  deleteAssetHistory: async (historyId: string): Promise<MeowResponse> => {
    const { data } = await apiClient.delete<MeowResponse>(
      `/dashboard/asset-history/${historyId}`
    )
    return data
  },
}

export const regimeApi = {
  getSummary: async (): Promise<RegimeDashboardSummary> => {
    const { data } = await apiClient.get<RegimeDashboardSummary>('/regime/summary')
    return data
  },
  getCurrent: async (): Promise<RegimeCurrent> => {
    const { data } = await apiClient.get<RegimeCurrent>('/regime')
    return data
  },
  refresh: async () => {
    const { data } = await apiClient.post('/regime/refresh?force=true')
    return data
  },
  completeReview: async (note?: string): Promise<RegimeCurrent> => {
    const { data } = await apiClient.post<RegimeCurrent>('/regime/review-complete', { note })
    return data
  },
  getHistory: async (): Promise<RegimeSnapshot[]> => {
    const { data } = await apiClient.get<RegimeSnapshot[]>('/regime/history')
    return data
  },
  createSnapshot: async (payload: { user_regime?: RegimeLevel; user_note?: string }): Promise<RegimeSnapshot> => {
    const { data } = await apiClient.post<RegimeSnapshot>('/regime/snapshots', payload)
    return data
  },
  updateSnapshot: async (id: string, payload: { user_regime?: RegimeLevel; user_note?: string }): Promise<RegimeSnapshot> => {
    const { data } = await apiClient.put<RegimeSnapshot>(`/regime/snapshots/${id}`, payload)
    return data
  },
}

// ============================================
// Categories API 냥~ (추후 확장용)
// ============================================

export const categoriesApi = {
  getAll: async (): Promise<AssetCategory[]> => {
    // TODO: 백엔드에 카테고리 API 추가 시 구현
    // 현재는 하드코딩된 값 반환
    return [
      { id: '1', name: '국내주식', color: '#ef4444', icon: 'cat', display_order: 1 },
      { id: '2', name: '해외주식', color: '#3b82f6', icon: 'fish', display_order: 2 },
      { id: '3', name: '현금', color: '#22c55e', icon: 'coins', display_order: 3 },
      { id: '4', name: '채권', color: '#f59e0b', icon: 'shield', display_order: 4 },
      { id: '5', name: '암호화폐', color: '#8b5cf6', icon: 'sparkles', display_order: 5 },
      { id: '6', name: '기타', color: '#6b7280', icon: 'box', display_order: 6 },
    ]
  },
}

// ============================================
// Rebalance Plans API
// ============================================

export const rebalanceApi = {
  // 플랜 목록 조회
  getPlans: async (portfolioId?: string): Promise<RebalancePlan[]> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.get<RebalancePlan[]>(`/rebalance/plans${params}`)
    return data
  },

  // 플랜 상세 조회
  getPlan: async (planId: string): Promise<RebalancePlan> => {
    const { data } = await apiClient.get<RebalancePlan>(`/rebalance/plans/${planId}`)
    return data
  },

  // 메인 플랜 조회
  getMainPlan: async (portfolioId?: string): Promise<RebalancePlan | null> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.get<RebalancePlan | null>(`/rebalance/main-plan${params}`)
    return data
  },

  // 플랜 생성
  createPlan: async (plan: RebalancePlanCreate): Promise<RebalancePlan> => {
    const { data } = await apiClient.post<RebalancePlan>('/rebalance/plans', plan)
    return data
  },

  // 플랜 수정
  updatePlan: async (planId: string, plan: RebalancePlanUpdate): Promise<RebalancePlan> => {
    const { data } = await apiClient.put<RebalancePlan>(`/rebalance/plans/${planId}`, plan)
    return data
  },

  // 플랜 삭제
  deletePlan: async (planId: string): Promise<MeowResponse> => {
    const { data } = await apiClient.delete<MeowResponse>(`/rebalance/plans/${planId}`)
    return data
  },

  // 메인 플랜 설정
  setMainPlan: async (planId: string): Promise<RebalancePlan> => {
    const { data } = await apiClient.post<RebalancePlan>(`/rebalance/plans/${planId}/set-main`)
    return data
  },

  // 배분 설정 저장
  saveAllocations: async (planId: string, allocations: PlanAllocationCreate[]): Promise<RebalancePlan> => {
    const { data } = await apiClient.put<RebalancePlan>(
      `/rebalance/plans/${planId}/allocations`,
      allocations
    )
    return data
  },

  // 리밸런싱 계산
  calculate: async (planId: string): Promise<AssetRebalanceResponse> => {
    const { data } = await apiClient.post<AssetRebalanceResponse>(
      `/rebalance/plans/${planId}/calculate`
    )
    return data
  },

  // 최신 자산 평가와 정량 레짐 근거를 포함한 AI 포트폴리오 점검 문서 다운로드
  downloadDecisionPrompt: async (planId: string): Promise<{ blob: Blob; filename: string }> => {
    const response = await apiClient.get<Blob>(
      `/rebalance/plans/${planId}/decision-prompt`,
      { responseType: 'blob' }
    )
    const disposition = response.headers['content-disposition'] as string | undefined
    const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    return {
      blob: response.data,
      filename: encodedName ? decodeURIComponent(encodedName) : 'portfolio-decision-prompt.md',
    }
  },

  // 메인 플랜 자동 리밸런싱 계산 냥~
  calculateMain: async (portfolioId?: string): Promise<AssetRebalanceResponse> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.post<AssetRebalanceResponse>(
      `/rebalance/calculate-main${params}`
    )
    return data
  },

  // ============================================
  // 배분 그룹 API 냥~
  // ============================================

  // 그룹 목록 조회
  getGroups: async (planId: string): Promise<AllocationGroup[]> => {
    const { data } = await apiClient.get<AllocationGroup[]>(
      `/rebalance/plans/${planId}/groups`
    )
    return data
  },

  // 그룹 저장 (전체 교체)
  saveGroups: async (planId: string, groups: AllocationGroupCreate[]): Promise<AllocationGroup[]> => {
    const { data } = await apiClient.put<AllocationGroup[]>(
      `/rebalance/plans/${planId}/groups`,
      groups
    )
    return data
  },
}

// ============================================
// Data Migration API 냥~
// ============================================

export const dataMigrationApi = {
  // 데이터 내보내기
  exportData: async (portfolioId?: string): Promise<ExportData> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.get<ExportData>(`/data/export${params}`)
    return data
  },

  // 데이터 가져오기
  importData: async (
    importData: Record<string, unknown>,
    mergeStrategy: 'replace' | 'merge' = 'replace'
  ): Promise<ImportResponse> => {
    const { data } = await apiClient.post<ImportResponse>('/data/import', {
      data: importData,
      merge_strategy: mergeStrategy,
    })
    return data
  },

  // 스키마 정보 조회
  getSchemaInfo: async (): Promise<SchemaInfo> => {
    const { data } = await apiClient.get<SchemaInfo>('/data/schema-info')
    return data
  },
}

// ============================================
// Settings API 냥~
// ============================================

export const settingsApi = {
  // 설정 조회 (없으면 기본값으로 생성)
  get: async (): Promise<UserSettings> => {
    const { data } = await apiClient.get<UserSettings>('/settings')
    return data
  },

  // 설정 수정
  update: async (settings: UserSettingsUpdate): Promise<UserSettings> => {
    const { data } = await apiClient.put<UserSettings>('/settings', settings)
    return data
  },
}
