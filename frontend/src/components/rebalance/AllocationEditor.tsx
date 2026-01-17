/**
 * 목표 배분 편집기 컴포넌트 - 개별 배분 + 그룹 배분 통합 지원 냥~
 * Phase 1 개선: 실시간 파이차트, 비율 정규화, 자산 선택 UI, 자동 저장
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Save, AlertCircle, Plus, Trash2, ChevronDown, ChevronRight, Link2, Link2Off, Layers, RotateCcw, Scale } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useAssets } from '@/hooks/useAssets'
import { useExchangeRate } from '@/hooks/useDashboard'
import { useSaveAllocations, useUpdatePlan, useSaveGroups } from '@/hooks/useRebalance'
import { useAutoSave, formatLastSaved } from '@/hooks/useAutoSave'
import { formatKRW, formatUSD } from '@/lib/utils'
import { TickerSparkline } from './TickerSparkline'
import { RealTimePieChart } from './RealTimePieChart'
import { AssetSelectorModal } from './AssetSelectorModal'
import { AddAllocationModal } from './AddAllocationModal'
import { AddGroupModal } from './AddGroupModal'
import type {
  RebalancePlan,
  PlanAllocationCreate,
  AllocationGroupCreate,
  Asset
} from '@/types'

// 개별 배분 항목 내부 상태
interface AllocationItem {
  id: string
  asset_id?: string
  ticker?: string
  alias?: string
  display_name?: string
  target_percentage: number
  matched_asset?: Asset
}

// 그룹 아이템 내부 상태 (weight 제거됨 - 단순 소속 관계만)
interface GroupItem {
  id: string
  asset_id?: string
  ticker?: string
  alias?: string
  matched_asset?: Asset
}

// 그룹 내부 상태
interface GroupState {
  id: string
  name: string
  target_percentage: number
  items: GroupItem[]
  isExpanded: boolean
}

interface AllocationEditorProps {
  plan: RebalancePlan
  open: boolean
  onOpenChange: (open: boolean) => void
}

// 고유 ID 생성
const generateId = () => Math.random().toString(36).substr(2, 9)

export function AllocationEditor({ plan, open, onOpenChange }: AllocationEditorProps) {
  const { data: assets } = useAssets()
  const { data: exchangeRate } = useExchangeRate()
  const saveAllocationsMutation = useSaveAllocations()
  const saveGroupsMutation = useSaveGroups()
  const updatePlanMutation = useUpdatePlan()

  // 플랜 기본 정보 상태
  const [planName, setPlanName] = useState(plan.name)
  const [planDescription, setPlanDescription] = useState(plan.description || '')
  const [planStrategyPrompt, setPlanStrategyPrompt] = useState(plan.strategy_prompt || '')

  // 개별 배분 상태
  const [allocations, setAllocations] = useState<AllocationItem[]>(() => {
    return (plan.allocations || []).map((alloc) => ({
      id: alloc.id || generateId(),
      asset_id: alloc.asset_id || undefined,
      ticker: alloc.ticker || undefined,
      alias: alloc.alias || undefined,
      display_name: alloc.display_name || undefined,
      target_percentage: alloc.target_percentage,
      matched_asset: matchItemToAsset(alloc, assets || []),
    }))
  })

  // 그룹 배분 상태
  const [groups, setGroups] = useState<GroupState[]>(() => {
    return (plan.groups || []).map((group) => ({
      id: group.id || generateId(),
      name: group.name,
      target_percentage: group.target_percentage,
      items: (group.items || []).map((item) => ({
        id: item.id || generateId(),
        asset_id: item.asset_id || undefined,
        ticker: item.ticker || undefined,
        alias: item.alias || undefined,
        matched_asset: matchItemToAsset(item, assets || []),
      })),
      isExpanded: true,
    }))
  })

  // 모달 상태
  const [showAddAllocation, setShowAddAllocation] = useState(false)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showAssetSelector, setShowAssetSelector] = useState(false)
  const [assetSelectorMode, setAssetSelectorMode] = useState<'individual' | 'group'>('individual')
  const [selectedGroupIdForAsset, setSelectedGroupIdForAsset] = useState<string | null>(null)

  // assets가 로드되면 자산 매칭 재수행 냥~
  useEffect(() => {
    if (!assets || assets.length === 0) return

    // 개별 배분 아이템 재매칭
    setAllocations((prev) =>
      prev.map((alloc) => ({
        ...alloc,
        matched_asset: matchItemToAsset(alloc, assets),
      }))
    )

    // 그룹 아이템 재매칭
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          matched_asset: matchItemToAsset(item, assets),
        })),
      }))
    )
  }, [assets])

  // 매칭 로직
  function matchItemToAsset(
    item: { asset_id?: string | null; ticker?: string | null; alias?: string | null },
    assetList: Asset[]
  ): Asset | undefined {
    if (!assetList || assetList.length === 0) return undefined

    // 1. asset_id 매칭
    if (item.asset_id) {
      const matched = assetList.find((a) => a.id === item.asset_id)
      if (matched) return matched
    }

    // 2. ticker 매칭
    if (item.ticker) {
      const matched = assetList.find((a) => a.ticker === item.ticker)
      if (matched) return matched
    }

    // 3. alias 매칭 (이름 포함 검사)
    if (item.alias) {
      const aliasLower = item.alias.toLowerCase()
      const matched = assetList.find((a) => {
        const nameLower = a.name.toLowerCase()
        return aliasLower.includes(nameLower) || nameLower.includes(aliasLower)
      })
      if (matched) return matched
    }

    return undefined
  }

  // 총합 계산
  const totalPercentage = useMemo(() => {
    const allocTotal = allocations.reduce((sum, a) => sum + (a.target_percentage || 0), 0)
    const groupTotal = groups.reduce((sum, g) => sum + (g.target_percentage || 0), 0)
    return allocTotal + groupTotal
  }, [allocations, groups])

  const isValid = Math.abs(totalPercentage - 100) < 0.1

  // 표시명 결정 (chartData에서 사용하므로 먼저 정의)
  const getDisplayName = (item: AllocationItem | GroupItem): string => {
    if ('display_name' in item && item.display_name) return item.display_name
    if (item.matched_asset) return item.matched_asset.name
    if (item.ticker) return item.ticker
    if (item.alias) return item.alias
    return '미확인 자산'
  }

  // 파이차트용 데이터 생성
  const chartData = useMemo(() => {
    const data: Array<{ name: string; value: number; isGroup?: boolean }> = []

    // 개별 배분
    allocations.forEach((alloc) => {
      if (alloc.target_percentage > 0) {
        data.push({
          name: getDisplayName(alloc),
          value: alloc.target_percentage,
          isGroup: false,
        })
      }
    })

    // 그룹 배분
    groups.forEach((group) => {
      if (group.target_percentage > 0) {
        data.push({
          name: group.name,
          value: group.target_percentage,
          isGroup: true,
        })
      }
    })

    return data
  }, [allocations, groups])

  // 이미 플랜에 추가된 자산 ID 목록
  const alreadyAddedAssetIds = useMemo(() => {
    const ids: string[] = []

    // 개별 배분에서
    allocations.forEach((alloc) => {
      if (alloc.asset_id) ids.push(alloc.asset_id)
      if (alloc.matched_asset?.id) ids.push(alloc.matched_asset.id)
    })

    // 그룹 내 아이템에서
    groups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.asset_id) ids.push(item.asset_id)
        if (item.matched_asset?.id) ids.push(item.matched_asset.id)
      })
    })

    return [...new Set(ids)]
  }, [allocations, groups])

  // 자동 저장 훅 - 비교를 위해 matched_asset 제외한 데이터만 저장
  const autoSaveData = useMemo(() => ({
    planName,
    planDescription,
    planStrategyPrompt,
    allocations: allocations.map((alloc) => ({
      id: alloc.id,
      asset_id: alloc.asset_id,
      ticker: alloc.ticker,
      alias: alloc.alias,
      display_name: alloc.display_name,
      target_percentage: alloc.target_percentage,
      // matched_asset 제외 - 비교 시 문제 방지
    })),
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      target_percentage: group.target_percentage,
      items: group.items.map((item) => ({
        id: item.id,
        asset_id: item.asset_id,
        ticker: item.ticker,
        alias: item.alias,
        // matched_asset 제외
      })),
      isExpanded: group.isExpanded,
    })),
  }), [planName, planDescription, planStrategyPrompt, allocations, groups])

  // 초기 데이터 (원본과 비교용) - autoSaveData와 동일한 구조 유지
  const initialAutoSaveData = useMemo(() => ({
    planName: plan.name,
    planDescription: plan.description || '',
    planStrategyPrompt: plan.strategy_prompt || '',
    allocations: (plan.allocations || []).map((alloc) => ({
      id: alloc.id,
      asset_id: alloc.asset_id ?? undefined,
      ticker: alloc.ticker ?? undefined,
      alias: alloc.alias ?? undefined,
      display_name: alloc.display_name ?? undefined,
      target_percentage: alloc.target_percentage,
    })),
    groups: (plan.groups || []).map((group) => ({
      id: group.id,
      name: group.name,
      target_percentage: group.target_percentage,
      items: (group.items || []).map((item) => ({
        id: item.id,
        asset_id: item.asset_id ?? undefined,
        ticker: item.ticker ?? undefined,
        alias: item.alias ?? undefined,
      })),
      isExpanded: true,
    })),
  }), [plan])

  const { hasRecoveryData, recover, clearRecovery, lastSaved } = useAutoSave({
    key: `meowney-plan-${plan.id}`,
    data: autoSaveData,
    initialData: initialAutoSaveData,
    debounceMs: 1000,
    enabled: open,
  })

  // 복구 프롬프트 상태
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)

  // 모달 열릴 때 복구 데이터 확인 (hasRecoveryData 변경 시 동기화)
  useEffect(() => {
    if (open && hasRecoveryData) {
      setShowRecoveryPrompt(true)
    } else {
      setShowRecoveryPrompt(false)
    }
  }, [open, hasRecoveryData])

  // 복구 처리
  const handleRecover = () => {
    const recovered = recover()
    if (recovered) {
      const data = recovered as typeof autoSaveData
      setPlanName(data.planName)
      setPlanDescription(data.planDescription)
      setPlanStrategyPrompt(data.planStrategyPrompt)
      setAllocations(data.allocations)
      setGroups(data.groups)
    }
    setShowRecoveryPrompt(false)
  }

  // 복구 무시
  const handleIgnoreRecovery = () => {
    clearRecovery()
    setShowRecoveryPrompt(false)
  }

  // 개별 배분 비율 변경
  const handleAllocationChange = (id: string, value: number) => {
    setAllocations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, target_percentage: Math.min(100, Math.max(0, value)) } : a))
    )
  }

  // 개별 배분 삭제
  const handleRemoveAllocation = (id: string) => {
    setAllocations((prev) => prev.filter((a) => a.id !== id))
  }

  // 그룹 비율 변경
  const handleGroupChange = (id: string, value: number) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, target_percentage: Math.min(100, Math.max(0, value)) } : g))
    )
  }

  // 그룹 삭제
  const handleRemoveGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id))
  }

  // 그룹 토글
  const handleToggleGroup = (id: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isExpanded: !g.isExpanded } : g))
    )
  }

  // 그룹 내 아이템 삭제
  const handleRemoveGroupItem = (groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, items: g.items.filter((item) => item.id !== itemId) } : g
      )
    )
  }

  // 새 배분 추가 (모달에서 호출)
  const handleAddAllocation = useCallback(
    (data: { type: 'asset' | 'ticker' | 'alias'; value: string; display_name?: string }) => {
      const newItem: AllocationItem = {
        id: generateId(),
        target_percentage: 0,
      }

      if (data.type === 'asset') {
        newItem.asset_id = data.value
        const matched = assets?.find((a) => a.id === data.value)
        newItem.matched_asset = matched
        newItem.display_name = matched?.name
      } else if (data.type === 'ticker') {
        newItem.ticker = data.value
        newItem.display_name = data.display_name || data.value
        newItem.matched_asset = matchItemToAsset({ ticker: data.value }, assets || [])
      } else {
        newItem.alias = data.value
        newItem.display_name = data.display_name || data.value
        newItem.matched_asset = matchItemToAsset({ alias: data.value }, assets || [])
      }

      setAllocations((prev) => [...prev, newItem])
      setShowAddAllocation(false)
    },
    [assets]
  )

  // 새 그룹 추가 (모달에서 호출) - weight 제거됨
  const handleAddGroup = useCallback(
    (data: { name: string; target_percentage: number; items: Array<{ type: 'ticker' | 'alias'; value: string }> }) => {
      const newGroup: GroupState = {
        id: generateId(),
        name: data.name,
        target_percentage: data.target_percentage,
        isExpanded: true,
        items: data.items.map((item) => {
          const groupItem: GroupItem = {
            id: generateId(),
          }
          if (item.type === 'ticker') {
            groupItem.ticker = item.value
            groupItem.matched_asset = matchItemToAsset({ ticker: item.value }, assets || [])
          } else {
            groupItem.alias = item.value
            groupItem.matched_asset = matchItemToAsset({ alias: item.value }, assets || [])
          }
          return groupItem
        }),
      }

      setGroups((prev) => [...prev, newGroup])
      setShowAddGroup(false)
    },
    [assets]
  )

  // 균등 배분
  const handleEqualDistribution = () => {
    const totalItems = allocations.length + groups.length
    if (totalItems === 0) return

    const equalPct = Math.round((100 / totalItems) * 10) / 10

    setAllocations((prev) => prev.map((a) => ({ ...a, target_percentage: equalPct })))
    setGroups((prev) => prev.map((g) => ({ ...g, target_percentage: equalPct })))
  }

  // 비율 정규화 (100%에 맞춤)
  const handleNormalize = () => {
    if (totalPercentage === 0) return

    // 모든 항목 수집
    const allItems = [
      ...allocations.map((a) => ({ type: 'allocation' as const, id: a.id, ratio: a.target_percentage })),
      ...groups.map((g) => ({ type: 'group' as const, id: g.id, ratio: g.target_percentage })),
    ].filter((item) => item.ratio > 0)

    if (allItems.length === 0) return

    // 비례 배분 계산
    let remaining = 100
    const normalized: Map<string, number> = new Map()

    allItems.slice(0, -1).forEach((item) => {
      const newRatio = Math.round((item.ratio / totalPercentage) * 100 * 10) / 10
      normalized.set(item.id, newRatio)
      remaining -= newRatio
    })

    // 마지막 항목은 나머지로 (반올림 오차 보정)
    if (allItems.length > 0) {
      normalized.set(allItems[allItems.length - 1].id, Math.round(remaining * 10) / 10)
    }

    // 상태 업데이트
    setAllocations((prev) =>
      prev.map((a) => ({
        ...a,
        target_percentage: normalized.get(a.id) ?? a.target_percentage,
      }))
    )
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        target_percentage: normalized.get(g.id) ?? g.target_percentage,
      }))
    )
  }

  // 보유 자산에서 선택하여 개별 배분 추가
  const handleSelectAssetsForIndividual = (selectedAssets: Asset[]) => {
    const newAllocations: AllocationItem[] = selectedAssets.map((asset) => ({
      id: generateId(),
      asset_id: asset.id,
      ticker: asset.ticker || undefined,
      display_name: asset.name,
      target_percentage: 0,
      matched_asset: asset,
    }))
    setAllocations((prev) => [...prev, ...newAllocations])
  }

  // 보유 자산에서 선택하여 그룹에 추가
  const handleSelectAssetsForGroup = (selectedAssets: Asset[]) => {
    if (!selectedGroupIdForAsset) return

    const newItems: GroupItem[] = selectedAssets.map((asset) => ({
      id: generateId(),
      asset_id: asset.id,
      ticker: asset.ticker || undefined,
      matched_asset: asset,
    }))

    setGroups((prev) =>
      prev.map((g) =>
        g.id === selectedGroupIdForAsset ? { ...g, items: [...g.items, ...newItems] } : g
      )
    )
    setSelectedGroupIdForAsset(null)
  }

  // 개별 배분에 보유 자산 추가 모달 열기
  const openAssetSelectorForIndividual = () => {
    setAssetSelectorMode('individual')
    setSelectedGroupIdForAsset(null)
    setShowAssetSelector(true)
  }

  // 그룹에 보유 자산 추가 모달 열기
  const openAssetSelectorForGroup = (groupId: string) => {
    setAssetSelectorMode('group')
    setSelectedGroupIdForAsset(groupId)
    setShowAssetSelector(true)
  }

  // 현재 비율 적용 (기존 배분 구조 유지하면서 현재 시장가치 기준으로 업데이트)
  const handleCurrentRatio = () => {
    if (!assets || assets.length === 0) return

    const totalValue = assets.reduce((sum, a) => sum + (a.market_value || 0), 0)
    if (totalValue === 0) return

    // 개별 배분 업데이트
    setAllocations((prev) =>
      prev.map((alloc) => {
        const matched = alloc.matched_asset || matchItemToAsset(alloc, assets)
        if (matched && matched.market_value) {
          const pct = (matched.market_value / totalValue) * 100
          return { ...alloc, target_percentage: Math.round(pct * 10) / 10 }
        }
        return alloc
      })
    )

    // 그룹 배분 업데이트
    setGroups((prev) =>
      prev.map((group) => {
        let groupValue = 0
        group.items.forEach((item) => {
          const matched = item.matched_asset || matchItemToAsset(item, assets)
          if (matched && matched.market_value) {
            groupValue += matched.market_value
          }
        })
        const pct = groupValue > 0 ? (groupValue / totalValue) * 100 : 0
        return { ...group, target_percentage: Math.round(pct * 10) / 10 }
      })
    )
  }

  // 저장
  const handleSave = async () => {
    // 1. 플랜 정보 업데이트
    const nameChanged = planName !== plan.name
    const descChanged = planDescription !== (plan.description || '')
    const strategyChanged = planStrategyPrompt !== (plan.strategy_prompt || '')

    if (nameChanged || descChanged || strategyChanged) {
      await updatePlanMutation.mutateAsync({
        planId: plan.id,
        data: {
          name: planName,
          description: planDescription || undefined,
          strategy_prompt: planStrategyPrompt || undefined,
        },
      })
    }

    // 2. 개별 배분 저장
    const allocationData: PlanAllocationCreate[] = allocations
      .filter((a) => a.target_percentage > 0)
      .map((a) => ({
        asset_id: a.asset_id,
        ticker: a.ticker,
        alias: a.alias,
        display_name: a.display_name,
        target_percentage: a.target_percentage,
      }))

    await saveAllocationsMutation.mutateAsync({
      planId: plan.id,
      allocations: allocationData,
    })

    // 3. 그룹 배분 저장 (비율이 0이어도 그룹 자체는 저장) - weight 제거됨
    const groupData: AllocationGroupCreate[] = groups
      .filter((g) => g.items.length > 0) // 아이템이 있는 그룹만 저장
      .map((g) => ({
        name: g.name,
        target_percentage: g.target_percentage,
        items: g.items.map((item) => ({
          asset_id: item.asset_id,
          ticker: item.ticker,
          alias: item.alias,
          // weight 제거됨 - 그룹 내 비중은 더 이상 사용하지 않음
        })),
      }))

    await saveGroupsMutation.mutateAsync({
      planId: plan.id,
      groups: groupData,
    })

    onOpenChange(false)
  }

  // 현재가치 계산 (개별) - USD 자산은 환율 적용하여 KRW로 변환
  const getCurrentValue = (item: AllocationItem): number => {
    const asset = item.matched_asset
    if (!asset) return 0

    const value = Number(asset.market_value)
    if (!value || !isFinite(value)) return 0

    // USD 자산은 환율 적용
    if (asset.currency === 'USD') {
      const rate = Number(exchangeRate?.rate)
      if (!rate || !isFinite(rate)) return value
      const converted = value * rate
      return isFinite(converted) ? converted : 0
    }
    return value
  }

  // 그룹 내 아이템 현재가치 계산 (KRW 변환 포함, NaN 체크)
  const getItemValueInKRW = (item: GroupItem): number => {
    const asset = item.matched_asset
    if (!asset) return 0

    // 명시적으로 숫자 변환 (string일 수 있음)
    const value = Number(asset.market_value)
    if (!value || !isFinite(value)) return 0

    if (asset.currency === 'USD') {
      const rate = Number(exchangeRate?.rate)
      if (!rate || !isFinite(rate)) return value // 환율 없으면 원본 값 반환
      const converted = value * rate
      return isFinite(converted) ? converted : 0
    }
    return value
  }

  // 그룹 현재가치 계산
  const getGroupCurrentValue = (group: GroupState): number => {
    return group.items.reduce((sum, item) => sum + getItemValueInKRW(item), 0)
  }

  const isSaving = saveAllocationsMutation.isPending || saveGroupsMutation.isPending || updatePlanMutation.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>플랜 편집: {plan.name}</DialogTitle>
            <DialogDescription>
              각 자산/그룹별 목표 비율을 설정합니다. 합계가 100%가 되어야 합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 복구 프롬프트 */}
            {showRecoveryPrompt && (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <RotateCcw className="h-4 w-4 text-amber-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span>이전에 저장되지 않은 편집 내용이 있습니다. 복구할까요?</span>
                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={handleIgnoreRecovery}>
                      무시
                    </Button>
                    <Button size="sm" onClick={handleRecover}>
                      복구
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* 실시간 파이차트 + 합계 */}
            <div className="flex items-start gap-6 p-4 border rounded-lg bg-muted/30">
              <RealTimePieChart
                data={chartData}
                totalPercentage={totalPercentage}
                className="flex-shrink-0"
              />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">목표 비율 합계</p>
                  <p className={`text-2xl font-bold ${isValid ? 'text-green-600' : 'text-amber-600'}`}>
                    {totalPercentage.toFixed(1)}%
                  </p>
                </div>
                {!isValid && totalPercentage > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNormalize}
                    className="w-full"
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    100%로 정규화
                  </Button>
                )}
                {lastSaved && (
                  <p className="text-xs text-muted-foreground">
                    💾 자동 저장됨 ({formatLastSaved(lastSaved)})
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* 플랜 기본 정보 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editPlanName">플랜 이름</Label>
                <Input
                  id="editPlanName"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPlanDesc">설명</Label>
                <Input
                  id="editPlanDesc"
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  placeholder="플랜 설명 (선택)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPlanStrategy">전략 프롬프트</Label>
                <Textarea
                  id="editPlanStrategy"
                  value={planStrategyPrompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPlanStrategyPrompt(e.target.value)
                  }
                  placeholder="투자 전략, 리밸런싱 기준 등 (AI 분석 시 참고)"
                  rows={3}
                />
              </div>
            </div>

            <Separator />

            {/* 빠른 설정 + 추가 버튼 */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleEqualDistribution}>
                균등 배분
              </Button>
              <Button variant="outline" size="sm" onClick={handleCurrentRatio}>
                현재 비율 적용
              </Button>
              <div className="flex-1" />
              <Button variant="default" size="sm" onClick={openAssetSelectorForIndividual}>
                <Plus className="h-4 w-4 mr-1" />
                보유 자산 선택
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddAllocation(true)}>
                <Plus className="h-4 w-4 mr-1" />
                티커/별칭 추가
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddGroup(true)}>
                <Layers className="h-4 w-4 mr-1" />
                그룹 추가
              </Button>
            </div>

            {/* 개별 배분 항목들 */}
            {allocations.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">개별 배분</h4>
                {allocations.map((alloc) => {
                  const isMatched = !!alloc.matched_asset
                  const value = getCurrentValue(alloc)

                  return (
                    <div key={alloc.id} className="space-y-2 p-3 border rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isMatched ? (
                            <Link2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <Link2Off className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="font-medium truncate">{getDisplayName(alloc)}</span>
                          {alloc.ticker && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              {alloc.ticker}
                            </Badge>
                          )}
                          {alloc.alias && !alloc.ticker && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              별칭
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {alloc.matched_asset?.ticker && (
                            <TickerSparkline
                              ticker={alloc.matched_asset.ticker}
                              days={30}
                              showChangeRate={true}
                              width={60}
                              height={24}
                            />
                          )}
                          {/* USD 자산은 달러/원화 이중 표시 */}
                          {alloc.matched_asset?.currency === 'USD' && exchangeRate ? (
                            <div className="text-sm text-right min-w-[90px]">
                              <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                                {formatUSD(alloc.matched_asset.market_value || 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatKRW(value)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground min-w-[70px] text-right">
                              {formatKRW(value)}
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className="w-20 h-8 text-right"
                              value={alloc.target_percentage || ''}
                              onChange={(e) =>
                                handleAllocationChange(alloc.id, parseFloat(e.target.value) || 0)
                              }
                            />
                            <span className="text-sm">%</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveAllocation(alloc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <Progress value={alloc.target_percentage} className="h-1.5" />
                    </div>
                  )
                })}
              </div>
            )}

            {/* 그룹 배분 */}
            {groups.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">그룹 배분</h4>
                {groups.map((group) => {
                  const groupValue = getGroupCurrentValue(group)

                  return (
                    <Collapsible
                      key={group.id}
                      open={group.isExpanded}
                      onOpenChange={() => handleToggleGroup(group.id)}
                    >
                      <div className="border rounded-lg">
                        <div className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                                {group.isExpanded ? (
                                  <ChevronDown className="h-4 w-4 mr-2" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 mr-2" />
                                )}
                                <Layers className="h-4 w-4 mr-2 text-primary" />
                                <span className="font-medium">{group.name}</span>
                                <Badge variant="outline" className="ml-2">
                                  {group.items.length}개
                                </Badge>
                              </Button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {formatKRW(groupValue)}
                              </span>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  className="w-20 h-8 text-right"
                                  value={group.target_percentage || ''}
                                  onChange={(e) =>
                                    handleGroupChange(group.id, parseFloat(e.target.value) || 0)
                                  }
                                />
                                <span className="text-sm">%</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRemoveGroup(group.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <Progress value={group.target_percentage} className="h-1.5" />
                        </div>

                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-1 space-y-2 border-t bg-muted/30">
                            {/* 그룹에 자산 추가 버튼 */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-7 text-xs"
                              onClick={() => openAssetSelectorForGroup(group.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              보유 자산 추가
                            </Button>
                            {group.items.map((item) => {
                              const isMatched = !!item.matched_asset
                              const itemValueKRW = getItemValueInKRW(item)
                              const itemValueUSD = item.matched_asset?.market_value || 0
                              const isUSD = item.matched_asset?.currency === 'USD'

                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-2 text-sm"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {isMatched ? (
                                      <Link2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Link2Off className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                    )}
                                    <span className="truncate">
                                      {item.matched_asset?.name || item.ticker || item.alias || '미확인'}
                                    </span>
                                    {item.ticker && (
                                      <Badge variant="secondary" className="text-xs">
                                        {item.ticker}
                                      </Badge>
                                    )}
                                    {isUSD && (
                                      <Badge variant="outline" className="text-xs text-emerald-600">
                                        USD
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {isUSD && exchangeRate ? (
                                      <div className="text-right">
                                        <div className="text-emerald-600 dark:text-emerald-400 text-xs">
                                          {formatUSD(itemValueUSD)}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                          {formatKRW(itemValueKRW)}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">{formatKRW(itemValueKRW)}</span>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleRemoveGroupItem(group.id, item.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )
                })}
              </div>
            )}

            {/* 빈 상태 */}
            {allocations.length === 0 && groups.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>아직 배분 설정이 없습니다.</p>
                <p className="text-sm mt-1">
                  "항목 추가" 또는 "그룹 추가" 버튼을 눌러 시작하세요.
                </p>
              </div>
            )}

            <Separator />

            {/* 합계 표시 */}
            <div className="flex items-center justify-between">
              <span className="font-medium">목표 비율 합계</span>
              <span className={`font-bold ${isValid ? 'text-green-500' : 'text-destructive'}`}>
                {totalPercentage.toFixed(1)}%
                {isValid ? ' ✓' : ''}
              </span>
            </div>

            {!isValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  목표 비율의 합이 100%가 되어야 합니다. 현재: {totalPercentage.toFixed(1)}%
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={!isValid || isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 항목 추가 모달 */}
      <AddAllocationModal
        open={showAddAllocation}
        onOpenChange={setShowAddAllocation}
        onAdd={handleAddAllocation}
        assets={assets || []}
        existingAllocations={allocations}
      />

      {/* 그룹 추가 모달 */}
      <AddGroupModal
        open={showAddGroup}
        onOpenChange={setShowAddGroup}
        onAdd={handleAddGroup}
        assets={assets || []}
      />

      {/* 보유 자산 선택 모달 */}
      <AssetSelectorModal
        open={showAssetSelector}
        onOpenChange={setShowAssetSelector}
        assets={assets || []}
        alreadyAddedAssetIds={alreadyAddedAssetIds}
        onSelect={
          assetSelectorMode === 'individual'
            ? handleSelectAssetsForIndividual
            : handleSelectAssetsForGroup
        }
        title={
          assetSelectorMode === 'individual'
            ? '개별 배분에 자산 추가'
            : '그룹에 자산 추가'
        }
        description={
          assetSelectorMode === 'individual'
            ? '플랜에 추가할 보유 자산을 선택하세요.'
            : '그룹에 추가할 보유 자산을 선택하세요.'
        }
      />
    </>
  )
}
