/**
 * 대시보드 관련 React Query 훅 냥~ 🐱
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api'
import type { ManualHistoryEntry } from '@/types'
import type { Period } from '@/components/dashboard/PeriodSelector'

// Query Keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (portfolioId?: string) => [...dashboardKeys.all, 'summary', portfolioId] as const,
  history: (portfolioId?: string) => [...dashboardKeys.all, 'history', portfolioId] as const,
  historyByPeriod: (period: string, portfolioId?: string) => [...dashboardKeys.all, 'history', period, portfolioId] as const,
  benchmarkHistory: (tickers: string[], period: string) => [...dashboardKeys.all, 'benchmarkHistory', tickers, period] as const,
  manualHistory: (portfolioId?: string) => [...dashboardKeys.all, 'manualHistory', portfolioId] as const,
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

/**
 * 자산 히스토리 조회 훅 (기간별) 냥~ 🐱
 * @param period - 기간 (1W, 1M, 3M, 6M, 1Y)
 */
export function useAssetHistoryByPeriod(period: Period, portfolioId?: string) {
  return useQuery({
    queryKey: dashboardKeys.historyByPeriod(period, portfolioId),
    queryFn: () => dashboardApi.getHistoryByPeriod(period, portfolioId),
    staleTime: 1000 * 60 * 5, // 5분간 캐시
  })
}

/**
 * 벤치마크 히스토리 조회 훅 냥~ 📊
 * @param tickers - 벤치마크 티커 배열
 * @param period - 기간
 */
export function useBenchmarkHistory(tickers: string[], period: Period, enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.benchmarkHistory(tickers, period),
    queryFn: () => dashboardApi.getBenchmarkHistory(tickers, period),
    staleTime: 1000 * 60 * 10, // 10분간 캐시
    enabled: enabled && tickers.length > 0,
  })
}

/**
 * 수동 입력된 과거 데이터 조회 훅 냥~ 📋
 */
export function useManualHistory(portfolioId?: string) {
  return useQuery({
    queryKey: dashboardKeys.manualHistory(portfolioId),
    queryFn: () => dashboardApi.getManualHistory(portfolioId),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * 과거 데이터 수동 입력 훅 냥~ 📝
 */
export function useCreateManualHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      entries,
      portfolioId,
    }: {
      entries: ManualHistoryEntry[]
      portfolioId?: string
    }) => dashboardApi.createManualHistory(entries, portfolioId),
    onSuccess: () => {
      // 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

/**
 * 자산 히스토리 삭제 훅 냥~ 🗑️
 */
export function useDeleteAssetHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (historyId: string) => dashboardApi.deleteAssetHistory(historyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
