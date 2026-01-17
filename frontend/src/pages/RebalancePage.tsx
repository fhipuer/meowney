/**
 * 리밸런싱 페이지
 * 플랜 기반 자산별 리밸런싱 계산
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, Settings2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePlans, useCalculateRebalance } from '@/hooks/useRebalance'
import { formatKRW, getProfitClass } from '@/lib/utils'

export function RebalancePage() {
  const { data: plans, isLoading: plansLoading } = usePlans()
  const calculateMutation = useCalculateRebalance()

  const [selectedPlanId, setSelectedPlanId] = useState<string>('')

  // 메인 플랜 자동 선택
  const mainPlan = plans?.find((p) => p.is_main)
  const effectivePlanId = selectedPlanId || mainPlan?.id || ''

  const handleCalculate = async () => {
    if (!effectivePlanId) return
    await calculateMutation.mutateAsync(effectivePlanId)
  }

  if (plansLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">리밸런싱</h1>
          <p className="text-muted-foreground">
            목표 비율에 맞게 포트폴리오를 조정합니다.
          </p>
        </div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-40 bg-muted rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-40 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasPlans = plans && plans.length > 0

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">리밸런싱</h1>
          <p className="text-muted-foreground">
            목표 비율에 맞게 포트폴리오를 조정합니다.
          </p>
        </div>
        <Link to="/rebalance/plans">
          <Button variant="outline">
            <Settings2 className="mr-2 h-4 w-4" />
            플랜 설정
          </Button>
        </Link>
      </div>

      {!hasPlans ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              아직 리밸런싱 플랜이 없습니다.
            </p>
            <Link to="/rebalance/plans">
              <Button>
                <Settings2 className="mr-2 h-4 w-4" />
                플랜 만들기
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 플랜 선택 */}
          <Card>
            <CardHeader>
              <CardTitle>리밸런싱 계산</CardTitle>
              <CardDescription>
                플랜을 선택하고 현재 자산과의 차이를 계산합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select
                  value={effectivePlanId}
                  onValueChange={setSelectedPlanId}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="플랜 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                        {plan.is_main && ' (메인)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleCalculate}
                  disabled={!effectivePlanId || calculateMutation.isPending}
                >
                  {calculateMutation.isPending ? '계산 중...' : '리밸런싱 계산'}
                </Button>
              </div>

              {!effectivePlanId && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    플랜을 선택하거나 메인 플랜을 설정해주세요.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* 계산 결과 */}
          {calculateMutation.data && (
            <Card>
              <CardHeader>
                <CardTitle>리밸런싱 제안</CardTitle>
                <CardDescription>
                  플랜: {calculateMutation.data.plan_name} | 총 자산: {formatKRW(calculateMutation.data.total_value)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(calculateMutation.data.suggestions?.length ?? 0) === 0 &&
                   (calculateMutation.data.group_suggestions?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      플랜에 목표 배분이 설정되지 않았습니다.
                    </p>
                  ) : (
                    <>
                      {/* 개별 배분 제안 */}
                      {calculateMutation.data.suggestions && calculateMutation.data.suggestions.length > 0 && (
                        <>
                          <h4 className="font-semibold text-sm text-muted-foreground mb-2">개별 배분</h4>
                          {calculateMutation.data.suggestions.map((suggestion, index) => {
                            const isBuy = suggestion.suggested_amount > 0
                            const isHold = Math.abs(suggestion.difference_percentage) < 0.5

                            return (
                              <div
                                key={`suggestion-${index}`}
                                className="flex items-center justify-between p-4 border rounded-lg"
                              >
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {suggestion.asset_name}
                                    {suggestion.ticker && (
                                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                        {suggestion.ticker}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    현재: {suggestion.current_percentage.toFixed(1)}% → 목표: {suggestion.target_percentage.toFixed(1)}%
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    평가금액: {formatKRW(suggestion.current_value)}
                                  </div>
                                </div>

                                <div className="text-right">
                                  {isHold ? (
                                    <div className="text-muted-foreground">유지</div>
                                  ) : (
                                    <>
                                      <div
                                        className={`flex items-center gap-1 font-bold ${
                                          isBuy ? 'text-red-500' : 'text-blue-500'
                                        }`}
                                      >
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
                                      {suggestion.suggested_quantity && (
                                        <div className="text-xs text-muted-foreground">
                                          약 {Math.abs(suggestion.suggested_quantity).toFixed(2)}주
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )}

                      {/* 그룹 배분 제안 */}
                      {calculateMutation.data.group_suggestions && calculateMutation.data.group_suggestions.length > 0 && (
                        <>
                          <h4 className="font-semibold text-sm text-muted-foreground mb-2 mt-4">그룹 배분</h4>
                          {calculateMutation.data.group_suggestions.map((groupSuggestion, index) => {
                            const diff = (groupSuggestion.target_percentage - (groupSuggestion.current_percentage ?? 0))
                            const isOverweight = diff < -0.5
                            const isUnderweight = diff > 0.5
                            const isBalanced = !isOverweight && !isUnderweight

                            return (
                              <div
                                key={`group-${index}`}
                                className="flex items-center justify-between p-4 border rounded-lg"
                              >
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    <span className="text-primary">◆</span>
                                    {groupSuggestion.group_name}
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                      그룹
                                    </span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    현재: {(groupSuggestion.current_percentage ?? 0).toFixed(1)}% → 목표: {groupSuggestion.target_percentage.toFixed(1)}%
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    평가금액: {formatKRW(groupSuggestion.current_value ?? 0)}
                                  </div>
                                </div>

                                <div className="text-right">
                                  {isBalanced ? (
                                    <div className="text-muted-foreground">균형</div>
                                  ) : (
                                    <>
                                      <div
                                        className={`flex items-center gap-1 font-bold ${
                                          isUnderweight ? 'text-red-500' : 'text-blue-500'
                                        }`}
                                      >
                                        {isUnderweight ? (
                                          <>
                                            <TrendingUp className="h-4 w-4" />
                                            비중 확대
                                          </>
                                        ) : (
                                          <>
                                            <TrendingDown className="h-4 w-4" />
                                            비중 축소
                                          </>
                                        )}
                                      </div>
                                      <div className={diff >= 0 ? 'text-red-500' : 'text-blue-500'}>
                                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%p
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
