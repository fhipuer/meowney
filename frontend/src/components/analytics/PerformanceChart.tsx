/**
 * 수익률 추이 및 벤치마크 비교 차트 냥~ 🐱
 * 내 포트폴리오 vs KOSPI vs S&P 500
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { dashboardApi } from '@/lib/api'
import { useAssetHistory } from '@/hooks/useDashboard'
import { formatDate, formatPercent, getProfitClass } from '@/lib/utils'
import type { PerformanceMetrics } from '@/types'

const PERIOD_OPTIONS = [
  { value: '1M', label: '1개월', days: 30 },
  { value: '3M', label: '3개월', days: 90 },
  { value: '6M', label: '6개월', days: 180 },
  { value: 'YTD', label: 'YTD', days: 0 },
  { value: '1Y', label: '1년', days: 365 },
]

// 벤치마크 설정 (향후 확장 가능)
// const BENCHMARK_OPTIONS = [
//   { ticker: '^KS11', name: 'KOSPI', color: '#ef4444' },
//   { ticker: '^GSPC', name: 'S&P 500', color: '#3b82f6' },
// ]

export function PerformanceChart() {
  const [period, setPeriod] = useState('3M')
  const [showKospi, setShowKospi] = useState(true)
  const [showSp500, setShowSp500] = useState(true)

  // 기간에 따른 일수 계산
  const days = PERIOD_OPTIONS.find((p) => p.value === period)?.days || 90

  // 내 포트폴리오 히스토리
  const { data: history } = useAssetHistory(days || 90)

  // 벤치마크 데이터
  const { data: kospiData } = useQuery({
    queryKey: ['benchmark', '^KS11', period],
    queryFn: () => dashboardApi.getBenchmark('^KS11', period),
    enabled: showKospi,
    staleTime: 10 * 60 * 1000,
  })

  const { data: sp500Data } = useQuery({
    queryKey: ['benchmark', '^GSPC', period],
    queryFn: () => dashboardApi.getBenchmark('^GSPC', period),
    enabled: showSp500,
    staleTime: 10 * 60 * 1000,
  })

  // 성과 지표
  const { data: performanceMetrics } = useQuery<PerformanceMetrics>({
    queryKey: ['performance'],
    queryFn: () => dashboardApi.getPerformance(),
    staleTime: 5 * 60 * 1000,
  })

  // 차트 데이터 병합
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return []

    // 포트폴리오 수익률 계산
    const firstValue = history[0]?.total_value || 1
    const portfolioData = history.map((item) => ({
      date: formatDate(item.snapshot_date),
      rawDate: item.snapshot_date,
      portfolio: ((item.total_value - firstValue) / firstValue) * 100,
    }))

    // 벤치마크 데이터 병합
    return portfolioData.map((item) => {
      const result: Record<string, unknown> = { ...item }

      if (kospiData?.data) {
        const kospiItem = kospiData.data.find(
          (k) => k.date === item.rawDate
        )
        if (kospiItem) {
          result.kospi = kospiItem.return_rate
        }
      }

      if (sp500Data?.data) {
        const sp500Item = sp500Data.data.find(
          (s) => s.date === item.rawDate
        )
        if (sp500Item) {
          result.sp500 = sp500Item.return_rate
        }
      }

      return result
    })
  }, [history, kospiData, sp500Data])

  // 현재 기간 수익률 (향후 사이드바 등에서 활용 가능)
  // const currentPeriodReturn = useMemo(() => {
  //   if (!performanceMetrics?.period_returns) return null
  //   return performanceMetrics.period_returns.find((p: { period: string }) => p.period === period)
  // }, [performanceMetrics, period])

  return (
    <div className="space-y-6">
      {/* 성과 지표 카드 */}
      {performanceMetrics && performanceMetrics.period_returns && (
        <div className="grid gap-4 md:grid-cols-4">
          {performanceMetrics.period_returns.map((pr: { period: string; return_rate: number | null }) => (
            <Card key={pr.period}>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">{pr.period} 수익률</p>
                <p className={`text-2xl font-bold ${getProfitClass(pr.return_rate || 0)}`}>
                  {pr.return_rate !== null ? formatPercent(pr.return_rate) : '-'}
                </p>
              </CardContent>
            </Card>
          ))}
          {performanceMetrics.max_drawdown !== null && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">MDD (최대 낙폭)</p>
                <p className="text-2xl font-bold text-blue-500">
                  -{performanceMetrics.max_drawdown.toFixed(2)}%
                </p>
                {performanceMetrics.max_drawdown_period && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {performanceMetrics.max_drawdown_period}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 차트 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>수익률 추이</CardTitle>
            <CardDescription>내 포트폴리오 vs 벤치마크</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showKospi}
                onChange={(e) => setShowKospi(e.target.checked)}
                className="rounded"
              />
              <span className="text-red-500">KOSPI</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showSp500}
                onChange={(e) => setShowSp500(e.target.checked)}
                className="rounded"
              />
              <span className="text-blue-500">S&P 500</span>
            </label>
          </div>

          <div className="h-[400px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        portfolio: '내 포트폴리오',
                        kospi: 'KOSPI',
                        sp500: 'S&P 500',
                      }
                      return [`${value.toFixed(2)}%`, labels[name] || name]
                    }}
                    labelFormatter={(label) => `📅 ${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        portfolio: '내 포트폴리오',
                        kospi: 'KOSPI',
                        sp500: 'S&P 500',
                      }
                      return labels[value] || value
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="portfolio"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  {showKospi && (
                    <Line
                      type="monotone"
                      dataKey="kospi"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  )}
                  {showSp500 && (
                    <Line
                      type="monotone"
                      dataKey="sp500"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">
                  아직 히스토리 데이터가 없습니다.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
