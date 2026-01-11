/**
 * 자산 관련 React Query 훅 냥~ 🐱
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assetsApi } from '@/lib/api'
import type { AssetCreate, AssetUpdate } from '@/types'

// Query Keys
export const assetKeys = {
  all: ['assets'] as const,
  lists: () => [...assetKeys.all, 'list'] as const,
  list: (portfolioId?: string) => [...assetKeys.lists(), portfolioId] as const,
  details: () => [...assetKeys.all, 'detail'] as const,
  detail: (id: string) => [...assetKeys.details(), id] as const,
}

/**
 * 자산 목록 조회 훅 냥~
 */
export function useAssets(portfolioId?: string, includeInactive = false) {
  return useQuery({
    queryKey: assetKeys.list(portfolioId),
    queryFn: () => assetsApi.getAll(portfolioId, includeInactive),
    staleTime: 1000 * 60, // 1분간 캐시
  })
}

/**
 * 특정 자산 조회 훅 냥~
 */
export function useAsset(assetId: string) {
  return useQuery({
    queryKey: assetKeys.detail(assetId),
    queryFn: () => assetsApi.getById(assetId),
    enabled: !!assetId,
  })
}

/**
 * 자산 생성 훅 냥~
 */
export function useCreateAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (asset: AssetCreate) => assetsApi.create(asset),
    onSuccess: () => {
      // 자산 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() })
      // 대시보드 캐시도 무효화
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/**
 * 자산 수정 훅 냥~
 */
export function useUpdateAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssetUpdate }) =>
      assetsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() })
      queryClient.invalidateQueries({ queryKey: assetKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/**
 * 자산 삭제 훅 냥~
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, hardDelete = false }: { id: string; hardDelete?: boolean }) =>
      assetsApi.delete(id, hardDelete),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
