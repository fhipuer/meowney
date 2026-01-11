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
 */
export function useAssetHistory(
  portfolioId?: string,
  startDate?: string,
  endDate?: string,
  limit = 30
) {
  return useQuery({
    queryKey: [...dashboardKeys.history(portfolioId), startDate, endDate, limit],
    queryFn: () => dashboardApi.getHistory(portfolioId, startDate, endDate, limit),
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
