/**
 * 국가별 자산 비중 차트 컴포넌트 냥~ 🐱
 * USD(해외) vs KRW(국내) 자산 비율 시각화
 */
import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn, formatKRW, maskValue, PRIVACY_MASK } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { Asset } from '@/types'

// 국가별 고정 색상
const COUNTRY_COLORS = {
  usd: '#3b82f6', // 파란색 (해외)
  krw: '#ef4444', // 빨간색 (국내)
}

interface CountryRatioChartProps {
  assets: Asset[]
  className?: string
}

export function CountryRatioChart({ assets, className }: CountryRatioChartProps) {
  const { isPrivacyMode } = useStore()

  // 국가별 합계 계산
  const countryData = useMemo(() => {
    return assets.reduce(
      (acc, asset) => {
        // API에서 문자열로 반환될 수 있으므로 Number로 변환 냥~
        const value = Number(asset.market_value) || 0
        if (asset.currency === 'USD') {
          acc.usd += value
        } else {
          acc.krw += value
        }
        return acc
      },
      { usd: 0, krw: 0 }
    )
  }, [assets])

  // 차트 데이터 (비율 포함)
  const chartData = useMemo(() => {
    const total = countryData.usd + countryData.krw
    return [
      {
        name: '해외 (USD)',
        value: countryData.usd,
        percentage: total > 0 ? (countryData.usd / total) * 100 : 0,
        color: COUNTRY_COLORS.usd,
      },
      {
        name: '국내 (KRW)',
        value: countryData.krw,
        percentage: total > 0 ? (countryData.krw / total) * 100 : 0,
        color: COUNTRY_COLORS.krw,
      },
    ].filter((item) => item.value > 0)
  }, [countryData])

  // 빈 데이터
  if (chartData.length === 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle>국가별 자산 비중</CardTitle>
          <CardDescription>해외/국내 자산 비율</CardDescription>
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
        <CardTitle>국가별 자산 비중</CardTitle>
        <CardDescription>해외/국내 자산 비율</CardDescription>
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
        <div className="mt-4 space-y-2">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-sm">{item.name}</span>
              </div>
              <div className="text-right">
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