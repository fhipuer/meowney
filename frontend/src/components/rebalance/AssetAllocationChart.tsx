/**
 * 카테고리별 자산 배분 차트 컴포넌트 냥~ 🐱
 * 자산을 카테고리별로 그룹화하여 시각화
 */
import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn, formatKRW, maskValue, PRIVACY_MASK } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { Asset } from '@/types'

// 색상 팔레트 (PortfolioDonut과 동일)
const COLORS = [
  '#6366f1', // 인디고
  '#8b5cf6', // 보라
  '#ec4899', // 핑크
  '#f43f5e', // 로즈
  '#f97316', // 오렌지
  '#eab308', // 노랑
  '#22c55e', // 초록
  '#14b8a6', // 틸
  '#06b6d4', // 시안
  '#3b82f6', // 블루
]

interface ChartDataItem {
  name: string
  value: number
  percentage: number
  color: string
}

interface AssetAllocationChartProps {
  assets: Asset[]
  className?: string
}

export function AssetAllocationChart({ assets, className }: AssetAllocationChartProps) {
  const { isPrivacyMode } = useStore()

  // 카테고리별 그룹화 및 비율 계산
  const chartData = useMemo(() => {
    // 카테고리별 합계 (category_name 없으면 asset_type 사용 냥~)
    const grouped = assets.reduce(
      (acc, asset) => {
        const category = asset.category_name || asset.asset_type || '기타'
        // API에서 문자열로 반환될 수 있으므로 Number로 변환 냥~
        const value = Number(asset.market_value) || 0

        if (!acc[category]) {
          acc[category] = {
            name: category,
            value: 0,
            color: asset.category_color || null,
          }
        }
        acc[category].value += value
        return acc
      },
      {} as Record<string, { name: string; value: number; color: string | null }>
    )

    // 배열로 변환 및 정렬
    const result = Object.values(grouped)
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)

    // 총합 및 비율 계산
    const total = result.reduce((sum, item) => sum + item.value, 0)

    return result.map((item, index): ChartDataItem => ({
      name: item.name,
      value: item.value,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
      color: item.color || COLORS[index % COLORS.length],
    }))
  }, [assets])

  // 빈 데이터
  if (chartData.length === 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle>카테고리별 배분</CardTitle>
          <CardDescription>자산 유형별 비율</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="w-24 h-24 rounded-full border-4 border-dashed border-muted flex items-center justify-center">
            <span className="text-muted-foreground text-sm">데이터 없음</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">자산을 추가해주세요</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle>카테고리별 배분</CardTitle>
        <CardDescription>자산 유형별 비율</CardDescription>
      </CardHeader>
      <CardContent>
        {/* 차트 영역 */}
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                animationDuration={300}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  isPrivacyMode ? PRIVACY_MASK : formatKRW(value),
                  name,
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 카드형 범례 (이름 + 금액 + 비율) */}
        <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full shadow-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-sm truncate">{item.name}</span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="font-semibold text-sm">
                  {maskValue(formatKRW(item.value), isPrivacyMode)}
                </div>
                <div className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
