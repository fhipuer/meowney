/**
 * 자산별 배분 차트 컴포넌트 냥~ 🐱
 * 개별 자산 항목을 시각화 (유형별 색상 + 아이콘)
 */
import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn, formatKRW, maskValue, PRIVACY_MASK } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import {
  TrendingUp,
  BarChart3,
  Layers,
  Landmark,
  Coins,
  Package,
  Building,
  Bitcoin,
  Banknote,
  CircleDollarSign,
  type LucideIcon,
} from 'lucide-react'
import type { Asset } from '@/types'

// 자산 유형별 아이콘 & 색상 매핑 냥~ (AssetList와 동일)
const ASSET_TYPE_CONFIG: Record<string, {
  icon: LucideIcon
  label: string
  bgColor: string
  chartColors: string[]  // 명도 차이가 있는 색상들
}> = {
  stock: {
    icon: TrendingUp,
    label: '주식',
    bgColor: 'bg-blue-500',
    chartColors: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe']
  },
  etf: {
    icon: BarChart3,
    label: 'ETF',
    bgColor: 'bg-indigo-500',
    chartColors: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe']
  },
  fund: {
    icon: Layers,
    label: '펀드',
    bgColor: 'bg-violet-500',
    chartColors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']
  },
  bond: {
    icon: Landmark,
    label: '채권',
    bgColor: 'bg-amber-500',
    chartColors: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a']
  },
  gold: {
    icon: Coins,
    label: '금',
    bgColor: 'bg-yellow-500',
    chartColors: ['#eab308', '#facc15', '#fde047', '#fef08a']
  },
  commodity: {
    icon: Package,
    label: '원자재',
    bgColor: 'bg-orange-500',
    chartColors: ['#f97316', '#fb923c', '#fdba74', '#fed7aa']
  },
  real_estate: {
    icon: Building,
    label: '부동산',
    bgColor: 'bg-emerald-500',
    chartColors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
  },
  crypto: {
    icon: Bitcoin,
    label: '암호화폐',
    bgColor: 'bg-purple-500',
    chartColors: ['#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff']
  },
  cash: {
    icon: Banknote,
    label: '현금',
    bgColor: 'bg-green-500',
    chartColors: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0']
  },
  other: {
    icon: CircleDollarSign,
    label: '기타',
    bgColor: 'bg-gray-500',
    chartColors: ['#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb']
  },
}

interface ChartDataItem {
  id: string
  name: string
  value: number
  percentage: number
  color: string
  assetType: string
}

interface AssetAllocationChartProps {
  assets: Asset[]
  className?: string
}

export function AssetAllocationChart({ assets, className }: AssetAllocationChartProps) {
  const { isPrivacyMode } = useStore()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // 개별 자산 데이터 생성 냥~
  const chartData = useMemo(() => {
    // 유형별 인덱스 카운터 (색상 명도 구분용)
    const typeIndexCounter: Record<string, number> = {}

    const total = assets.reduce((sum, asset) => sum + (Number(asset.market_value) || 0), 0)

    return assets
      .filter(asset => (Number(asset.market_value) || 0) > 0)
      .map((asset): ChartDataItem => {
        const assetType = asset.asset_type || 'other'
        const config = ASSET_TYPE_CONFIG[assetType] || ASSET_TYPE_CONFIG.other

        // 같은 유형 내에서 색상 인덱스 증가
        typeIndexCounter[assetType] = (typeIndexCounter[assetType] || 0)
        const colorIndex = typeIndexCounter[assetType] % config.chartColors.length
        typeIndexCounter[assetType]++

        const value = Number(asset.market_value) || 0

        return {
          id: asset.id,
          name: asset.name,
          value,
          percentage: total > 0 ? (value / total) * 100 : 0,
          color: config.chartColors[colorIndex],
          assetType,
        }
      })
  }, [assets])

  // 빈 데이터
  if (chartData.length === 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle>자산별 배분</CardTitle>
          <CardDescription>개별 자산 비율</CardDescription>
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
        <CardTitle>자산별 배분</CardTitle>
        <CardDescription>개별 자산 비율</CardDescription>
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
                paddingAngle={1}
                animationDuration={300}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.id}`}
                    fill={entry.color}
                    stroke="transparent"
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.3}
                    style={{ transition: 'opacity 0.2s ease' }}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props) => {
                  const percentage = props?.payload?.percentage
                  return [
                    isPrivacyMode ? PRIVACY_MASK : `${formatKRW(value)} (${percentage?.toFixed(1) ?? '0.0'}%)`,
                    name,
                  ]
                }}
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

        {/* 카드형 범례 (유형 아이콘 + 자산명 + 금액 + 비율) */}
        <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
          {chartData.map((item, index) => {
            const config = ASSET_TYPE_CONFIG[item.assetType] || ASSET_TYPE_CONFIG.other
            const IconComponent = config.icon

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg transition-all cursor-default",
                  activeIndex === index
                    ? "bg-accent ring-1 ring-accent-foreground/20"
                    : "bg-muted/50 hover:bg-muted/70"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* 유형 아이콘 */}
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-white flex-shrink-0",
                      config.bgColor
                    )}
                    title={config.label}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                  </div>
                  {/* 색상 도트 */}
                  <div
                    className="h-3 w-3 rounded-full shadow-sm flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  {/* 자산명 */}
                  <span className="font-medium text-sm truncate">{item.name}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="font-semibold text-sm">
                    {maskValue(formatKRW(item.value), isPrivacyMode)}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
