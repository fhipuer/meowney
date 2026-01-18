/**
 * 벤치마크 ON/OFF 토글 범례 컴포넌트 냥~ 🐱
 * KOSPI, S&P 500, NASDAQ 벤치마크 표시 토글
 */
import { cn } from '@/lib/utils'

export type BenchmarkTicker = '^KS11' | '^GSPC' | '^IXIC'

export interface BenchmarkConfig {
  ticker: BenchmarkTicker
  name: string
  color: string
  enabled: boolean
}

interface BenchmarkLegendProps {
  benchmarks: BenchmarkConfig[]
  onToggle: (ticker: BenchmarkTicker) => void
  className?: string
}

export const DEFAULT_BENCHMARKS: BenchmarkConfig[] = [
  { ticker: '^KS11', name: 'KOSPI', color: '#ef4444', enabled: false },
  { ticker: '^GSPC', name: 'S&P500', color: '#3b82f6', enabled: false },
  { ticker: '^IXIC', name: 'NASDAQ', color: '#22c55e', enabled: false },
]

export function BenchmarkLegend({ benchmarks, onToggle, className }: BenchmarkLegendProps) {
  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      {benchmarks.map((benchmark) => (
        <button
          key={benchmark.ticker}
          onClick={() => onToggle(benchmark.ticker)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all',
            benchmark.enabled
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div
            className={cn(
              'w-3 h-3 rounded-sm border-2 transition-colors',
              benchmark.enabled ? 'border-current' : 'border-muted-foreground/50'
            )}
            style={{
              backgroundColor: benchmark.enabled ? benchmark.color : 'transparent',
              borderColor: benchmark.color,
            }}
          />
          <span>{benchmark.name}</span>
        </button>
      ))}
    </div>
  )
}
