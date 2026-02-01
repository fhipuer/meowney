import { useState } from 'react'
import {
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Calendar,
  Activity,
  Layers,
  ArrowLeftRight,
  PlusCircle,
  ArrowRight,
  AlertTriangle,
  Calculator,
  Coffee,
  ClipboardCheck,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { GuideSection } from '@/components/guide/GuideSection'
import { GuideTipBox } from '@/components/guide/GuideTipBox'
import { GuidePortfolioPie } from '@/components/guide/GuidePortfolioPie'

// --- Static data ---

const targetPie = [
  { name: '주식', value: 60, color: '#ef4444' },
  { name: '채권', value: 30, color: '#3b82f6' },
  { name: '현금', value: 10, color: '#22c55e' },
]

const driftedPie = [
  { name: '주식', value: 75, color: '#ef4444' },
  { name: '채권', value: 20, color: '#3b82f6' },
  { name: '현금', value: 5, color: '#22c55e' },
]

const riskComparisonData = [
  { name: '리밸런싱 안 함\n(주식 80%)', value: -16 },
  { name: '리밸런싱 함\n(주식 60%)', value: -12 },
]

const riskBarColors = ['#ef4444', '#3b82f6']

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--popover-foreground))',
  borderRadius: '0.5rem',
}

const profitSteps = [
  '주식이 많이 올랐다',
  '주식 매도 (비쌀 때 팔기)',
  '채권 매수 (쌀 때 사기)',
]

const checklistItems = [
  '현재 자산 비율 확인',
  '목표 비율과 비교',
  '허용 범위 내인지 확인',
  '매도/매수할 자산 결정',
  '세금/수수료 영향 확인',
  '거래 실행',
  '결과 확인',
]

const periodicRows = [
  { period: '월간', pros: '세밀', cons: '비용 증가', recommended: false },
  { period: '분기', pros: '적당', cons: '', recommended: true },
  { period: '연간', pros: '간단', cons: '많이 벗어남', recommended: false },
]

const timelineDots = ['1월', '4월', '7월', '10월']

// --- Component ---

export function GuideRebalancingTab() {
  const [checked, setChecked] = useState<boolean[]>(Array(7).fill(false))

  const toggleCheck = (index: number) => {
    setChecked((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const completedCount = checked.filter(Boolean).length

  return (
    <div className="space-y-8">
      {/* Section 1: 리밸런싱이란? */}
      <GuideSection
        icon={RefreshCw}
        title="리밸런싱이란?"
        description="포트폴리오 비율을 원래 목표대로 되돌리는 것"
        delay={0}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Column 1: 처음 설정 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <span className="text-sm font-medium text-muted-foreground mb-2">
                처음 설정
              </span>
              <GuidePortfolioPie
                data={targetPie}
                size={150}
                centerLabel="목표"
                showLegend={false}
              />
            </CardContent>
          </Card>

          <div className="hidden md:flex items-center justify-center">
            <ArrowRight className="w-6 h-6 text-muted-foreground" />
          </div>

          {/* Column 2: 비율 틀어짐 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <Badge variant="destructive" className="mb-2">
                비율 틀어짐!
              </Badge>
              <GuidePortfolioPie
                data={driftedPie}
                size={150}
                centerLabel="6개월 후"
                showLegend={false}
              />
            </CardContent>
          </Card>

          <div className="hidden md:flex items-center justify-center">
            <ArrowRight className="w-6 h-6 text-muted-foreground" />
          </div>

          {/* Column 3: 원래대로 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <Badge
                variant="default"
                className="mb-2 bg-green-500 hover:bg-green-500/80"
              >
                원래대로!
              </Badge>
              <GuidePortfolioPie
                data={targetPie}
                size={150}
                centerLabel="리밸런싱 후"
                showLegend={false}
              />
            </CardContent>
          </Card>
        </div>

        <p className="text-muted-foreground text-center">
          주식이 많이 올라서 비중이 커졌다면, 주식을 팔고 채권/현금을 사서 원래
          비율로 맞춥니다.
        </p>
      </GuideSection>

      <Separator />

      {/* Section 2: 왜 리밸런싱을 해야 할까? */}
      <GuideSection
        icon={Shield}
        title="왜 리밸런싱을 해야 할까?"
        description="위험 관리, 수익 실현, 원칙 유지"
        delay={100}
      >
        <div className="space-y-4">
          {/* 위험 관리 */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-blue-500" />
                <span className="font-bold">위험 관리</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                주식이 -20% 하락했을 때 전체 포트폴리오 손실
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                  />
                  <YAxis
                    domain={[-20, 0]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value}%`, '손실률']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {riskComparisonData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={riskBarColors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 자동 수익 실현 */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <span className="font-bold">자동 수익 실현</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {profitSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="p-3 rounded-lg bg-muted text-sm text-center">
                      {step}
                    </div>
                    {i < profitSteps.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block flex-shrink-0" />
                    )}
                  </div>
                ))}
                <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block flex-shrink-0" />
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm font-medium text-green-600 dark:text-green-400 text-center">
                  자연스러운 수익 실현!
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 투자 원칙 유지 */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-purple-500" />
                <span className="font-bold">투자 원칙 유지</span>
              </div>
              <p className="text-muted-foreground">
                감정에 휘둘리지 않고 기계적으로 투자할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        </div>

        <GuideTipBox variant="tip">
          고양이가 털 빠짐 시즌마다 그루밍하듯, 포트폴리오도 주기적인 정리가
          필요해요!
        </GuideTipBox>
      </GuideSection>

      <Separator />

      {/* Section 3: 리밸런싱 방법 */}
      <GuideSection
        icon={Calendar}
        title="리밸런싱 방법"
        description="정기, 밴드, 하이브리드 방식"
        delay={200}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 정기 리밸런싱 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span className="font-bold">정기 리밸런싱</span>
              </div>
              <div className="space-y-2 mb-4">
                {periodicRows.map((row) => (
                  <div
                    key={row.period}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{row.period}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {row.pros}
                        {row.cons && ` / ${row.cons}`}
                      </span>
                      {row.recommended && (
                        <Badge variant="default" className="text-xs">
                          추천!
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Timeline visualization */}
              <div className="flex items-center justify-between px-2">
                {timelineDots.map((label, i) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    {i < timelineDots.length - 1 && (
                      <div className="hidden" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="relative mt-[-22px] mb-4 mx-3.5">
                <div className="h-0.5 bg-blue-300 dark:bg-blue-700 w-full" />
              </div>
            </CardContent>
          </Card>

          {/* 밴드 리밸런싱 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-orange-500" />
                <span className="font-bold">밴드 리밸런싱</span>
              </div>
              {/* Band diagram */}
              <div className="space-y-3 my-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    65%
                  </span>
                  <div className="flex-1 border-t-2 border-dashed border-red-400" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-8 text-right">60%</span>
                  <div className="flex-1 border-t-2 border-primary" />
                  <span className="text-xs font-medium text-primary">목표</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    55%
                  </span>
                  <div className="flex-1 border-t-2 border-dashed border-red-400" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                목표 ±5% 벗어나면 리밸런싱 실행!
              </p>
            </CardContent>
          </Card>

          {/* 하이브리드 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-5 h-5 text-green-500" />
                <span className="font-bold">하이브리드</span>
              </div>
              <Badge
                variant="default"
                className="mb-3 bg-green-500 hover:bg-green-500/80"
              >
                가장 실용적!
              </Badge>
              <p className="text-sm text-muted-foreground">
                기본: 분기마다 체크
              </p>
              <p className="text-sm text-muted-foreground">
                + 추가: ±10% 벗어나면 즉시 리밸런싱
              </p>
            </CardContent>
          </Card>
        </div>
      </GuideSection>

      <Separator />

      {/* Section 4: 리밸런싱 실행하기 */}
      <GuideSection
        icon={ArrowLeftRight}
        title="리밸런싱 실행하기"
        description="두 가지 접근 방식"
        delay={300}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 매도-매수 방식 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                <span className="font-bold">매도-매수 방식</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-500 font-medium">
                    주식 70% → 목표 60% = 10%p 초과 → 매도
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-500 font-medium">
                    채권 25% → 목표 30% = 5%p 부족 → 매수
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-500 font-medium">
                    현금 5% → 목표 10% = 5%p 부족 → 확보
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 신규 자금 활용 */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <PlusCircle className="w-5 h-5 text-green-500" />
                <span className="font-bold">신규 자금 활용</span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>월급에서 100만원 추가 투자 시</p>
                <p>→ 100만원 전액을 채권/현금에 투자</p>
                <p>→ 매도 없이 비율 조정!</p>
              </div>
              <Badge variant="secondary" className="mt-3">
                세금/수수료 절약
              </Badge>
            </CardContent>
          </Card>
        </div>
      </GuideSection>

      <Separator />

      {/* Section 5: 주의사항 */}
      <GuideSection
        icon={AlertTriangle}
        title="주의사항"
        description="리밸런싱 전에 꼭 확인하세요"
        delay={400}
      >
        <div className="space-y-3">
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-1">세금</div>
                <p className="text-sm text-muted-foreground">
                  해외 주식: 연 250만원 초과 수익 시 22% 과세
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4 flex items-start gap-3">
              <Calculator className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-1">수수료</div>
                <p className="text-sm text-muted-foreground">
                  ETF 매매 수수료: 약 0.015~0.5%. 너무 자주 리밸런싱하면 손해!
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4 flex items-start gap-3">
              <Coffee className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-1">급하지 않게</div>
                <p className="text-sm text-muted-foreground">
                  하루이틀 차이는 큰 의미가 없습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <GuideTipBox variant="tip">
          고양이가 천천히 스트레칭하듯, 리밸런싱도 서두르지 말고 여유롭게!
        </GuideTipBox>
      </GuideSection>

      <Separator />

      {/* Section 6: 리밸런싱 체크리스트 */}
      <GuideSection
        icon={ClipboardCheck}
        title="리밸런싱 체크리스트"
        description="하나씩 확인하며 진행하세요"
        delay={500}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Progress
              value={(completedCount / 7) * 100}
              className="flex-1 h-3"
            />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {completedCount}/7 완료
            </span>
          </div>

          <div className="space-y-2">
            {checklistItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={checked[index]}
                  onCheckedChange={() => toggleCheck(index)}
                  id={`checklist-${index}`}
                />
                <label
                  htmlFor={`checklist-${index}`}
                  className={`text-sm cursor-pointer select-none ${
                    checked[index]
                      ? 'line-through text-muted-foreground'
                      : 'text-foreground'
                  }`}
                >
                  {item}
                </label>
              </div>
            ))}
          </div>
        </div>
      </GuideSection>
    </div>
  )
}
