/**
 * 포트폴리오 도넛 차트 컴포넌트 냥~ 🐱
 * 글래스모피즘 & 애니메이션 적용
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKRW, cn } from '@/lib/utils'
import type { CategoryAllocation } from '@/types'

interface PortfolioDonutProps {
  allocations: CategoryAllocation[] | undefined
  isLoading: boolean
}

export function PortfolioDonut({ allocations, isLoading }: PortfolioDonutProps) {
  if (isLoading) {
    return (
      <Card className="h-[400px] border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader>
          <div className="h-6 w-32 animate-shimmer rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="h-48 w-48 rounded-full animate-shimmer" />
        </CardContent>
      </Card>
    )
  }

  if (!allocations || allocations.length === 0) {
    return (
      <Card className="h-[400px] border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader>
          <CardTitle>포트폴리오 배분</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">자산을 추가해주세요 냥~ 🐱</p>
        </CardContent>
      </Card>
    )
  }

  const chartData = allocations.map((alloc) => ({
    name: alloc.category_name,
    value: Number(alloc.market_value),
    percentage: alloc.percentage,
    color: alloc.color,
  }))

  // 총합 계산
  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card className="h-[400px] border-0 bg-gradient-to-br from-background to-muted/30 overflow-hidden opacity-0 animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          포트폴리오 배분
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-center">
          {/* 도넛 차트 */}
          <div className="relative w-[200px] h-[200px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
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
                    formatKRW(value),
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
            {/* 중앙 텍스트 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-muted-foreground">총 자산</span>
              <span className="text-lg font-bold">{formatKRW(totalValue)}</span>
            </div>
          </div>

          {/* 범례 */}
          <div className="flex-1 pl-4 space-y-2">
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
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="text-right">
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
