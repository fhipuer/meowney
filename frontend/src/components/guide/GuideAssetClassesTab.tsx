import { useState } from 'react'
import {
  TrendingUp,
  Shield,
  Wallet,
  Gem,
  ChevronDown,
  AlertTriangle,
  Clock,
  Heart,
  Building2,
  Coins,
  Fuel,
  BarChart3,
  Layers,
} from 'lucide-react'
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { GuideSection } from '@/components/guide/GuideSection'
import { GuideTipBox } from '@/components/guide/GuideTipBox'
import { GuideStatCard } from '@/components/guide/GuideStatCard'
import { GuidePortfolioPie } from '@/components/guide/GuidePortfolioPie'
import { GuideComparisonBar } from '@/components/guide/GuideComparisonBar'

// --- Static data ---

const radarData = [
  { subject: '기대수익', stocks: 5, bonds: 3, cash: 1, gold: 2 },
  { subject: '유동성', stocks: 5, bonds: 4, cash: 5, gold: 4 },
  { subject: '인플레 헤지', stocks: 3, bonds: 2, cash: 1, gold: 4 },
  { subject: '안정성', stocks: 1, bonds: 4, cash: 5, gold: 3 },
]

const beginnerPortfolio = [
  { name: '국내주식', value: 30, color: '#ef4444' },
  { name: '해외주식', value: 30, color: '#f97316' },
  { name: '채권', value: 30, color: '#3b82f6' },
  { name: '현금', value: 10, color: '#22c55e' },
]

const aggressivePortfolio = [
  { name: '국내주식', value: 25, color: '#ef4444' },
  { name: '해외주식', value: 45, color: '#f97316' },
  { name: '채권', value: 20, color: '#3b82f6' },
  { name: '현금', value: 5, color: '#22c55e' },
  { name: '금', value: 5, color: '#eab308' },
]

const radarColors = [
  { key: 'stocks', label: '주식', color: '#ef4444' },
  { key: 'bonds', label: '채권', color: '#3b82f6' },
  { key: 'cash', label: '현금', color: '#22c55e' },
  { key: 'gold', label: '금', color: '#eab308' },
]

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--popover-foreground))',
  borderRadius: '0.5rem',
}

// --- Sub-components ---

interface AssetClassCardProps {
  icon: React.ElementType
  title: string
  badgeLabel: string
  badgeVariant: 'destructive' | 'secondary' | 'outline' | 'default'
  defaultOpen?: boolean
  children: React.ReactNode
}

function AssetClassCard({
  icon: Icon,
  title,
  badgeLabel,
  badgeVariant,
  defaultOpen = false,
  children,
}: AssetClassCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 font-bold text-lg">{title}</div>
            <Badge variant={badgeVariant} className="flex-shrink-0">
              {badgeLabel}
            </Badge>
            <ChevronDown
              className={cn(
                'w-5 h-5 text-muted-foreground transition-transform duration-200 flex-shrink-0',
                isOpen && 'rotate-180'
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-5 sm:px-5 space-y-4">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm font-medium text-muted-foreground w-28 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

// --- Main Component ---

export function GuideAssetClassesTab() {
  return (
    <div className="space-y-8">
      {/* Section 1-4: Asset Classes */}
      <GuideSection
        icon={Layers}
        title="자산군 알아보기"
        description="각 자산군의 특징과 장단점을 살펴봐요"
        delay={0}
      >
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span className="font-bold text-sm">ETF(상장지수펀드)란?</span>
            </div>
            <p className="text-sm text-muted-foreground">
              ETF는 여러 종목을 한 번에 담은 '종합선물세트' 같은 상품이에요.
              주식처럼 거래소에서 쉽게 사고팔 수 있어서 초보자도 간편하게 분산투자할 수 있답니다.
              이 가이드에서 자주 등장하는 KODEX, TIGER, VOO 등이 모두 ETF예요!
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {/* 주식 */}
          <AssetClassCard
            icon={TrendingUp}
            title="주식 (Stocks)"
            badgeLabel="고수익/고위험"
            badgeVariant="destructive"
            defaultOpen={true}
          >
            <div className="rounded-lg bg-muted/30 p-3">
              <InfoRow label="기대수익" value="높음 (연 7~10%)" />
              <InfoRow label="변동성" value="높음" />
              <InfoRow
                label="적합한 투자자"
                value="장기 투자 가능하고 위험 감내 가능한 분"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">국내주식</Badge>
              <span className="text-sm text-muted-foreground">
                삼성전자, KODEX 200 등
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">해외주식</Badge>
              <span className="text-sm text-muted-foreground">
                애플, S&P 500 등
              </span>
            </div>

            <GuideTipBox variant="tip">
              주식은 날씬한 고양이 같아요. 빠르게 뛸 수 있지만, 갑자기 방향을
              바꾸기도 하죠!
            </GuideTipBox>
          </AssetClassCard>

          {/* 채권 */}
          <AssetClassCard
            icon={Shield}
            title="채권 (Bonds)"
            badgeLabel="중수익/저위험"
            badgeVariant="secondary"
          >
            <div className="rounded-lg bg-muted/30 p-3">
              <InfoRow label="기대수익" value="중간 (연 3~5%)" />
              <InfoRow label="변동성" value="낮음" />
              <InfoRow label="적합한 투자자" value="안정 추구, 은퇴 준비" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">국채</Badge>
              <span className="text-sm text-muted-foreground">
                정부가 발행, 가장 안전
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">회사채</Badge>
              <span className="text-sm text-muted-foreground">
                기업이 발행, 수익률 높음
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">채권 ETF</Badge>
              <span className="text-sm text-muted-foreground">
                쉽게 투자 가능한 채권 묶음
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
              <p className="text-xs text-muted-foreground">
                💡 만기에 따라 성격이 달라요
              </p>
              <p className="text-xs text-muted-foreground">
                • 단기채(1~3년): 변동성이 낮아 현금처럼 안정적
              </p>
              <p className="text-xs text-muted-foreground">
                • 장기채(10년+): 수익이 높지만 금리 변동에 민감
              </p>
            </div>

            <GuideTipBox variant="tip">
              채권은 느긋한 노묘 같아요. 급하지 않고 꾸준히 간식(이자)을
              받아먹죠!
            </GuideTipBox>
          </AssetClassCard>

          {/* 현금 및 예금 */}
          <AssetClassCard
            icon={Wallet}
            title="현금 및 예금"
            badgeLabel="저수익/안전"
            badgeVariant="outline"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <GuideStatCard
                value="긴급"
                label="갑자기 돈이 필요할 때"
                icon={AlertTriangle}
                colorClass="text-orange-500"
                bgClass="bg-orange-50 dark:bg-orange-950/20"
              />
              <GuideStatCard
                value="대기"
                label="좋은 투자 기회 포착"
                icon={Clock}
                colorClass="text-blue-500"
                bgClass="bg-blue-50 dark:bg-blue-950/20"
              />
              <GuideStatCard
                value="안심"
                label="현금이 있다는 심리적 안정"
                icon={Heart}
                colorClass="text-pink-500"
                bgClass="bg-pink-50 dark:bg-pink-950/20"
              />
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-center">
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                최소 5~10%는 현금으로 보유하세요!
              </p>
            </div>
          </AssetClassCard>

          {/* 대체 자산 */}
          <AssetClassCard
            icon={Gem}
            title="대체 자산"
            badgeLabel="분산 효과"
            badgeVariant="default"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 부동산 */}
              <Card className="bg-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-sm">부동산(리츠)</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-green-600 dark:text-green-400">
                      + 안정적 배당 수익
                    </p>
                    <p className="text-green-600 dark:text-green-400">
                      + 인플레이션 헤지
                    </p>
                    <p className="text-red-500 dark:text-red-400">
                      - 유동성이 낮을 수 있음
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 금 */}
              <Card className="bg-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <span className="font-semibold text-sm">금</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-green-600 dark:text-green-400">
                      + 위기 시 안전자산
                    </p>
                    <p className="text-green-600 dark:text-green-400">
                      + 인플레이션 헤지
                    </p>
                    <p className="text-red-500 dark:text-red-400">
                      - 이자/배당 없음
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 원자재 */}
              <Card className="bg-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Fuel className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold text-sm">원자재</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-green-600 dark:text-green-400">
                      + 높은 분산 효과
                    </p>
                    <p className="text-green-600 dark:text-green-400">
                      + 실물 경제 연동
                    </p>
                    <p className="text-red-500 dark:text-red-400">
                      - 변동성이 매우 높음
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      대표 ETF: KODEX 원자재선물, DBC
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <GuideTipBox variant="tip">
              대체 자산은 고양이의 숨은 장난감 같아요. 평소엔 잊고 있다가 필요할
              때 빛을 발하죠!
            </GuideTipBox>
          </AssetClassCard>
        </div>
      </GuideSection>

      <Separator />

      {/* Section 5: 자산군 비교 요약 */}
      <GuideSection
        icon={BarChart3}
        title="자산군 비교 요약"
        description="레이더 차트로 한눈에 비교해요"
        delay={100}
      >
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            />
            <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Radar
              name="주식"
              dataKey="stocks"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Radar
              name="채권"
              dataKey="bonds"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Radar
              name="현금"
              dataKey="cash"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Radar
              name="금"
              dataKey="gold"
              stroke="#eab308"
              fill="#eab308"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        <p className="text-xs text-muted-foreground text-center mt-1">
          ※ 금은 대체자산의 일부이지만, 고유한 안전자산 성격으로 별도 비교합니다
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          {radarColors.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </div>

        <GuideComparisonBar
          title="자산군별 기대수익 비교"
          items={[
            { label: '주식', value: 90, color: '#ef4444', displayValue: '연 7~10%' },
            { label: '채권', value: 50, color: '#3b82f6', displayValue: '연 3~5%' },
            { label: '금', value: 40, color: '#eab308', displayValue: '연 2~4%' },
            { label: '현금', value: 20, color: '#22c55e', displayValue: '연 1~2%' },
          ]}
        />
      </GuideSection>

      <Separator />

      {/* Section 6: 자산군 조합 예시 */}
      <GuideSection
        icon={Gem}
        title="자산군 조합 예시"
        description="실전에서 활용할 수 있는 포트폴리오 예시"
        delay={200}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <h4 className="font-bold text-center mb-3">
                초보자 기본 포트폴리오
              </h4>
              <p className="text-xs text-muted-foreground text-center mb-3">
                주식과 채권을 균형 있게 배분한 안정적인 구성이에요
              </p>
              <GuidePortfolioPie data={beginnerPortfolio} size={200} />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <h4 className="font-bold text-center mb-3">
                공격적 포트폴리오
              </h4>
              <p className="text-xs text-muted-foreground text-center mb-3">
                높은 수익을 추구하되 대체자산으로 위험을 분산해요
              </p>
              <GuidePortfolioPie data={aggressivePortfolio} size={200} />
            </CardContent>
          </Card>
        </div>
      </GuideSection>
    </div>
  )
}
