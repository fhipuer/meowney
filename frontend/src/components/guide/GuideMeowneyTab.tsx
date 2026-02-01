import { useState } from 'react'
import {
  PlusCircle,
  Target,
  RefreshCw,
  BarChart3,
  ArrowRight,
  FolderOpen,
  File,
  Star,
  SlidersHorizontal,
  CalendarCheck,
  TrendingUp,
  ChevronDown,
  Compass,
} from 'lucide-react'
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
import { GuidePortfolioPie } from '@/components/guide/GuidePortfolioPie'

// --- Static data ---

const flowSteps = [
  {
    icon: PlusCircle,
    label: '자산 등록',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    iconColor: 'text-blue-500',
  },
  {
    icon: Target,
    label: '플랜 설정',
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    iconColor: 'text-purple-500',
  },
  {
    icon: RefreshCw,
    label: '리밸런싱 확인',
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    iconColor: 'text-orange-500',
  },
  {
    icon: BarChart3,
    label: '대시보드 확인',
    bg: 'bg-green-50 dark:bg-green-950/20',
    iconColor: 'text-green-500',
  },
]

const mockFields = [
  { label: '종목명', value: 'KODEX 200' },
  { label: '티커', value: '069500.KS' },
  { label: '수량', value: '50' },
  { label: '평균단가', value: '35,000' },
  { label: '카테고리', value: '국내주식' },
]

const fieldDescriptions = [
  { field: '종목명', desc: '자산의 이름 (자유롭게 입력)' },
  { field: '티커', desc: '주식/ETF 코드 (입력 시 실시간 가격 조회)' },
  { field: '수량', desc: '보유 수량' },
  { field: '평균단가', desc: '매수 평균 가격' },
  { field: '카테고리', desc: '국내주식, 해외주식, 채권, 현금 등' },
]

const categoryTree = [
  {
    name: '국내주식',
    children: ['KODEX 200', 'TIGER 코스피'],
  },
  {
    name: '해외주식',
    children: ['VOO', 'QQQ'],
  },
  {
    name: '채권',
    children: ['KODEX 국고채', 'TLT'],
  },
  {
    name: '현금',
    children: ['CMA/MMF'],
  },
  {
    name: '대체자산',
    children: ['금 ETF'],
  },
]

const individualPie = [
  { name: 'KODEX 200', value: 20, color: '#ef4444' },
  { name: 'VOO', value: 30, color: '#f97316' },
  { name: '국고채 ETF', value: 25, color: '#3b82f6' },
  { name: 'CMA', value: 10, color: '#22c55e' },
  { name: '금 ETF', value: 15, color: '#eab308' },
]

const groupPie = [
  { name: '국내주식', value: 25, color: '#ef4444' },
  { name: '해외주식', value: 35, color: '#f97316' },
  { name: '채권', value: 30, color: '#3b82f6' },
  { name: '현금', value: 10, color: '#22c55e' },
]

const rebalanceRows = [
  {
    asset: '국내주식',
    current: '30%',
    target: '25%',
    diff: '+5%p',
    action: '매도',
    actionColor: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  },
  {
    asset: '해외주식',
    current: '32%',
    target: '35%',
    diff: '-3%p',
    action: '매수',
    actionColor:
      'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  },
  {
    asset: '채권',
    current: '28%',
    target: '30%',
    diff: '-2%p',
    action: '매수',
    actionColor:
      'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  },
  {
    asset: '현금',
    current: '10%',
    target: '10%',
    diff: '0%p',
    action: '유지',
    actionColor:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
]

const tips = [
  {
    icon: Star,
    title: '메인 플랜 설정',
    desc: '자주 쓰는 플랜은 메인 플랜으로 설정하세요',
  },
  {
    icon: SlidersHorizontal,
    title: '허용 오차 활용',
    desc: '±5% 이상 벗어났을 때만 조정 추천',
  },
  {
    icon: CalendarCheck,
    title: '정기 체크 루틴',
    desc: '매일 1분, 매월 5분, 분기 10분',
  },
  {
    icon: TrendingUp,
    title: '신규 자금 활용',
    desc: '비중이 낮은 자산에 집중 투자',
  },
]

const faqItems = [
  {
    question: '자산을 추가했는데 가격이 안 나와요',
    answer:
      '국내: 종목코드.KS (예: 005930.KS), 미국: 그대로 (예: VOO, AAPL)',
  },
  {
    question: '플랜 비율이 100%가 안 돼요',
    answer: '모든 배분의 합이 100%가 되어야 합니다.',
  },
  {
    question: '리밸런싱을 꼭 해야 하나요?',
    answer:
      '의무는 아니지만, ±5~10% 이상 벗어났다면 조정을 추천합니다.',
  },
]

// --- Component ---

export function GuideMeowneyTab() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="space-y-8">
      {/* Section 1: 전체 흐름 */}
      <GuideSection
        icon={Compass}
        title="전체 흐름"
        description="Meowney 사용 4단계"
        delay={0}
      >
        <div className="flex flex-wrap justify-center gap-4 items-center">
          {flowSteps.map((step, i) => {
            const StepIcon = step.icon
            return (
              <div key={i} className="flex items-center gap-4">
                <Card
                  className={cn(
                    'hover:shadow-md transition-shadow',
                    step.bg
                  )}
                >
                  <CardContent className="p-4 text-center flex flex-col items-center gap-2 min-w-[120px]">
                    <Badge variant="secondary" className="text-xs">
                      {i + 1}단계
                    </Badge>
                    <div className="w-10 h-10 rounded-full bg-background/80 flex items-center justify-center">
                      <StepIcon className={cn('w-5 h-5', step.iconColor)} />
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                  </CardContent>
                </Card>
                {i < flowSteps.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground hidden sm:block flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </GuideSection>

      <Separator />

      {/* Section 2: 1단계 - 자산 등록하기 */}
      <GuideSection
        icon={PlusCircle}
        title="1단계: 자산 등록하기"
        description="보유 자산을 하나씩 등록하세요"
        delay={100}
      >
        {/* Mock form */}
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mockFields.map((field) => (
                <div key={field.label}>
                  <div className="text-xs text-muted-foreground mb-1">
                    {field.label}
                  </div>
                  <div className="bg-muted rounded-md px-3 py-2 text-sm">
                    {field.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Field descriptions */}
        <Card>
          <CardContent className="p-5">
            <div className="space-y-2">
              {fieldDescriptions.map((item) => (
                <div
                  key={item.field}
                  className="flex items-start gap-3 text-sm"
                >
                  <span className="font-medium min-w-[60px]">
                    {item.field}
                  </span>
                  <span className="text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category tree */}
        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-medium mb-3">카테고리 예시</div>
            <div className="space-y-2">
              {categoryTree.map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FolderOpen className="w-4 h-4 text-yellow-500" />
                    {cat.name}
                  </div>
                  <div className="ml-6 space-y-1 mt-1">
                    {cat.children.map((child) => (
                      <div
                        key={child}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <File className="w-3.5 h-3.5" />
                        {child}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <GuideTipBox variant="tip">
          티커를 입력하면 현재가를 자동으로 가져와요! 수동 입력도 가능합니다.
        </GuideTipBox>
      </GuideSection>

      <Separator />

      {/* Section 3: 2단계 - 리밸런싱 플랜 만들기 */}
      <GuideSection
        icon={Target}
        title="2단계: 리밸런싱 플랜 만들기"
        description="목표 비율을 설정하세요"
        delay={200}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <span className="font-bold mb-3">개별 자산 배분</span>
              <GuidePortfolioPie data={individualPie} size={180} />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <span className="font-bold mb-3">그룹 배분</span>
              <GuidePortfolioPie data={groupPie} size={180} />
            </CardContent>
          </Card>
        </div>

        <GuideTipBox variant="tip">
          처음에는 그룹 배분이 더 쉬워요! 자산이 많아지면 개별 배분으로 세밀하게
          관리하세요.
        </GuideTipBox>
      </GuideSection>

      <Separator />

      {/* Section 4: 3단계 - 리밸런싱 확인하기 */}
      <GuideSection
        icon={RefreshCw}
        title="3단계: 리밸런싱 확인하기"
        description="자동 계산된 매매 제안을 확인하세요"
        delay={300}
      >
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">자산</th>
                  <th className="text-center p-3 font-medium">현재</th>
                  <th className="text-center p-3 font-medium">목표</th>
                  <th className="text-center p-3 font-medium">차이</th>
                  <th className="text-center p-3 font-medium">제안</th>
                </tr>
              </thead>
              <tbody>
                {rebalanceRows.map((row) => (
                  <tr key={row.asset} className="border-b last:border-b-0">
                    <td className="p-3 font-medium">{row.asset}</td>
                    <td className="p-3 text-center">{row.current}</td>
                    <td className="p-3 text-center">{row.target}</td>
                    <td className="p-3 text-center">{row.diff}</td>
                    <td className="p-3 text-center">
                      <Badge
                        className={cn(
                          'text-xs font-medium border-0',
                          row.actionColor
                        )}
                      >
                        {row.action}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center">
          Meowney가 얼마를 사고팔아야 하는지 자동으로 계산해줍니다!
        </p>
      </GuideSection>

      <Separator />

      {/* Section 5: 4단계 - 대시보드 */}
      <GuideSection
        icon={BarChart3}
        title="4단계: 대시보드"
        description="전체 현황을 한눈에 확인하세요"
        delay={400}
      >
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">
                  총 자산
                </div>
                <div className="text-xl font-bold">10,500,000원</div>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">
                  총 수익
                </div>
                <div className="text-xl font-bold text-red-500">
                  +500,000원 (+5.00%)
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              대시보드에서 전체 현황을 한눈에 확인하세요
            </p>
          </CardContent>
        </Card>
      </GuideSection>

      <Separator />

      {/* Section 6: 활용 팁 */}
      <GuideSection
        icon={Star}
        title="활용 팁"
        description="Meowney를 더 잘 활용하는 방법"
        delay={500}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tips.map((tip) => {
            const TipIcon = tip.icon
            return (
              <Card
                key={tip.title}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
                    <TipIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-sm mb-1">{tip.title}</div>
                    <p className="text-sm text-muted-foreground">{tip.desc}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </GuideSection>

      <Separator />

      {/* Section 7: 자주 하는 질문 */}
      <GuideSection
        icon={BarChart3}
        title="자주 하는 질문"
        description="궁금한 점을 확인하세요"
        delay={600}
      >
        <div className="space-y-2">
          {faqItems.map((faq, index) => (
            <Collapsible
              key={index}
              open={openFaq === index}
              onOpenChange={(open) => setOpenFaq(open ? index : null)}
            >
              <CollapsibleTrigger className="w-full">
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-left">
                      Q. {faq.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ml-2',
                        openFaq === index && 'rotate-180'
                      )}
                    />
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 py-3 text-sm text-muted-foreground bg-muted/50 rounded-b-lg -mt-1 mx-0.5">
                  A. {faq.answer}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        <GuideTipBox variant="tip">
          완벽한 타이밍보다 꾸준한 실천이 중요해요. 고양이처럼 느긋하게, 하지만
          규칙적으로 관리해보세요!
        </GuideTipBox>
      </GuideSection>
    </div>
  )
}
