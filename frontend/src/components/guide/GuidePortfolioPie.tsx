import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface PieSlice {
  name: string
  value: number
  color: string
}

interface GuidePortfolioPieProps {
  data: PieSlice[]
  size?: number // diameter in px, default 200
  showLegend?: boolean // default true
  centerLabel?: string // text in center of donut hole
  className?: string
}

export function GuidePortfolioPie({
  data,
  size = 200,
  showLegend = true,
  centerLabel,
  className,
}: GuidePortfolioPieProps) {
  return (
    <div className={cn('flex flex-col items-center space-y-4', className)}>
      <div className="relative" style={{ width: '100%', height: size }}>
        <ResponsiveContainer width="100%" height={size}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="75%"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--popover-foreground))',
                borderRadius: '0.5rem',
              }}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-sm font-medium text-foreground">{centerLabel}</div>
          </div>
        )}
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
          {data.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-foreground">
                {entry.name}: {entry.value}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
