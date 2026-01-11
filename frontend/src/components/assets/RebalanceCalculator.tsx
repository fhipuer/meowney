/**
 * 리밸런싱 계산기 컴포넌트 냥~ 🐱
 */
import { useState, useMemo } from 'react'
import { Calculator, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { formatKRW, formatPercent, getProfitClass } from '@/lib/utils'
import { useDashboardSummary } from '@/hooks/useDashboard'
import { useRebalanceCalculation } from '@/hooks/useDashboard'
import type { CategoryAllocation, RebalanceTarget, RebalanceSuggestion } from '@/types'

export function RebalanceCalculator() {
  const { data: summary, isLoading } = useDashboardSummary()
  const rebalanceMutation = useRebalanceCalculation()

  // 목표 비율 상태 (카테고리ID -> 퍼센트)
  const [targetPercentages, setTargetPercentages] = useState<Record<string, number>>({})

  // 현재 배분 정보
  const allocations = summary?.allocations || []

  // 목표 비율 총합
  const totalTargetPercentage = useMemo(() => {
    return Object.values(targetPercentages).reduce((sum, val) => sum + (val || 0), 0)
  }, [targetPercentages])

  // 목표 비율 변경 핸들러
  const handleTargetChange = (categoryId: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setTargetPercentages((prev) => ({
      ...prev,
      [categoryId]: Math.min(100, Math.max(0, numValue)),
    }))
  }

  // 현재 비율로 초기화
  const initializeFromCurrent = () => {
    const initial: Record<string, number> = {}
    allocations.forEach((alloc) => {
      if (alloc.category_id) {
        initial[alloc.category_id] = Math.round(alloc.percentage)
      }
    })
    setTargetPercentages(initial)
  }

  // 리밸런싱 계산 실행
  const calculateRebalance = async () => {
    const targets: RebalanceTarget[] = Object.entries(targetPercentages)
      .filter(([_, percentage]) => percentage > 0)
      .map(([categoryId, percentage]) => ({
        category_id: categoryId,
        target_percentage: percentage,
      }))

    if (targets.length === 0) {
      alert('목표 비율을 입력해주세요 냥! 🐱')
      return
    }

    if (Math.abs(totalTargetPercentage - 100) > 0.1) {
      alert('목표 비율의 합이 100%가 되어야 해요 냥! 🐱')
      return
    }

    await rebalanceMutation.mutateAsync({ targets })
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (allocations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            리밸런싱 계산기
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            먼저 자산을 추가해주세요 냥~ 🐱
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 목표 비율 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            리밸런싱 계산기
          </CardTitle>
          <CardDescription>
            목표 배분 비율을 설정하면 리밸런싱에 필요한 매수/매도 금액을 계산해드려요 냥~
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 현재 배분 현황 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">현재 배분 vs 목표 배분</h4>
              <Button variant="outline" size="sm" onClick={initializeFromCurrent}>
                <RefreshCw className="mr-2 h-3 w-3" />
                현재 비율로 초기화
              </Button>
            </div>

            <div className="space-y-4">
              {allocations.map((alloc) => (
                <div key={alloc.category_id || alloc.category_name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: alloc.color }}
                      />
                      <span className="font-medium">{alloc.category_name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        현재: {alloc.percentage.toFixed(1)}%
                      </span>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`target-${alloc.category_id}`} className="sr-only">
                          목표 비율
                        </Label>
                        <Input
                          id={`target-${alloc.category_id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          className="w-20 h-8 text-right"
                          placeholder="0"
                          value={targetPercentages[alloc.category_id || ''] || ''}
                          onChange={(e) =>
                            handleTargetChange(alloc.category_id || '', e.target.value)
                          }
                        />
                        <span className="text-sm">%</span>
                      </div>
                    </div>
                  </div>

                  {/* 진행 바 비교 */}
                  <div className="space-y-1">
                    <Progress value={alloc.percentage} className="h-2" />
                    {(targetPercentages[alloc.category_id || ''] ?? 0) > 0 && (
                      <Progress
                        value={targetPercentages[alloc.category_id || ''] || 0}
                        className="h-2 opacity-50"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* 총합 확인 */}
          <div className="flex items-center justify-between">
            <span className="font-medium">목표 비율 합계</span>
            <span
              className={`font-bold ${
                Math.abs(totalTargetPercentage - 100) < 0.1
                  ? 'text-green-500'
                  : 'text-destructive'
              }`}
            >
              {totalTargetPercentage.toFixed(1)}%
              {Math.abs(totalTargetPercentage - 100) < 0.1 ? ' ✓' : ' (100%가 되어야 해요!)'}
            </span>
          </div>

          {/* 계산 버튼 */}
          <Button
            onClick={calculateRebalance}
            disabled={rebalanceMutation.isPending || Math.abs(totalTargetPercentage - 100) > 0.1}
            className="w-full"
          >
            {rebalanceMutation.isPending ? '계산 중...' : '리밸런싱 계산하기 🐱'}
          </Button>
        </CardContent>
      </Card>

      {/* 계산 결과 */}
      {rebalanceMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📊 리밸런싱 제안
            </CardTitle>
            <CardDescription>
              총 자산: {formatKRW(rebalanceMutation.data.total_value)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rebalanceMutation.data.suggestions.map((suggestion, index) => (
                <RebalanceSuggestionCard key={index} suggestion={suggestion} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RebalanceSuggestionCard({ suggestion }: { suggestion: RebalanceSuggestion }) {
  const isBuy = suggestion.suggested_amount > 0
  const isHold = Math.abs(suggestion.difference_percentage) < 0.5

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <div className="font-medium">{suggestion.category_name}</div>
        <div className="text-sm text-muted-foreground">
          {suggestion.current_percentage.toFixed(1)}% → {suggestion.target_percentage.toFixed(1)}%
        </div>
      </div>

      <div className="text-right">
        {isHold ? (
          <div className="text-muted-foreground">
            유지 냥~ 🐱
          </div>
        ) : (
          <>
            <div className={`flex items-center gap-1 font-bold ${isBuy ? 'text-red-500' : 'text-blue-500'}`}>
              {isBuy ? (
                <>
                  <TrendingUp className="h-4 w-4" />
                  매수
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4" />
                  매도
                </>
              )}
            </div>
            <div className={getProfitClass(suggestion.suggested_amount)}>
              {formatKRW(Math.abs(suggestion.suggested_amount))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
