/**
 * 플랜별 배분 차트 컴포넌트 냥~ 🐱
 * 메인 플랜의 그룹별 자산 배분을 리더라인 도넛으로 시각화
 */
import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMainPlan } from '@/hooks/useRebalance'

// 그룹별 색상 팔레트
const COLORS = [
  '#6366f1', // 인디고
  '#8b5cf6', // 보라
  '#ec4899', // 핑크
  '#f97316', // 오렌지
  '#eab308', // 노랑
  '#22c55e', // 초록
  '#14b8a6', // 틸
  '#3b82f6', // 블루
]

interface ChartDataItem {
  name: string
  value: number
  percentage: number
  color: string
}

interface PlanAllocationChartProps {
  className?: string
}

// 리더라인 + 라벨 렌더 함수
const renderLabelWithLine = (props: {
  cx: number
  cy: number
  midAngle: number
  outerRadius: number
  name: string
  percent: number
  fill: string
  index: number
}) => {
  const { cx, cy, midAngle, outerRadius, name, percent, fill } = props
  const RADIAN = Math.PI / 180

  // 라인 시작점 (파이 가장자리)
  const startX = cx + outerRadius * Math.cos(-midAngle * RADIAN)
  const startY = cy + outerRadius * Math.sin(-midAngle * RADIAN)

  // 라인 중간점 (바깥쪽으로 연장)
  const midRadius = outerRadius + 15
  const midX = cx + midRadius * Math.cos(-midAngle * RADIAN)
  const midY = cy + midRadius * Math.sin(-midAngle * RADIAN)

  // 라인 끝점 (수평으로 연장)
  const isRight = midX > cx
  const endX = isRight ? midX + 20 : midX - 20

  // 텍스트 위치
  const textX = isRight ? endX + 4 : endX - 4
  const textAnchor = isRight ? 'start' : 'end'

  return (
    <g>
      {/* 리더 라인 */}
      <path
        d={`M${startX},${startY} L${midX},${midY} L${endX},${midY}`}
        stroke={fill}
        fill="none"
        strokeWidth={1.5}
      />
      {/* 라벨 텍스트 */}
      <text
        x={textX}
        y={midY}
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{ fontSize: '11px', fill: 'currentColor' }}
      >
        {name} {(percent * 100).toFixed(1)}%
      </text>
    </g>
  )
}

export function PlanAllocationChart({ className }: PlanAllocationChartProps) {
  const { data: mainPlan, isLoading } = useMainPlan()

  // 차트 데이터 생성 (그룹 + 개별 배분 항목 통합)
  const chartData = useMemo(() => {
    if (!mainPlan) return []

    // 그룹과 개별 배분 항목 통합
    const items: { name: string; current_value: number }[] = []

    // 그룹 추가
    if (mainPlan.groups) {
      mainPlan.groups.forEach((g) => {
        items.push({
          name: g.name,
          current_value: g.current_value || 0,
        })
      })
    }

    // 개별 배분 항목 추가 (display_name 또는 matched_asset_name 사용)
    if (mainPlan.allocations) {
      mainPlan.allocations.forEach((a) => {
        const name = a.display_name || a.matched_asset_name || a.ticker || '미확인'
        items.push({
          name,
          current_value: a.current_value || 0,
        })
      })
    }

    // 전체 합계 계산
    const total = items.reduce((sum, item) => sum + item.current_value, 0)

    return items
      .filter((item) => item.current_value > 0)
      .sort((a, b) => b.current_value - a.current_value)
      .map((item, index): ChartDataItem => ({
        name: item.name,
        value: item.current_value,
        percentage: total > 0 ? (item.current_value / total) * 100 : 0,
        color: COLORS[index % COLORS.length],
      }))
  }, [mainPlan])

  // 로딩 상태
  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle>플랜별 배분</CardTitle>
          <CardDescription>메인 플랜 기준</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="h-[120px] w-[120px] rounded-full bg-muted animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  // 메인 플랜 없음
  if (!mainPlan) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle>플랜별 배분</CardTitle>
          <CardDescription>메인 플랜 기준</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <span className="text-4xl">🐱</span>
          <p className="text-muted-foreground text-sm text-center">
            메인 플랜을 설정해주세요 냥~
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/rebalance/plans">
              <Settings className="h-4 w-4 mr-2" />
              플랜 설정
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // 배분 데이터 없음
  if (chartData.length === 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle>플랜별 배분</CardTitle>
          <CardDescription>{mainPlan.name}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-24 h-24 rounded-full border-4 border-dashed border-muted flex items-center justify-center">
            <span className="text-muted-foreground text-sm">데이터 없음</span>
          </div>
          <p className="text-muted-foreground text-sm text-center">
            플랜에 자산을 매칭해주세요
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle>플랜별 배분</CardTitle>
        <CardDescription>{mainPlan.name}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* 차트 영역 */}
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                paddingAngle={2}
                animationDuration={300}
                animationEasing="ease-out"
                label={renderLabelWithLine}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
