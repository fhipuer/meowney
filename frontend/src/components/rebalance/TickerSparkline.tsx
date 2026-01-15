/**
 * 티커 Sparkline 컴포넌트 냥~ 🐱
 * 미니 차트로 최근 가격 추이 표시
 */
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { useTickerHistory } from '@/hooks/useDashboard'
import { cn } from '@/lib/utils'

interface TickerSparklineProps {
  ticker: string | null | undefined
  days?: number
  showChangeRate?: boolean
  className?: string
  width?: number
  height?: number
}

export function TickerSparkline({
  ticker,
  days = 30,
  showChangeRate = true,
  className,
  width = 80,
  height = 32,
}: TickerSparklineProps) {
  const { data, isLoading, isError } = useTickerHistory(ticker, days)

  // 티커가 없거나 로딩 중이면 빈 영역 표시
  if (!ticker || isLoading) {
    return (
      <div
        className={cn('flex items-center gap-1', className)}
        style={{ width, height }}
      >
        <div className="w-full h-full bg-muted/50 animate-pulse rounded" />
      </div>
    )
  }

  // 에러 또는 데이터 없음
  if (isError || !data?.data || data.data.length === 0) {
    return (
      <div
        className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}
        style={{ width, height }}
      >
        -
      </div>
    )
  }

  // 변화율에 따른 색상 결정 (한국식: 빨간색=수익, 파란색=손실)
  const isPositive = data.change_rate >= 0
  const strokeColor = isPositive ? '#ef4444' : '#3b82f6'
  const fillColor = isPositive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="close"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#gradient-${ticker})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {showChangeRate && (
        <span
          className={cn(
            'text-xs font-medium min-w-[40px] text-right',
            isPositive ? 'text-red-500' : 'text-blue-500'
          )}
        >
          {isPositive ? '+' : ''}
          {data.change_rate.toFixed(1)}%
        </span>
      )}
    </div>
  )
}
