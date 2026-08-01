import {
  BookOpen,
  Shield,
  TrendingUp,
  Heart,
  PieChart as PieChartIcon,
  Lightbulb,
  Target,
  Sparkles,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Line,
  ComposedChart,
  Area,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { GuideSection } from '@/components/guide/GuideSection'
import { GuideTipBox } from '@/components/guide/GuideTipBox'
import { GuideStatCard } from '@/components/guide/GuideStatCard'
import { GuidePortfolioPie } from '@/components/guide/GuidePortfolioPie'

// --- Static data ---

const allocationPieData = [
  { name: '주식', value: 60, color: '#ef4444' },
  { name: '채권', value: 30, color: '#3b82f6' },
  { name: '현금', value: 10, color: '#22c55e' },
]

const lossComparisonData = [
  { name: '주식 100%', loss: -30 },
  { name: '분산투자 (60/40)', loss: -16 },
]

const correlationData = [
  { month: '1월', stocks: 100, bonds: 100, portfolio: 100 },
  { month: '2월', stocks: 108, bonds: 99, portfolio: 104 },
  { month: '3월', stocks: 95, bonds: 103, portfolio: 98 },
  { month: '4월', stocks: 88, bonds: 106, portfolio: 95 },
  { month: '5월', stocks: 102, bonds: 104, portfolio: 103 },
  { month: '6월', stocks: 115, bonds: 101, portfolio: 109 },
  { month: '7월', stocks: 110, bonds: 103, portfolio: 107 },
  { month: '8월', stocks: 92, bonds: 108, portfolio: 98 },
  { month: '9월', stocks: 98, bonds: 106, portfolio: 101 },
  { month: '10월', stocks: 118, bonds: 102, portfolio: 111 },
  { month: '11월', stocks: 125, bonds: 100, portfolio: 114 },
  { month: '12월', stocks: 120, bonds: 104, portfolio: 113 },
]

const contributionPieData = [
  { name: '자산배분', value: 90, color: '#6366f1' },
  { name: '종목 선택', value: 5, color: '#ec4899' },
  { name: '매매 타이밍', value: 5, color: '#f97316' },
]

const aggressivePortfolio = [
  { name: '주식', value: 80, color: '#ef4444' },
  { name: '채권', value: 15, color: '#3b82f6' },
  { name: '현금', value: 5, color: '#22c55e' },
]

const balancedPortfolio = [
  { name: '주식', value: 60, color: '#ef4444' },
  { name: '채권', value: 30, color: '#3b82f6' },
  { name: '현금', value: 10, color: '#22c55e' },
]

const conservativePortfolio = [
  { name: '주식', value: 40, color: '#ef4444' },
  { name: '채권', value: 50, color: '#3b82f6' },
  { name: '현금', value: 10, color: '#22c55e' },
]

const compoundData = [
  { year: '0년', value: 1000 },
  { year: '5년', value: 1403 },
  { year: '10년', value: 1967 },
  { year: '15년', value: 2759 },
  { year: '20년', value: 3870 },
  { year: '25년', value: 5427 },
  { year: '30년', value: 7612 },
]

// --- Tooltip styles ---

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--popover-foreground))',
  borderRadius: '0.5rem',
}

// --- Component ---

export function GuideBasicsTab() {
  return (
    <div className="space-y-8">
      {/* 비상자금 경고 */}
      <GuideTipBox variant="warning">
        투자를 시작하기 전에 최소 3~6개월치 생활비를 비상자금으로 확보하세요! 비상자금 없이 투자하면 급할 때 손해를 보며 팔아야 할 수 있어요.
      </GuideTipBox>

      {/* Section 1: 달걀을 한 바구니에 담지 마라 */}
      <GuideSection
        icon={BookOpen}
        title="달걀을 한 바구니에 담지 마라"
        description="분산 투자의 핵심 원칙을 알아봐요"
        delay={0}
      >
        <figure className="overflow-hidden rounded-md border border-border bg-[#f2efeb] dark:bg-muted">
          <img
            src="/images/guide/concentration-vs-diversification.png"
            alt="깨지기 쉬운 하나의 받침에 자산을 집중한 모습과 여러 자산군에 안정적으로 분산한 모습의 비교"
            className="block aspect-[2/1] w-full object-cover"
            loading="lazy"
          />
          <figcaption className="grid grid-cols-2 border-t border-border bg-background">
            <div className="border-r border-border p-4 md:px-6">
              <p className="text-sm font-medium text-foreground">한 자산에 집중</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">한 곳의 충격이 포트폴리오 전체에 영향을 줍니다.</p>
            </div>
            <div className="p-4 md:px-6">
              <p className="text-sm font-medium text-foreground">여러 자산군에 분산</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">서로 다른 움직임이 전체 변동성을 완화합니다.</p>
            </div>
          </figcaption>
        </figure>

        <GuideTipBox variant="tip">
          분산투자는 손실을 없애는 방법이 아니라, 하나의 자산이 전체 결과를 결정하지 않도록 위험을 나누는 전략입니다.
        </GuideTipBox>
      </GuideSection>

      <Separator />

      {/* Section 2: 자산배분이란? */}
      <GuideSection
        icon={PieChartIcon}
        title="자산배분이란?"
        description="투자 자금을 나누어 투자하는 전략"
        delay={100}
      >
        <p className="text-muted-foreground">
          자산배분(Asset Allocation)이란 투자 자금을 여러 종류의 자산에 나누어
          투자하는 전략입니다.
        </p>

        <GuidePortfolioPie
          data={allocationPieData}
          centerLabel="1,000만원"
        />

        <div>
          <p className="text-sm text-muted-foreground mb-3">
            예를 들어 1,000만원이 있다면:
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center rounded-lg bg-red-50 dark:bg-red-950/20 p-3">
              <div className="text-lg font-bold text-red-500">600만원</div>
              <div className="text-xs text-muted-foreground">주식</div>
            </div>
            <div className="text-center rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3">
              <div className="text-lg font-bold text-blue-500">300만원</div>
              <div className="text-xs text-muted-foreground">채권</div>
            </div>
            <div className="text-center rounded-lg bg-green-50 dark:bg-green-950/20 p-3">
              <div className="text-lg font-bold text-green-500">100만원</div>
              <div className="text-xs text-muted-foreground">현금</div>
            </div>
          </div>
        </div>
      </GuideSection>

      <Separator />

      {/* Section 3: 왜 자산배분이 중요한가? */}
      <GuideSection
        icon={Shield}
        title="왜 자산배분이 중요한가?"
        description="위험을 줄이고 안정적인 성과를 얻는 비결"
        delay={200}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GuideStatCard
            value="-16%"
            label="분산 투자 시 손실 완화 (주식100%는 -30%)"
            icon={Shield}
            colorClass="text-blue-500"
            bgClass="bg-blue-50 dark:bg-blue-950/20"
            delay={0}
          />
          <GuideStatCard
            value="꾸준히"
            label="장기적으로 안정적 성과"
            icon={TrendingUp}
            colorClass="text-green-500"
            bgClass="bg-green-50 dark:bg-green-950/20"
            delay={100}
          />
          <GuideStatCard
            value="안심"
            label="패닉셀(공포 매도) 방지"
            icon={Heart}
            colorClass="text-pink-500"
            bgClass="bg-pink-50 dark:bg-pink-950/20"
            delay={200}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            주식 폭락 시 손실 비교
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={lossComparisonData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                domain={[-35, 0]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value}%`, '손실률']}
              />
              <Bar dataKey="loss" radius={[4, 4, 0, 0]}>
                {lossComparisonData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.loss <= -25 ? '#ef4444' : '#f97316'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GuideSection>

      <Separator />

      {/* Section 4: 상관관계의 마법 */}
      <GuideSection
        icon={Sparkles}
        title="상관관계의 마법"
        description="서로 다르게 움직이는 자산의 조합"
        delay={300}
      >
        <p className="text-muted-foreground">
          서로 다르게 움직이는 자산을 함께 가지고 있으면, 전체 포트폴리오의
          변동성이 줄어듭니다.
        </p>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={correlationData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              domain={[80, 130]}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  stocks: '주식',
                  bonds: '채권',
                  portfolio: '분산 포트폴리오',
                }
                return [value, labels[name] || name]
              }}
            />
            <Line
              type="monotone"
              dataKey="stocks"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              name="stocks"
            />
            <Line
              type="monotone"
              dataKey="bonds"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="bonds"
            />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="#22c55e"
              strokeWidth={3}
              dot={false}
              name="portfolio"
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>주식</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>채권</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="font-semibold">분산 포트폴리오</span>
          </div>
        </div>

        <p className="text-center font-medium text-green-600 dark:text-green-400">
          이것이 바로 분산투자의 힘입니다!
        </p>
      </GuideSection>

      <Separator />

      {/* Section 5: 자산배분 vs 종목 선택 */}
      <GuideSection
        icon={Target}
        title="자산배분 vs 종목 선택"
        description="투자 성과를 결정하는 가장 큰 요인"
        delay={400}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <GuidePortfolioPie
              data={contributionPieData}
              centerLabel="성과 기여도"
            />
          </div>
          <div className="flex-1 w-full">
            <GuideStatCard
              value="90%"
              label="투자 성과의 90%는 자산배분이 결정합니다"
              icon={PieChartIcon}
              colorClass="text-indigo-500"
              bgClass="bg-indigo-50 dark:bg-indigo-950/20"
            />
          </div>
        </div>

        <GuideTipBox variant="tip">
          어떤 주식을 살지 고민하기 전에, 먼저 &apos;내 돈의 몇 %를 주식에
          넣을까?&apos;를 정하세요!
        </GuideTipBox>

        <GuideTipBox variant="info">
          이 90% 수치는 Brinson, Hood & Beebower(1986)의 연구 &apos;Determinants of Portfolio Performance&apos;에 기반합니다. 이후 여러 후속 연구에서도 유사한 결론을 도출했어요.
        </GuideTipBox>
      </GuideSection>

      <Separator />

      {/* Section 6: 왜 장기투자인가? */}
      <GuideSection
        icon={TrendingUp}
        title="왜 장기투자인가?"
        description="복리의 마법으로 자산이 눈덩이처럼 불어나요"
        delay={450}
      >
        <p className="text-muted-foreground">
          복리(Compound Interest)는 이자에 대한 이자가 붙어 자산이 기하급수적으로
          성장하는 현상입니다. 초기 1,000만원을 연 7% 수익률로 투자하면...
        </p>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={compoundData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => `${v}만원`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${value}만원`, '자산가치']}
            />
            <Area
              type="monotone"
              dataKey="value"
              fill="#6366f1"
              fillOpacity={0.2}
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ r: 4, fill: '#6366f1' }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GuideStatCard
            value="1,967만원"
            label="10년 후 (약 2배)"
            icon={TrendingUp}
            colorClass="text-green-500"
            bgClass="bg-green-50 dark:bg-green-950/20"
            delay={0}
          />
          <GuideStatCard
            value="3,870만원"
            label="20년 후 (약 4배)"
            icon={TrendingUp}
            colorClass="text-green-500"
            bgClass="bg-green-50 dark:bg-green-950/20"
            delay={100}
          />
          <GuideStatCard
            value="7,612만원"
            label="30년 후 (약 7.6배)"
            icon={Sparkles}
            colorClass="text-indigo-500"
            bgClass="bg-indigo-50 dark:bg-indigo-950/20"
            delay={200}
          />
        </div>

        <GuideTipBox variant="tip">
          아인슈타인이 &apos;복리는 세계 8번째 불가사의&apos;라고 했대요. 고양이처럼 느긋하게 오래 기다리는 게 비결이에요!
        </GuideTipBox>
      </GuideSection>

      <Separator />

      {/* Section 7: 나에게 맞는 자산배분 찾기 */}
      <GuideSection
        icon={Lightbulb}
        title="나에게 맞는 자산배분 찾기"
        description="투자 기간, 위험 성향, 투자 목적을 고려하세요"
        delay={500}
      >
        <p className="text-muted-foreground">
          자산배분은 정답이 없어요. 나의 투자 기간, 위험 감내 수준, 투자 목적에
          따라 가장 적합한 비율이 달라집니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 공격형 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <Badge variant="destructive" className="mb-3">
                공격형
              </Badge>
              <GuidePortfolioPie data={aggressivePortfolio} size={160} />
              <p className="text-xs text-muted-foreground mt-2">
                높은 수익 추구, 장기 투자 가능한 분
              </p>
            </CardContent>
          </Card>

          {/* 중립형 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <Badge variant="default" className="mb-3">
                중립형
              </Badge>
              <GuidePortfolioPie data={balancedPortfolio} size={160} />
              <p className="text-xs text-muted-foreground mt-2">
                수익과 안정의 균형을 원하는 분
              </p>
            </CardContent>
          </Card>

          {/* 보수형 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <Badge variant="secondary" className="mb-3">
                보수형
              </Badge>
              <GuidePortfolioPie data={conservativePortfolio} size={160} />
              <p className="text-xs text-muted-foreground mt-2">
                안정성 중시, 은퇴 준비 중인 분
              </p>
            </CardContent>
          </Card>
        </div>
      </GuideSection>
    </div>
  )
}
