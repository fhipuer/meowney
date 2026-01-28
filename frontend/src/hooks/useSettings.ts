/**
 * 사용자 설정 훅 냥~ 🐱
 * 리밸런싱 허용 오차 등 설정 관리
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/lib/api'
import type { UserSettingsUpdate } from '@/types'

// 쿼리 키
export const settingsKeys = {
  all: ['settings'] as const,
  detail: () => [...settingsKeys.all, 'detail'] as const,
}

/**
 * 설정 조회 훅
 */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: settingsApi.get,
    staleTime: 5 * 60 * 1000, // 5분
  })
}

/**
 * 설정 수정 훅
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: UserSettingsUpdate) => settingsApi.update(settings),
    onSuccess: () => {
      // 설정 캐시 무효화
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}
