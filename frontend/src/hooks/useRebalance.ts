/**
 * 리밸런싱 플랜 React Query 훅
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rebalanceApi } from '@/lib/api'
import type {
  RebalancePlanCreate,
  RebalancePlanUpdate,
  PlanAllocationCreate,
  AllocationGroupCreate,
} from '@/types'

// 플랜 목록 조회
export function usePlans(portfolioId?: string) {
  return useQuery({
    queryKey: ['rebalancePlans', portfolioId],
    queryFn: () => rebalanceApi.getPlans(portfolioId),
    staleTime: 5 * 60 * 1000,
  })
}

// 플랜 상세 조회
export function usePlan(planId: string) {
  return useQuery({
    queryKey: ['rebalancePlan', planId],
    queryFn: () => rebalanceApi.getPlan(planId),
    enabled: !!planId,
    staleTime: 5 * 60 * 1000,
  })
}

// 메인 플랜 조회
export function useMainPlan(portfolioId?: string) {
  return useQuery({
    queryKey: ['mainPlan', portfolioId],
    queryFn: () => rebalanceApi.getMainPlan(portfolioId),
    staleTime: 5 * 60 * 1000,
  })
}

// 플랜 생성
export function useCreatePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (plan: RebalancePlanCreate) => rebalanceApi.createPlan(plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rebalancePlans'] })
      queryClient.invalidateQueries({ queryKey: ['mainPlan'] })
    },
  })
}

// 플랜 수정
export function useUpdatePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: RebalancePlanUpdate }) =>
      rebalanceApi.updatePlan(planId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rebalancePlans'] })
      queryClient.invalidateQueries({ queryKey: ['rebalancePlan', variables.planId] })
      queryClient.invalidateQueries({ queryKey: ['mainPlan'] })
    },
  })
}

// 플랜 삭제
export function useDeletePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId: string) => rebalanceApi.deletePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rebalancePlans'] })
      queryClient.invalidateQueries({ queryKey: ['mainPlan'] })
    },
  })
}

// 메인 플랜 설정
export function useSetMainPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId: string) => rebalanceApi.setMainPlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rebalancePlans'] })
      queryClient.invalidateQueries({ queryKey: ['mainPlan'] })
    },
  })
}

// 배분 설정 저장
export function useSaveAllocations() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      planId,
      allocations,
    }: {
      planId: string
      allocations: PlanAllocationCreate[]
    }) => rebalanceApi.saveAllocations(planId, allocations),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rebalancePlan', variables.planId] })
      queryClient.invalidateQueries({ queryKey: ['rebalancePlans'] })
    },
  })
}

// 리밸런싱 계산
export function useCalculateRebalance() {
  return useMutation({
    mutationFn: (planId: string) => rebalanceApi.calculate(planId),
  })
}

// 배분 그룹 저장 냥~
export function useSaveGroups() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      planId,
      groups,
    }: {
      planId: string
      groups: AllocationGroupCreate[]
    }) => rebalanceApi.saveGroups(planId, groups),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rebalancePlan', variables.planId] })
      queryClient.invalidateQueries({ queryKey: ['rebalancePlans'] })
    },
  })
}
