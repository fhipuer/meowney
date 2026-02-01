import { useState } from 'react'
import {
  Briefcase,
  ChevronDown,
  CheckCircle2,
  XCircle,
  BarChart3,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { GuideSection } from '@/components/guide/GuideSection'
import { GuideTipBox } from '@/components/guide/GuideTipBox'
import { GuidePortfolioPie } from '@/components/guide/GuidePortfolioPie'
import {
  PORTFOLIO_TEMPLATES,
  RISK_LEVEL_CONFIG,
  type PortfolioTemplate,
  type PortfolioAllocation,
} from '@/data/guide-portfolios'
import { cn } from '@/lib/utils'

// --- Risk filter config ---

const RISK_FILTERS: { key: string; label: string; levels: PortfolioTemplate['riskLevel'][] }[] = [
  { key: 'all', label: '전체', levels: [] },
  { key: 'safe', label: '안정', levels: ['low', 'medium-low'] },
  { key: 'neutral', label: '중립', levels: ['medium'] },
  { key: 'aggressive', label: '공격', levels: ['medium-high', 'high'] },
]

// --- Comparison chart data ---

const comparisonData = [
  { name: '올웨더', stocks: 30, bonds: 55, alternatives: 15 },
  { name: '60/40', stocks: 60, bonds: 40, alternatives: 0 },
  { name: '3펀드', stocks: 60, bonds: 40, alternatives: 0 },
  { name: '영구', stocks: 25, bonds: 25, alternatives: 50 },
  { name: '한국형', stocks: 55, bonds: 30, alternatives: 15 },
]

// --- Tooltip styles ---

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--popover-foreground))',
  borderRadius: '0.5rem',
}

// --- Helpers ---

function allocationsToPieData(allocations: PortfolioAllocation[]) {
  return allocations.map((a) => ({
    name: a.name,
    value: a.percentage,
    color: a.color,
  }))
}

// --- Component ---

export function GuidePortfoliosTab() {
  const [selectedRisk, setSelectedRisk] = useState<string>('all')

  const filteredPortfolios = PORTFOLIO_TEMPLATES.filter((p) => {
    if (selectedRisk === 'all') return true
    const filter = RISK_FILTERS.find((f) => f.key === selectedRisk)
    return filter ? filter.levels.includes(p.riskLevel) : true
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <GuideSection
        icon={Briefcase}
        title="유명 투자 전략 살펴보기"
        description="세계적으로 검증된 자산배분 전략들을 알아보고, 나에게 맞는 포트폴리오를 찾아보세요."
        delay={0}
      >
        {/* Risk level filter */}
        <div className="flex flex-wrap gap-2">
          {RISK_FILTERS.map((filter) => (
            <Badge
              key={filter.key}
              variant={selectedRisk === filter.key ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => setSelectedRisk(filter.key)}
            >
              {filter.label}
            </Badge>
          ))}
        </div>
      </GuideSection>

      {/* Portfolio Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPortfolios.map((portfolio) => {
          const riskConfig = RISK_LEVEL_CONFIG[portfolio.riskLevel]

          return (
            <Card
              key={portfolio.id}
              className="hover:shadow-lg transition-all"
            >
              <CardHeader>
                <CardTitle className="text-lg font-bold">
                  {portfolio.nameKo}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {portfolio.name}
                </CardDescription>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline">{portfolio.creator}</Badge>
                  <Badge variant="secondary">{portfolio.year}년</Badge>
                  <Badge
                    className={cn(
                      riskConfig.bgColor,
                      riskConfig.color,
                      'border-transparent'
                    )}
                  >
                    {riskConfig.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {portfolio.description}
                </p>

                <GuidePortfolioPie
                  data={allocationsToPieData(portfolio.allocations)}
                  size={180}
                />

                <p className="font-medium text-sm text-center">
                  기대 수익: {portfolio.expectedReturn}
                </p>

                {/* Collapsible details */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center">
                    자세히 보기
                    <ChevronDown className="w-4 h-4" />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="space-y-4 pt-4">
                    {/* Philosophy */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        투자 철학
                      </p>
                      <p className="text-sm italic text-muted-foreground">
                        {portfolio.philosophy}
                      </p>
                    </div>

                    {/* Pros */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        장점
                      </p>
                      <ul className="space-y-1">
                        {portfolio.pros.map((pro, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Cons */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        단점
                      </p>
                      <ul className="space-y-1">
                        {portfolio.cons.map((con, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Suitable for */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        적합한 투자자
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {portfolio.suitableFor.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Korea adapted version */}
                    {portfolio.koreaAdapted && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            한국에서 실제 투자 가능한 버전
                          </p>
                          <GuidePortfolioPie
                            data={allocationsToPieData(portfolio.koreaAdapted)}
                            size={160}
                          />
                        </div>
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Comparison Section */}
      <Separator />

      <GuideSection
        icon={BarChart3}
        title="포트폴리오 비교"
        description="전략별 주식/채권/대체자산 비중을 한눈에 비교해보세요"
        delay={100}
      >
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  stocks: '주식',
                  bonds: '채권',
                  alternatives: '대체자산',
                }
                return [`${value}%`, labels[name] || name]
              }}
            />
            <Legend
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  stocks: '주식',
                  bonds: '채권',
                  alternatives: '대체자산',
                }
                return labels[value] || value
              }}
            />
            <Bar dataKey="stocks" fill="#ef4444" radius={[4, 4, 0, 0]} name="stocks" />
            <Bar dataKey="bonds" fill="#3b82f6" radius={[4, 4, 0, 0]} name="bonds" />
            <Bar dataKey="alternatives" fill="#eab308" radius={[4, 4, 0, 0]} name="alternatives" />
          </BarChart>
        </ResponsiveContainer>
      </GuideSection>

      {/* Footer tip */}
      <GuideTipBox variant="tip">
        어떤 포트폴리오가 나에게 맞을지 모르겠다면, &apos;투자 성향&apos; 탭에서
        퀴즈를 풀어보세요!
      </GuideTipBox>
    </div>
  )
}
