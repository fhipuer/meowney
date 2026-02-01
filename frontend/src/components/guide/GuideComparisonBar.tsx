import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ComparisonItem {
  label: string
  value: number // 0-100
  color: string // hex color
  displayValue?: string // optional display text like "★★★★★"
}

interface GuideComparisonBarProps {
  items: ComparisonItem[]
  title?: string
  className?: string
}

export function GuideComparisonBar({ items, title, className }: GuideComparisonBarProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger animation after mount
    setMounted(true)
  }, [])

  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
      )}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-24 text-sm text-foreground">{item.label}</div>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all duration-1000 ease-out"
                style={{
                  width: mounted ? `${item.value}%` : '0%',
                  backgroundColor: item.color,
                }}
              />
            </div>
            {item.displayValue && (
              <div className="w-24 text-sm text-right text-muted-foreground">
                {item.displayValue}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
