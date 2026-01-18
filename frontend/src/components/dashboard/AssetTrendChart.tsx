/**
 * 자산 추이 라인 차트 컴포넌트 냥~ 🐱
 * v0.6.1: 벤치마크 제거, 투자원금 표시 개선
 */
import { useState, useMemo } from 'react'
import {
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKRW, maskValue, PRIVACY_MASK, cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { PeriodSelector, type Period } from './PeriodSelector'
import { useAssetHistoryByPeriod } from '@/hooks/useDashboard'

interface AssetTrendChartProps {
  portfolioId?: string
}

export function AssetTrendChart({ portfolioId }: AssetTrendChartProps) {
  const { isPrivacyMode } = useStore()
  const [period, setPeriod] = useState<Period>('1M')

  // 자산 히스토리 조회
  const { data: history, isLoading: historyLoading } = useAssetHistoryByPeriod(period, portfolioId)

  // X축 레이블 포맷 (기간에 따라 조정)
  const formatXAxisLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    if (period === '1W' || period === '1M') {
      return `${date.getMonth() + 1}/${date.getDate()}`
    }
    return `${date.getMonth() + 1}월`
  }

  // 차트 데이터 생성
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return []

    // 날짜순 정렬 (오래된 것부터)
    const sorted = [...history].sort(
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    )

    return sorted.map((item) => ({
      date: item.snapshot_date,
      dateLabel: formatXAxisLabel(item.snapshot_date),
      totalValue: Number(item.total_value),
      totalPrincipal: Number(item.total_principal),
      profitRate: item.profit_rate ?? 0,
    }))
  }, [history, period])

  // 최근 변화 계산
  const { change, changePercent, isPositive } = useMemo(() => {
    if (chartData.length < 2) {
      return { change: 0, changePercent: 0, isPositive: true }
    }
    const first = chartData[0]?.totalValue as number || 0
    const current = chartData[chartData.length - 1]?.totalValue as number || 0
    const diff = current - first
    const pct = first > 0 ? (diff / first) * 100 : 0
    return {
      change: diff,
      changePercent: pct,
      isPositive: diff >= 0,
    }
  }, [chartData])

  if (historyLoading) {
    return (
      <Card className="h-[450px] border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader>
          <div className="h-6 w-32 animate-shimmer rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <div className="h-full w-full animate-shimmer rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!history || history.length === 0) {
    return (
      <Card className="h-[450px] border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>자산 추이</CardTitle>
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-muted-foreground text-center">
            아직 히스토리가 없다옹! 🐱<br />
            <span className="text-xs">매일 밤 11시에 자동 저장됩니다~</span>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="h-[450px] border-0 bg-gradient-to-br from-background to-muted/30 opacity-0 animate-slide-up"
      style={{ animationDelay: '100ms' }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">자산 추이</CardTitle>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={cn('text-sm font-semibold', isPositive ? 'text-red-500' : 'text-blue-500')}>
                {maskValue(`${isPositive ? '+' : ''}${formatKRW(change)}`, isPrivacyMode)}
              </div>
              <div className={cn('text-xs', isPositive ? 'text-red-500/70' : 'text-blue-500/70')}>
                {isPositive ? '+' : ''}{changePercent.toFixed(2)}% ({period})
              </div>
            </div>
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              {/* 수익 영역 그라데이션 (빨간색) */}
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(239, 68, 68, 0.3)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="rgba(239, 68, 68, 0)" stopOpacity={0} />
              </linearGradient>
              {/* 손실 영역 그라데이션 (파란색) */}
              <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(59, 130, 246, 0.3)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="rgba(59, 130, 246, 0)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              dy={10}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="value"
              tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'totalValue') {
                  return [isPrivacyMode ? PRIVACY_MASK : formatKRW(value), '총 자산']
                }
                if (name === 'totalPrincipal') {
                  return [isPrivacyMode ? PRIVACY_MASK : formatKRW(value), '투자 원금']
                }
                return [value, name]
              }}
              labelFormatter={(label) => label}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                padding: '8px 12px',
              }}
            />
            {/* 투자원금 라인 - 명확한 점선으로 표시 냥~ */}
            <Line
              yAxisId="value"
              type="monotone"
              dataKey="totalPrincipal"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={(props) => {
                const { cx, cy, index } = props
                // 마지막 포인트에만 원형 마커 표시
                if (index === chartData.length - 1) {
                  return (
                    <circle
                      key={`principal-dot-${index}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill="#94a3b8"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  )
                }
                return <g key={`principal-dot-${index}`} />
              }}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                fill: 'hsl(var(--background))',
                stroke: '#94a3b8'
              }}
            />
            {/* 총 자산 영역 - 수익/손실 색상 구분 */}
            <Area
              yAxisId="value"
              type="monotone"
              dataKey="totalValue"
              stroke={isPositive ? '#ef4444' : '#3b82f6'}
              strokeWidth={2}
              fill={isPositive ? 'url(#colorProfit)' : 'url(#colorLoss)'}
              dot={(props) => {
                const { cx, cy, index } = props
                // 마지막 포인트만 표시 냥~
                if (index === chartData.length - 1) {
                  return (
                    <g key={`dot-${index}`}>
                      <circle cx={cx} cy={cy} r={10} fill="rgba(0,0,0,0.1)" />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill={isPositive ? '#ef4444' : '#3b82f6'}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    </g>
                  )
                }
                return <g key={`dot-${index}`} />
              }}
              activeDot={{ r: 6, strokeWidth: 2, fill: 'hsl(var(--background))' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {/* 범례 */}
        <div className="flex items-center justify-center mt-2 gap-6">
          <div className="flex items-center gap-2">
            <div className={cn('h-0.5 w-4 rounded', isPositive ? 'bg-red-500' : 'bg-blue-500')} />
            <span className="text-xs text-muted-foreground">총 자산</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: '#94a3b8' }} />
            <span className="text-xs text-muted-foreground">투자 원금</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
