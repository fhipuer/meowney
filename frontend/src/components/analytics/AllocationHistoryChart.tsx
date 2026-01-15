/**
 * 카테고리별 자산 배분 히스토리 차트 냥~ 🐱
 * Stacked Area Chart로 시간대별 배분 변화 시각화
 */
import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
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
import { useAssetHistory } from '@/hooks/useDashboard'
import { formatKRW, formatDate } from '@/lib/utils'

// 카테고리 색상 매핑
const CATEGORY_COLORS: Record<string, string> = {
  '국내주식': '#ef4444',
  '해외주식': '#3b82f6',
  '현금': '#22c55e',
  '채권': '#f59e0b',
  '암호화폐': '#8b5cf6',
  '기타': '#6b7280',
}

const PERIOD_OPTIONS = [
  { value: '30', label: '최근 1개월' },
  { value: '90', label: '최근 3개월' },
  { value: '180', label: '최근 6개월' },
  { value: '365', label: '최근 1년' },
]

export function AllocationHistoryChart() {
  const [period, setPeriod] = useState('90')
  const { data: history, isLoading } = useAssetHistory(parseInt(period))

  // 차트 데이터 변환
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return []

    return history.map((item) => {
      const categoryBreakdown = item.category_breakdown || {}
      return {
        date: formatDate(item.snapshot_date),
        ...categoryBreakdown,
      }
    })
  }, [history])

  // 카테고리 키 추출
  const categoryKeys = useMemo(() => {
    if (!history || history.length === 0) return []

    const keys = new Set<string>()
    history.forEach((item) => {
      if (item.category_breakdown) {
        Object.keys(item.category_breakdown).forEach((key) => keys.add(key))
      }
    })
    return Array.from(keys)
  }, [history])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-muted-foreground">데이터 불러오는 중...</p>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>자산 배분 변화</CardTitle>
          <CardDescription>카테고리별 자산 배분 추이</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">
            아직 히스토리 데이터가 없습니다.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>자산 배분 변화</CardTitle>
          <CardDescription>카테고리별 자산 배분 추이</CardDescription>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px]">
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
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
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
                tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatKRW(value),
                  name,
                ]}
                labelFormatter={(label) => `📅 ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              {categoryKeys.map((category) => (
                <Area
                  key={category}
                  type="monotone"
                  dataKey={category}
                  stackId="1"
                  stroke={CATEGORY_COLORS[category] || '#6b7280'}
                  fill={CATEGORY_COLORS[category] || '#6b7280'}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
