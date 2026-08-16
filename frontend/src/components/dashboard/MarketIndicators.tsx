import { Activity, BarChart3, Coins, Gauge, Globe2, Landmark, Waves } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RegimeSignal } from '@/types'

type Props = { signals: RegimeSignal[]; fetchedAt?: string | null }

const META: Record<string, { short: string; role: string; icon: typeof Globe2; group: string }> = {
  market_sp500: { short: 'S&P 500', role: '미국 위험자산 베타', icon: BarChart3, group: 'risk' },
  market_nasdaq: { short: 'NASDAQ', role: '성장주·AI 민감도', icon: Activity, group: 'risk' },
  market_kospi: { short: 'KOSPI', role: '한국 경기·반도체 베타', icon: Globe2, group: 'risk' },
  market_vix: { short: 'VIX', role: '옵션 내재 변동성', icon: Gauge, group: 'stress' },
  market_usdkrw: { short: 'USD/KRW', role: '원화 포트폴리오 환율', icon: Landmark, group: 'fx' },
  market_dollar: { short: '광의 달러', role: '글로벌 달러 긴축', icon: Landmark, group: 'fx' },
  market_wti: { short: 'WTI', role: '공급충격·에너지 물가', icon: Waves, group: 'real' },
  market_copper: { short: '구리', role: '글로벌 제조업 수요', icon: Coins, group: 'real' },
  market_gold: { short: '금', role: '실질금리·달러·방어 수요', icon: Coins, group: 'hedge' },
  market_silver: { short: '은', role: '산업 수요·귀금속 혼합', icon: Coins, group: 'hedge' },
  market_gold_silver_ratio: { short: '금은비', role: '방어 선호·산업수요 상대 확인', icon: Gauge, group: 'hedge' },
}

const signed = (value?: number | null) => value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
const formatValue = (signal: RegimeSignal) => {
  if (signal.value == null) return '—'
  if (signal.id === 'market_usdkrw') return signal.value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
  if (signal.id === 'market_wti') return `$${signal.value.toFixed(1)}`
  if (signal.id === 'market_copper') return `$${signal.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (signal.id === 'market_gold' || signal.id === 'market_silver') return `$${signal.value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
  if (signal.id === 'market_gold_silver_ratio') return `${signal.value.toFixed(1)}배`
  return signal.value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}

function changeTone(value?: number | null, inverse = false) {
  if (value == null || Math.abs(value) < 0.05) return 'text-muted-foreground'
  const favorable = inverse ? value < 0 : value > 0
  return favorable ? 'text-sky-300' : 'text-amber-300'
}

function MarketCard({ signal }: { signal: RegimeSignal }) {
  const meta = META[signal.id]
  if (!meta) return null
  const Icon = meta.icon
  const inverse = signal.id === 'market_vix' || signal.id === 'market_usdkrw' || signal.id === 'market_dollar'
  return <Card className="bg-card/70">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.07] text-primary"><Icon className="h-4 w-4" /></div><div><div className="flex items-center gap-2"><p className="font-medium">{meta.short}</p><Badge variant="outline" className="text-[10px] font-normal">{signal.usage === 'trigger' ? '경보 전용' : '맥락 지표'}</Badge></div><p className="mt-0.5 text-xs text-muted-foreground">{meta.role}</p></div></div>
        <Badge variant="outline" className="font-normal text-muted-foreground">{signal.observation_date || '미수집'}</Badge>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3"><p className="text-2xl font-semibold tabular-nums">{formatValue(signal)}</p><p className={`text-sm font-medium ${changeTone(signal.change_1m, inverse)}`}>1M {signed(signal.change_1m)}</p></div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-xs"><div><span className="text-muted-foreground">3M </span><span className={changeTone(signal.change_3m, inverse)}>{signed(signal.change_3m)}</span></div><div><span className="text-muted-foreground">12M </span><span className={changeTone(signal.change_12m, inverse)}>{signed(signal.change_12m)}</span></div></div>
    </CardContent>
  </Card>
}

function normalizedTrend(signals: RegimeSignal[]) {
  const selected = signals.filter(signal => ['market_sp500', 'market_nasdaq', 'market_kospi'].includes(signal.id) && (signal.history?.length || 0) > 1)
  const rows = new Map<string, Record<string, string | number>>()
  selected.forEach(signal => {
    const history = signal.history || []
    const base = history[0]?.value
    if (!base) return
    history.forEach(point => rows.set(point.date, { ...(rows.get(point.date) || { date: point.date }), [signal.id]: point.value / base * 100 }))
  })
  return [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

export function MarketIndicators({ signals, fetchedAt }: Props) {
  const available = signals.filter(signal => META[signal.id] && signal.value != null)
  const trend = normalizedTrend(available)
  const group = (name: string) => available.filter(signal => META[signal.id].group === name)

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">시장 환경</h2><p className="mt-1 text-sm text-muted-foreground">가격 충격과 거시 신호를 확인합니다. 시장가격만으로 자동 레짐을 변경하지 않습니다.</p></div><div className="text-right text-xs text-muted-foreground"><p>마지막 갱신</p><p className="mt-1">{fetchedAt ? new Date(fetchedAt).toLocaleString('ko-KR') : '확인 불가'}</p></div></div>

    <Card><CardHeader><CardTitle>위험자산 상대 흐름</CardTitle><p className="text-sm text-muted-foreground">각 지수의 표시 구간 시작값을 100으로 환산합니다. 지수 간 절대 수준 비교가 아닙니다.</p></CardHeader><CardContent>{trend.length > 1 ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 8, right: 18, bottom: 4, left: 4 }}><CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" tickFormatter={value => String(value).slice(5).replace('-', '.')} minTickGap={52} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis width={46} domain={[(minimum: number) => Math.floor(minimum - 5), (maximum: number) => Math.ceil(maximum + 5)]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={label => `관측일 ${label}`} contentStyle={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 8 }} /><Legend /><Line type="monotone" dataKey="market_sp500" name="S&P 500" stroke="#60a5fa" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} /><Line type="monotone" dataKey="market_nasdaq" name="NASDAQ" stroke="#a78bfa" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} /><Line type="monotone" dataKey="market_kospi" name="KOSPI" stroke="#2dd4bf" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">정규화 차트를 만들 장기 시계열이 부족합니다.</div>}</CardContent></Card>

    {[['risk', '주요 시장'], ['stress', '스트레스'], ['fx', '달러·환율'], ['real', '실물·공급충격'], ['hedge', '귀금속·방어 확인']].map(([id, title]) => group(id).length ? <section key={id}><div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-medium">{title}</h3><div className="h-px flex-1 bg-border/70" /></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{group(id).map(signal => <MarketCard key={signal.id} signal={signal} />)}</div></section> : null)}

    <p className="text-xs leading-5 text-muted-foreground">금·은·금은비는 실제 보유자산과 방어 수요를 설명하는 확인 지표이며, 단독으로 자동 거시 레짐을 변경하지 않습니다. 밸류에이션은 신뢰 가능한 출처를 확보한 뒤 연결합니다.</p>
  </div>
}
