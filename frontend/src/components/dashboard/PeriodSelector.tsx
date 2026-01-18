/**
 * 기간 선택 버튼 그룹 컴포넌트 냥~ 🐱
 * 1W, 1M, 3M, 6M, 1Y 기간 선택
 */
import { cn } from '@/lib/utils'

export type Period = '1W' | '1M' | '3M' | '6M' | '1Y'

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
  className?: string
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
]

export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  return (
    <div className={cn('inline-flex rounded-lg bg-muted p-0.5', className)}>
      {PERIODS.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all',
            value === period.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
