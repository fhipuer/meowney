/**
 * 포트폴리오 도넛 차트 컴포넌트 냥~ 🐱
 * 글래스모피즘 & 애니메이션 적용
 * 플랜 기반 배분 표시 지원
 */
import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKRW, cn, maskValue, PRIVACY_MASK } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { usePlans } from '@/hooks/useRebalance'
import { useAssets } from '@/hooks/useAssets'
import { useExchangeRate } from '@/hooks/useDashboard'
import type { CategoryAllocation, Asset, RebalancePlan } from '@/types'

// 플랜 기반 차트 데이터 항목
interface PlanChartItem {
  name: string
  value: number
  percentage: number
  color: string
  isGroup?: boolean
}

// 색상 팔레트 (플랜 배분용)
const PLAN_COLORS = [
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

interface PortfolioDonutProps {
  allocations: CategoryAllocation[] | undefined
  isLoading: boolean
}

// 자산 매칭 함수
function matchItemToAsset(
  item: { asset_id?: string | null; ticker?: string | null; alias?: string | null },
  assets: Asset[]
): Asset | undefined {
  if (!assets || assets.length === 0) return undefined

  if (item.asset_id) {
    const matched = assets.find((a) => a.id === item.asset_id)
    if (matched) return matched
  }

  if (item.ticker) {
    const matched = assets.find((a) => a.ticker === item.ticker)
    if (matched) return matched
  }

  if (item.alias) {
    const aliasLower = item.alias.toLowerCase()
    const matched = assets.find((a) => {
      const nameLower = a.name.toLowerCase()
      return aliasLower.includes(nameLower) || nameLower.includes(aliasLower)
    })
    if (matched) return matched
  }

  return undefined
}

// 안전한 숫자 변환 헬퍼
function safeNumber(value: unknown): number {
  const num = Number(value)
  return isFinite(num) ? num : 0
}

// 플랜 기반 차트 데이터 생성
function buildChartFromPlan(
  plan: RebalancePlan,
  assets: Asset[],
  exchangeRate: number
): PlanChartItem[] {
  const result: PlanChartItem[] = []
  let totalValue = 0
  const matchedAssetIds = new Set<string>()
  const safeRate = safeNumber(exchangeRate) || 1300

  // 1. 개별 배분 항목 처리
  ;(plan.allocations || []).forEach((alloc, idx) => {
    const matched = matchItemToAsset(alloc, assets)
    let value = 0

    if (matched) {
      matchedAssetIds.add(matched.id)
      value = safeNumber(matched.market_value)
      if (matched.currency === 'USD') {
        value = value * safeRate
      }
    }

    if (value > 0) {
      result.push({
        name: alloc.display_name || matched?.name || alloc.ticker || alloc.alias || '알 수 없음',
        value,
        percentage: 0,
        color: PLAN_COLORS[idx % PLAN_COLORS.length],
      })
      totalValue += value
    }
  })

  // 2. 그룹 배분 항목 처리
  ;(plan.groups || []).forEach((group, gIdx) => {
    let groupValue = 0

    ;(group.items || []).forEach((item) => {
      const matched = matchItemToAsset(item, assets)
      if (matched) {
        matchedAssetIds.add(matched.id)
        let itemValue = safeNumber(matched.market_value)
        if (matched.currency === 'USD') {
          itemValue = itemValue * safeRate
        }
        groupValue += itemValue
      }
    })

    // 그룹은 값이 0이어도 일단 추가 (매칭 추적용)
    result.push({
      name: group.name,
      value: groupValue,
      percentage: 0,
      color: PLAN_COLORS[(result.length + gIdx) % PLAN_COLORS.length],
      isGroup: true,
    })
    totalValue += groupValue
  })

  // 3. 플랜에 포함되지 않은 자산 처리 ("기타")
  let otherValue = 0
  assets.forEach((asset) => {
    if (!matchedAssetIds.has(asset.id)) {
      let value = safeNumber(asset.market_value)
      if (asset.currency === 'USD') {
        value = value * safeRate
      }
      otherValue += value
    }
  })

  if (otherValue > 0) {
    result.push({
      name: '기타',
      value: otherValue,
      percentage: 0,
      color: '#6b7280',
    })
    totalValue += otherValue
  }

  // 퍼센티지 계산
  if (totalValue > 0) {
    result.forEach((item) => {
      item.percentage = (item.value / totalValue) * 100
    })
  }

  // 값이 0인 항목 제외
  return result.filter((item) => item.value > 0)
}

export function PortfolioDonut({ allocations, isLoading }: PortfolioDonutProps) {
  const { isPrivacyMode } = useStore()
  const { data: plans } = usePlans()
  const { data: assets } = useAssets()
  const { data: exchangeRateData } = useExchangeRate()

  // 메인 플랜 찾기
  const mainPlan = useMemo(() => {
    return plans?.find((p: RebalancePlan) => p.is_main)
  }, [plans])

  // 차트 데이터 생성 (플랜 기반 또는 카테고리 기반)
  const { chartData, totalValue, usePlanMode } = useMemo(() => {
    const rate = exchangeRateData?.rate || 1300

    // 메인 플랜이 있고, 배분 항목이나 그룹이 있으면 플랜 기반으로 표시
    if (mainPlan && ((mainPlan.allocations && mainPlan.allocations.length > 0) || (mainPlan.groups && mainPlan.groups.length > 0))) {
      const planData = buildChartFromPlan(mainPlan, assets || [], rate)
      // 플랜 데이터가 있으면 사용, 없으면 카테고리 기반으로 폴백 냥~
      if (planData.length > 0) {
        const total = planData.reduce((sum, item) => sum + item.value, 0)
        return { chartData: planData, totalValue: total, usePlanMode: true }
      }
      // 플랜 항목이 매칭 실패한 경우 - 카테고리 기반으로 폴백
    }

    // 카테고리 기반으로 표시 (폴백 포함)
    if (allocations && allocations.length > 0) {
      const catData = allocations.map((alloc) => ({
        name: alloc.category_name,
        value: Number(alloc.market_value),
        percentage: alloc.percentage,
        color: alloc.color,
      }))
      const total = catData.reduce((sum, item) => sum + item.value, 0)
      return { chartData: catData, totalValue: total, usePlanMode: false }
    }

    return { chartData: [], totalValue: 0, usePlanMode: false }
  }, [mainPlan, assets, allocations, exchangeRateData])

  if (isLoading) {
    return (
      <Card className="h-[450px] border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader>
          <div className="h-6 w-32 animate-shimmer rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <div className="h-56 w-56 rounded-full animate-shimmer" />
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card className="h-[450px] border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader>
          <CardTitle>포트폴리오 배분</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <p className="text-muted-foreground">자산을 추가해주세요 냥~ 🐱</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-[450px] border-0 bg-gradient-to-br from-background to-muted/30 overflow-hidden opacity-0 animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          포트폴리오 배분
          {usePlanMode && mainPlan && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {mainPlan.name}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-center gap-4">
          {/* 도넛 차트 - 크기 확대 및 반응형 */}
          <div className="relative w-[220px] h-[220px] md:w-[260px] md:h-[260px] lg:w-[280px] lg:h-[280px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="38%"
                  outerRadius="52%"
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      className="drop-shadow-sm hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name, props) => [
                    isPrivacyMode ? PRIVACY_MASK : formatKRW(value),
                    props.payload.name
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '8px 12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* 중앙 텍스트 - 크기 확대 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs md:text-sm text-muted-foreground">총 자산</span>
              <span className="text-lg md:text-xl lg:text-2xl font-bold">{maskValue(formatKRW(totalValue), isPrivacyMode)}</span>
            </div>
          </div>

          {/* 범례 */}
          <div className="flex-1 pl-2 space-y-1.5 max-h-[280px] overflow-y-auto">
            {chartData.map((item, index) => (
              <div
                key={item.name}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg',
                  'hover:bg-muted/50 transition-colors cursor-default',
                  'opacity-0 animate-slide-in-right'
                )}
                style={{ animationDelay: `${index * 50 + 200}ms` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-3 w-3 rounded-full shadow-sm flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  {(item as PlanChartItem).isGroup && (
                    <span className="text-xs text-muted-foreground">(그룹)</span>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-sm font-semibold">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
