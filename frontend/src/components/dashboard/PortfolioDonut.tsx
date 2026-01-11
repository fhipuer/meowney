/**
 * 포트폴리오 도넛 차트 컴포넌트 냥~ 🐱
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKRW } from '@/lib/utils'
import type { CategoryAllocation } from '@/types'

interface PortfolioDonutProps {
  allocations: CategoryAllocation[] | undefined
  isLoading: boolean
}

export function PortfolioDonut({ allocations, isLoading }: PortfolioDonutProps) {
  if (isLoading) {
    return (
      <Card className="h-[400px] animate-pulse">
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="h-48 w-48 rounded-full bg-muted" />
        </CardContent>
      </Card>
    )
  }

  if (!allocations || allocations.length === 0) {
    return (
      <Card className="h-[400px]">
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

  return (
    <Card className="h-[400px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🥧 포트폴리오 배분
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatKRW(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-sm">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
