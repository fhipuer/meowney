/**
 * 자산 추이 라인 차트 컴포넌트 냥~ 🐱
 * 글래스모피즘 & 애니메이션 적용
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKRW, formatDate, maskValue, PRIVACY_MASK } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { AssetHistory } from '@/types'

interface AssetTrendChartProps {
  history: AssetHistory[] | undefined
  isLoading: boolean
}

export function AssetTrendChart({ history, isLoading }: AssetTrendChartProps) {
  const { isPrivacyMode } = useStore()

  if (isLoading) {
    return (
      <Card className="h-[400px] border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader>
          <div className="h-6 w-32 animate-shimmer rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="h-full w-full animate-shimmer rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!history || history.length === 0) {
    return (
      <Card className="h-[400px] border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader>
          <CardTitle>자산 추이</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground text-center">
            아직 히스토리가 없다옹! 🐱<br />
            <span className="text-xs">매일 밤 11시에 자동 저장됩니다~</span>
          </p>
        </CardContent>
      </Card>
    )
  }

  // 날짜순 정렬 (오래된 것부터)
  const chartData = [...history]
    .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
    .map((item) => ({
      date: formatDate(item.snapshot_date),
      totalValue: Number(item.total_value),
      totalPrincipal: Number(item.total_principal),
      profitRate: item.profit_rate ?? 0,
    }))

  // 최근 변화 계산
  const latestValue = chartData[chartData.length - 1]?.totalValue || 0
  const previousValue = chartData[chartData.length - 2]?.totalValue || latestValue
  const change = latestValue - previousValue
  const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0
  const isPositive = change >= 0

  return (
    <Card className="h-[400px] border-0 bg-gradient-to-br from-background to-muted/30 overflow-hidden opacity-0 animate-slide-up" style={{ animationDelay: '100ms' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            자산 추이
          </CardTitle>
          <div className="text-right">
            <div className={`text-sm font-semibold ${isPositive ? 'text-red-500' : 'text-blue-500'}`}>
              {maskValue(`${isPositive ? '+' : ''}${formatKRW(change)}`, isPrivacyMode)}
            </div>
            <div className={`text-xs ${isPositive ? 'text-red-500/70' : 'text-blue-500/70'}`}>
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}% vs 전일
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={290}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                isPrivacyMode ? PRIVACY_MASK : formatKRW(value),
                name === 'totalValue' ? '총 자산' : '투자 원금',
              ]}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                padding: '8px 12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="totalPrincipal"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#colorPrincipal)"
            />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* 범례 */}
        <div className="flex items-center justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 bg-primary rounded" />
            <span className="text-xs text-muted-foreground">총 자산</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" />
            <span className="text-xs text-muted-foreground">투자 원금</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
