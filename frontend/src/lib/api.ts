/**
 * API 클라이언트 냥~ 🐱
 * axios 기반 API 통신 모듈
 */
import axios from 'axios'
import type {
  Asset,
  AssetCreate,
  AssetUpdate,
  DashboardSummary,
  AssetHistory,
  RebalanceTarget,
  RebalanceResponse,
  AssetCategory,
  MeowResponse,
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
    const message = error.response?.data?.detail || '냥? 뭔가 잘못됐다옹! 🙀'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

// ============================================
// Assets API 냥~
// ============================================

export const assetsApi = {
  // 자산 목록 조회
  getAll: async (portfolioId?: string, includeInactive = false): Promise<Asset[]> => {
    const params = new URLSearchParams()
    if (portfolioId) params.append('portfolio_id', portfolioId)
    if (includeInactive) params.append('include_inactive', 'true')

    const { data } = await apiClient.get<Asset[]>(`/assets?${params}`)
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

  // 리밸런싱 계산
  calculateRebalance: async (
    targets: RebalanceTarget[],
    portfolioId?: string
  ): Promise<RebalanceResponse> => {
    const params = portfolioId ? `?portfolio_id=${portfolioId}` : ''
    const { data } = await apiClient.post<RebalanceResponse>(
      `/dashboard/rebalance${params}`,
      targets
    )
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
