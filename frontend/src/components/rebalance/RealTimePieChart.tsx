/**
 * 실시간 비율 시각화 파이차트 컴포넌트 냥~
 * 플랜 편집 시 목표 비율 변경을 즉시 반영
 */
import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// 차트 색상 팔레트 (기존 PortfolioDonut과 동일)
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
]

interface ChartDataItem {
  name: string
  value: number
  isGroup?: boolean
}

interface RealTimePieChartProps {
  data: ChartDataItem[]
  totalPercentage: number
  className?: string
}

export function RealTimePieChart({ data, totalPercentage, className }: RealTimePieChartProps) {
  // 100%와의 차이 계산
  const difference = Math.abs(100 - totalPercentage)
  const isValid = difference < 0.01 // 소수점 오차 허용
  const isOver = totalPercentage > 100

  // 차트 데이터 준비 (0% 항목 제외)
  const chartData = useMemo(() => {
    return data.filter(item => item.value > 0)
  }, [data])

  // 빈 데이터일 때 표시
  if (chartData.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-4", className)}>
        <div className="w-32 h-32 rounded-full border-4 border-dashed border-muted flex items-center justify-center">
          <span className="text-muted-foreground text-sm">배분 없음</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          항목을 추가해주세요
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* 파이차트 */}
      <div className="w-40 h-40 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
              animationDuration={300}
              animationEasing="ease-out"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* 중앙 합계 표시 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={cn(
            "text-lg font-bold",
            isValid ? "text-green-600 dark:text-green-400" :
            isOver ? "text-red-600 dark:text-red-400" :
            "text-amber-600 dark:text-amber-400"
          )}>
            {totalPercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 상태 메시지 */}
      <div className={cn(
        "mt-2 flex items-center gap-1.5 text-sm",
        isValid ? "text-green-600 dark:text-green-400" :
        isOver ? "text-red-600 dark:text-red-400" :
        "text-amber-600 dark:text-amber-400"
      )}>
        {isValid ? (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>100% 완료</span>
          </>
        ) : isOver ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>{difference.toFixed(1)}% 초과</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>{difference.toFixed(1)}% 부족</span>
          </>
        )}
      </div>

      {/* 범례 (간략하게) */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 max-w-[200px]">
        {chartData.slice(0, 5).map((item, index) => (
          <div key={item.name} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground truncate max-w-[60px]">
              {item.name}
            </span>
          </div>
        ))}
        {chartData.length > 5 && (
          <span className="text-xs text-muted-foreground">
            +{chartData.length - 5}개
          </span>
        )}
      </div>
    </div>
  )
}
