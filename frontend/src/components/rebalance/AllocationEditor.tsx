/**
 * 목표 배분 편집기 컴포넌트
 */
import { useState, useMemo } from 'react'
import { Save, AlertCircle } from 'lucide-react'
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
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAssets } from '@/hooks/useAssets'
import { useSaveAllocations, useUpdatePlan } from '@/hooks/useRebalance'
import { formatKRW } from '@/lib/utils'
import type { RebalancePlan, PlanAllocationCreate } from '@/types'

interface AllocationEditorProps {
  plan: RebalancePlan
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AllocationEditor({ plan, open, onOpenChange }: AllocationEditorProps) {
  const { data: assets } = useAssets()
  const saveAllocationsMutation = useSaveAllocations()
  const updatePlanMutation = useUpdatePlan()

  // 배분 목표 상태 (asset_id -> percentage)
  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    plan.allocations?.forEach((alloc) => {
      if (alloc.asset_id) {
        initial[alloc.asset_id] = alloc.target_percentage
      }
    })
    return initial
  })

  // 플랜 이름/설명 편집
  const [planName, setPlanName] = useState(plan.name)
  const [planDescription, setPlanDescription] = useState(plan.description || '')

  // 총합 계산
  const totalPercentage = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0)
  }, [allocations])

  const isValid = Math.abs(totalPercentage - 100) < 0.1

  const handleAllocationChange = (assetId: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setAllocations((prev) => ({
      ...prev,
      [assetId]: Math.min(100, Math.max(0, numValue)),
    }))
  }

  const handleSave = async () => {
    // 플랜 정보 업데이트
    if (planName !== plan.name || planDescription !== (plan.description || '')) {
      await updatePlanMutation.mutateAsync({
        planId: plan.id,
        data: {
          name: planName,
          description: planDescription || undefined,
        },
      })
    }

    // 배분 설정 저장
    const allocationData: PlanAllocationCreate[] = Object.entries(allocations)
      .filter(([_, percentage]) => percentage > 0)
      .map(([assetId, percentage]) => ({
        asset_id: assetId,
        target_percentage: percentage,
      }))

    await saveAllocationsMutation.mutateAsync({
      planId: plan.id,
      allocations: allocationData,
    })

    onOpenChange(false)
  }

  // 균등 배분
  const handleEqualDistribution = () => {
    if (!assets || assets.length === 0) return
    const equalPct = Math.round((100 / assets.length) * 10) / 10
    const newAllocations: Record<string, number> = {}
    assets.forEach((asset) => {
      newAllocations[asset.id] = equalPct
    })
    setAllocations(newAllocations)
  }

  // 현재 비율로 초기화
  const handleCurrentRatio = () => {
    if (!assets || assets.length === 0) return
    const totalValue = assets.reduce((sum, a) => sum + (a.market_value || 0), 0)
    if (totalValue === 0) return

    const newAllocations: Record<string, number> = {}
    assets.forEach((asset) => {
      const pct = ((asset.market_value || 0) / totalValue) * 100
      newAllocations[asset.id] = Math.round(pct * 10) / 10
    })
    setAllocations(newAllocations)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>플랜 편집: {plan.name}</DialogTitle>
          <DialogDescription>
            각 자산별 목표 비율을 설정합니다. 합계가 100%가 되어야 합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
          </div>

          <Separator />

          {/* 빠른 설정 버튼 */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleEqualDistribution}>
              균등 배분
            </Button>
            <Button variant="outline" size="sm" onClick={handleCurrentRatio}>
              현재 비율 적용
            </Button>
          </div>

          {/* 자산별 배분 설정 */}
          <div className="space-y-4">
            {assets?.map((asset) => {
              const currentPct = allocations[asset.id] || 0
              return (
                <div key={asset.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: asset.category_color || '#6b7280' }}
                      />
                      <span className="font-medium">{asset.name}</span>
                      {asset.ticker && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {asset.ticker}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {formatKRW(asset.market_value || 0)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-20 h-8 text-right"
                          value={allocations[asset.id] || ''}
                          onChange={(e) =>
                            handleAllocationChange(asset.id, e.target.value)
                          }
                        />
                        <span className="text-sm">%</span>
                      </div>
                    </div>
                  </div>
                  <Progress value={currentPct} className="h-1.5" />
                </div>
              )
            })}
          </div>

          <Separator />

          {/* 합계 표시 */}
          <div className="flex items-center justify-between">
            <span className="font-medium">목표 비율 합계</span>
            <span
              className={`font-bold ${
                isValid ? 'text-green-500' : 'text-destructive'
              }`}
            >
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
          <Button
            onClick={handleSave}
            disabled={!isValid || saveAllocationsMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveAllocationsMutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
