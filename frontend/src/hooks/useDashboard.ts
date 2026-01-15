/**
 * 대시보드 관련 React Query 훅 냥~ 🐱
 */
import { useQuery, useMutation } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api'
import type { RebalanceTarget } from '@/types'

// Query Keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (portfolioId?: string) => [...dashboardKeys.all, 'summary', portfolioId] as const,
  history: (portfolioId?: string) => [...dashboardKeys.all, 'history', portfolioId] as const,
  exchangeRate: () => [...dashboardKeys.all, 'exchangeRate'] as const,
}

/**
 * 대시보드 요약 조회 훅 냥~
 */
export function useDashboardSummary(portfolioId?: string) {
  return useQuery({
    queryKey: dashboardKeys.summary(portfolioId),
    queryFn: () => dashboardApi.getSummary(portfolioId),
    staleTime: 1000 * 60, // 1분간 캐시
    refetchInterval: 1000 * 60 * 5, // 5분마다 자동 갱신
  })
}

/**
 * 자산 히스토리 조회 훅 냥~
 * @param limit - 조회 일수 (days)
 */
export function useAssetHistory(limit = 30, portfolioId?: string) {
  return useQuery({
    queryKey: [...dashboardKeys.history(portfolioId), limit],
    queryFn: () => dashboardApi.getHistory(portfolioId, undefined, undefined, limit),
    staleTime: 1000 * 60 * 5, // 5분간 캐시 (히스토리는 자주 안 바뀜)
  })
}

/**
 * 리밸런싱 계산 훅 냥~
 */
export function useRebalanceCalculation() {
  return useMutation({
    mutationFn: ({
      targets,
      portfolioId,
    }: {
      targets: RebalanceTarget[]
      portfolioId?: string
    }) => dashboardApi.calculateRebalance(targets, portfolioId),
  })
}

/**
 * 환율 조회 훅 냥~
 */
export function useExchangeRate() {
  return useQuery({
    queryKey: dashboardKeys.exchangeRate(),
    queryFn: () => dashboardApi.getExchangeRate(),
    staleTime: 1000 * 60 * 10, // 10분간 캐시
    refetchInterval: 1000 * 60 * 10, // 10분마다 자동 갱신
  })
}

/**
 * 티커 히스토리 조회 훅 (Sparkline용) 냥~
 */
export function useTickerHistory(ticker: string | null | undefined, days = 30) {
  return useQuery({
    queryKey: [...dashboardKeys.all, 'tickerHistory', ticker, days] as const,
    queryFn: () => dashboardApi.getTickerHistory(ticker!, days),
    enabled: !!ticker, // 티커가 있을 때만 실행
    staleTime: 1000 * 60 * 5, // 5분간 캐시
  })
}
