/**
 * 자산 추이 라인 차트 컴포넌트 냥~ 🐱
 */
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKRW, formatDate } from '@/lib/utils'
import type { AssetHistory } from '@/types'

interface AssetTrendChartProps {
  history: AssetHistory[] | undefined
  isLoading: boolean
}

export function AssetTrendChart({ history, isLoading }: AssetTrendChartProps) {
  if (isLoading) {
    return (
      <Card className="h-[400px] animate-pulse">
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="h-full w-full bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!history || history.length === 0) {
    return (
      <Card className="h-[400px]">
        <CardHeader>
          <CardTitle>자산 추이</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">
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

  return (
    <Card className="h-[400px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📈 자산 추이
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatKRW(value),
                name === 'totalValue' ? '총 자산' : '투자 원금',
              ]}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend
              formatter={(value) =>
                value === 'totalValue' ? '총 자산' : '투자 원금'
              }
            />
            <Line
              type="monotone"
              dataKey="totalValue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="totalPrincipal"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
