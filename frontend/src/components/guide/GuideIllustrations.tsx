import { cn } from '@/lib/utils'

export function DiversificationIllustration({ diversified = false }: { diversified?: boolean }) {
  const positions = diversified
    ? [[38, 38], [82, 38], [126, 38], [60, 76], [104, 76]]
    : [[66, 44], [76, 38], [86, 44], [72, 54], [82, 54]]
  return (
    <svg viewBox="0 0 164 104" className="mx-auto h-24 w-full max-w-[220px]" role="img" aria-label={diversified ? '여러 영역에 나뉜 자산' : '한 영역에 집중된 자산'}>
      <rect x="1" y="1" width="162" height="102" rx="10" fill="hsl(var(--muted) / .45)" stroke="hsl(var(--border))" />
      {diversified && [56, 108].map((x) => <path key={x} d={`M${x} 20v64`} stroke="hsl(var(--border))" strokeDasharray="3 4" />)}
      {positions.map(([x, y], index) => (
        <g key={index} transform={`translate(${x} ${y})`}>
          <ellipse cx="0" cy="10" rx="13" ry="4" fill="hsl(var(--foreground) / .08)" />
          <circle r="11" fill={diversified ? 'hsl(var(--primary) / .14)' : 'hsl(var(--destructive) / .13)'} stroke={diversified ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} strokeWidth="1.5" />
          <path d="M-5 0h10M0-5v10" stroke={diversified ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}

export function RiskProfileIllustration({ score = 15, className }: { score?: number; className?: string }) {
  const normalized = Math.max(0, Math.min(1, (score - 6) / 24))
  const markerX = 26 + normalized * 188
  return (
    <svg viewBox="0 0 240 116" className={cn('mx-auto w-full max-w-[320px]', className)} role="img" aria-label="투자 성향 위험도 스펙트럼">
      <rect x="1" y="1" width="238" height="114" rx="12" fill="hsl(var(--muted) / .42)" stroke="hsl(var(--border))" />
      <path d="M26 76C62 76 68 64 96 64s35-22 58-22 30-13 60-13" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 84h188" stroke="hsl(var(--border))" />
      {[26, 73, 120, 167, 214].map((x, index) => <circle key={x} cx={x} cy={84} r="3" fill={index / 4 <= normalized ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / .3)'} />)}
      <circle cx={markerX} cy={84} r="7" fill="hsl(var(--background))" stroke="hsl(var(--foreground))" strokeWidth="2" />
      <text x="26" y="102" fill="hsl(var(--muted-foreground))" fontSize="9">안정</text>
      <text x="214" y="102" textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="9">성장</text>
      <g transform="translate(27 21)"><rect width="42" height="22" rx="4" fill="hsl(var(--primary) / .12)" /><path d="M9 15V9m7 6V5m7 10v-3m7 3V7" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" /></g>
    </svg>
  )
}
