/**
 * 리밸런싱 분석 차트 냥~ 🐱
 * 목표 vs 현재 배분 비교 및 알림
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { dashboardApi } from '@/lib/api'
import { useDashboardSummary } from '@/hooks/useDashboard'
import { formatKRW, getProfitClass } from '@/lib/utils'
import type { GoalProgressResponse, RebalanceAlertsResponse } from '@/types'

// 카테고리 색상 매핑
const CATEGORY_COLORS: Record<string, string> = {
  '국내주식': '#ef4444',
  '해외주식': '#3b82f6',
  '현금': '#22c55e',
  '채권': '#f59e0b',
  '암호화폐': '#8b5cf6',
  '기타': '#6b7280',
}

export function RebalanceHistoryChart() {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary()

  // 리밸런싱 알림 조회
  const { data: alerts, isLoading: alertsLoading } = useQuery<RebalanceAlertsResponse>({
    queryKey: ['rebalanceAlerts'],
    queryFn: () => dashboardApi.getRebalanceAlerts(undefined, 5.0),
    staleTime: 5 * 60 * 1000,
  })

  // 목표 진행률 조회
  const { data: goalProgress } = useQuery<GoalProgressResponse>({
    queryKey: ['goalProgress'],
    queryFn: () => dashboardApi.getGoalProgress(),
    staleTime: 5 * 60 * 1000,
  })

  // 차트 데이터 (현재 배분 vs 목표 배분)
  const chartData = useMemo(() => {
    if (!summary?.allocations || !alerts) return []

    return summary.allocations.map((allocation) => {
      // 해당 카테고리의 목표 비율 찾기 (알림에서)
      const alert = alerts.alerts.find(
        (a) => a.category_name === allocation.category_name
      )

      return {
        name: allocation.category_name,
        현재: allocation.percentage,
        목표: alert?.target_percentage ?? allocation.percentage,
        color: CATEGORY_COLORS[allocation.category_name] || '#6b7280',
      }
    })
  }, [summary, alerts])

  const isLoading = summaryLoading || alertsLoading

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-muted-foreground">데이터 불러오는 중...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 목표 진행률 */}
      {goalProgress && goalProgress.target_value > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              목표 자산 진행률
              {goalProgress.is_achieved && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
            </CardTitle>
            <CardDescription>
              목표: {formatKRW(goalProgress.target_value)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={Math.min(goalProgress.progress_percentage, 100)} />
              <div className="flex justify-between text-sm">
                <span>
                  현재: <span className="font-medium">{formatKRW(goalProgress.current_value)}</span>
                </span>
                <span className={getProfitClass(goalProgress.progress_percentage - 100)}>
                  {goalProgress.progress_percentage.toFixed(1)}%
                </span>
              </div>
              {!goalProgress.is_achieved && goalProgress.remaining_amount > 0 && (
                <p className="text-sm text-muted-foreground">
                  목표까지 {formatKRW(goalProgress.remaining_amount)} 남았습니다.
                </p>
              )}
              {goalProgress.is_achieved && (
                <p className="text-sm text-green-600">
                  목표를 달성했습니다!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 리밸런싱 알림 */}
      {alerts && alerts.needs_rebalancing && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
              리밸런싱 알림
            </CardTitle>
            <CardDescription>
              목표 대비 {alerts.threshold}% 이상 이탈한 카테고리가 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.alerts.map((alert) => (
                <div
                  key={alert.category_name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{alert.category_name}</p>
                    <p className="text-sm text-muted-foreground">
                      현재: {alert.current_percentage.toFixed(1)}% / 목표: {alert.target_percentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`text-right ${alert.direction === 'over' ? 'text-red-500' : 'text-blue-500'}`}>
                    <p className="font-bold">
                      {alert.direction === 'over' ? '+' : '-'}{alert.deviation.toFixed(1)}%
                    </p>
                    <p className="text-xs">
                      {alert.direction === 'over' ? '초과' : '부족'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {alerts && !alerts.needs_rebalancing && (
        <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-green-700 dark:text-green-500">
              현재 자산 배분이 목표와 일치합니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 배분 비교 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>자산 배분 비교</CardTitle>
          <CardDescription>현재 배분 vs 목표 배분</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`,
                      name === '현재' ? '현재 배분' : '목표 배분',
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="현재"
                    fill="#22c55e"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="목표"
                    fill="#94a3b8"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">
                  자산 데이터가 없습니다. 먼저 자산을 추가해주세요.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 카테고리별 상세 */}
      <Card>
        <CardHeader>
          <CardTitle>카테고리별 상세</CardTitle>
          <CardDescription>각 카테고리의 현재 배분 상태</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summary?.allocations.map((allocation) => (
              <div key={allocation.category_name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: allocation.color }}
                    />
                    <span>{allocation.category_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{allocation.percentage.toFixed(1)}%</span>
                    <span className="text-muted-foreground ml-2">
                      ({formatKRW(allocation.market_value)})
                    </span>
                  </div>
                </div>
                <Progress
                  value={allocation.percentage}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
