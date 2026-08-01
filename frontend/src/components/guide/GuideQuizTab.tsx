import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { GuidePortfolioPie } from '@/components/guide/GuidePortfolioPie'
import { GuideTipBox } from '@/components/guide/GuideTipBox'
import { RiskProfileIllustration } from '@/components/guide/GuideIllustrations'
import {
  QUIZ_QUESTIONS,
  getQuizResult,
  type QuizResult,
} from '@/data/guide-quiz'
import { PORTFOLIO_TEMPLATES } from '@/data/guide-portfolios'

type QuizState = 'idle' | 'in-progress' | 'complete'

export function GuideQuizTab() {
  const [quizState, setQuizState] = useState<QuizState>('idle')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>(
    Array(QUIZ_QUESTIONS.length).fill(0)
  )
  const [result, setResult] = useState<QuizResult | null>(null)

  const handleSelectOption = (score: number) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[currentQuestion] = score
      return next
    })
  }

  const handleNext = () => {
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1)
    } else {
      // 마지막 질문 - 결과 계산
      const totalScore = answers.reduce((sum, score) => sum + score, 0)
      const quizResult = getQuizResult(totalScore)
      setResult(quizResult)
      setQuizState('complete')
    }
  }

  const handlePrev = () => {
    setCurrentQuestion((prev) => prev - 1)
  }

  const handleRestart = () => {
    setQuizState('idle')
    setCurrentQuestion(0)
    setAnswers(Array(QUIZ_QUESTIONS.length).fill(0))
    setResult(null)
  }

  const totalScore = answers.reduce((sum, score) => sum + score, 0)

  // --- idle: 시작 화면 ---
  if (quizState === 'idle') {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-6">
        <RiskProfileIllustration />
        <h2 className="text-2xl font-bold">나의 투자 성향은?</h2>
        <p className="text-muted-foreground">
          6개의 질문에 답하면 나에게 맞는 투자 스타일과
          <br />
          추천 포트폴리오를 알려드려요!
        </p>
        <p className="text-sm text-muted-foreground">약 2분이면 충분해요</p>
        <Button size="lg" onClick={() => setQuizState('in-progress')}>
          시작하기
        </Button>
        <GuideTipBox variant="tip">
          정답은 없습니다. 현재 상황과 성향에 가장 가까운 답을 선택해주세요.
        </GuideTipBox>
      </div>
    )
  }

  // --- in-progress: 질문 ---
  if (quizState === 'in-progress') {
    const question = QUIZ_QUESTIONS[currentQuestion]
    const QuestionIcon = question.icon
    const isLastQuestion = currentQuestion === QUIZ_QUESTIONS.length - 1
    const isAnswered = answers[currentQuestion] !== 0

    return (
      <div className="space-y-6">
        {/* 진행 바 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              질문 {currentQuestion + 1} / {QUIZ_QUESTIONS.length}
            </span>
            <span>
              {Math.round(
                ((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100
              )}
              %
            </span>
          </div>
          <Progress
            value={((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100}
            className="h-2"
          />
        </div>

        {/* 질문 카드 - key로 re-mount하여 애니메이션 트리거 */}
        <Card
          key={currentQuestion}
          className="max-w-2xl mx-auto animate-slide-up"
        >
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline">Q{question.id}</Badge>
              <QuestionIcon className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl font-semibold">
              {question.question}
            </CardTitle>
            {question.description && (
              <p className="text-sm text-muted-foreground">
                {question.description}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 선택지 목록 */}
            {question.options.map((option) => (
              <div
                key={option.score}
                role="button"
                tabIndex={0}
                className={cn(
                  'border rounded-lg p-4 cursor-pointer transition-all',
                  answers[currentQuestion] === option.score
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
                onClick={() => handleSelectOption(option.score)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectOption(option.score)
                  }
                }}
              >
                <span className="text-sm">{option.text}</span>
              </div>
            ))}

            {/* 네비게이션 버튼 */}
            <div className="flex justify-between mt-6 pt-4">
              <Button
                variant="outline"
                disabled={currentQuestion === 0}
                onClick={handlePrev}
              >
                이전
              </Button>
              <Button disabled={!isAnswered} onClick={handleNext}>
                {isLastQuestion ? '결과 보기' : '다음'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- complete: 결과 화면 ---
  if (quizState === 'complete' && result) {
    const pieData = result.allocationSuggestion.map((item) => ({
      name: item.name,
      value: item.percentage,
      color: item.color,
    }))

    const recommendedPortfolios = result.recommendedPortfolios
      .map((id) => PORTFOLIO_TEMPLATES.find((p) => p.id === id))
      .filter(Boolean)

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 결과 헤더 */}
        <div className="text-center py-6 animate-slide-up">
          <RiskProfileIllustration score={totalScore} className="mb-4" />
          <h2 className="text-3xl font-bold mt-4">{result.nameKo}</h2>
          <Badge variant="secondary" className="mt-3 text-sm">
            {totalScore}/30점
          </Badge>

          {/* 보수 ← → 공격 스펙트럼 바 */}
          <div className="w-full max-w-md mx-auto mt-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>보수적</span>
              <span>공격적</span>
            </div>
            <div className="text-center text-xs text-muted-foreground mt-1">
              내 점수: {totalScore}/30
            </div>
          </div>

          <p className="text-lg text-muted-foreground italic mt-2">
            {result.catPersonality}
          </p>
        </div>

        <Separator />

        {/* 설명 */}
        <Card
          className="animate-slide-up"
          style={{ animationDelay: '100ms' }}
        >
          <CardContent className="p-6">
            <p className="text-base leading-relaxed">{result.description}</p>
          </CardContent>
        </Card>

        {/* 추천 자산 배분 */}
        <div
          className="space-y-4 animate-slide-up"
          style={{ animationDelay: '200ms' }}
        >
          <h3 className="text-lg font-semibold">추천 자산 배분</h3>
          <Card>
            <CardContent className="p-6">
              <GuidePortfolioPie
                data={pieData}
                size={220}
                showLegend={true}
              />
            </CardContent>
          </Card>
        </div>

        {/* 추천 포트폴리오 */}
        <div
          className="space-y-4 animate-slide-up"
          style={{ animationDelay: '300ms' }}
        >
          <h3 className="text-lg font-semibold">추천 포트폴리오</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommendedPortfolios.map((portfolio) => {
              if (!portfolio) return null
              const allocationSummary = portfolio.allocations
                .map((a) => `${a.name} ${a.percentage}%`)
                .join(', ')

              return (
                <Card
                  key={portfolio.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {portfolio.nameKo}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {portfolio.name}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      기대 수익: {portfolio.expectedReturn}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {allocationSummary}
                    </p>
                    <p className="text-xs text-primary mt-1">
                      추천 포트폴리오 탭에서 자세히 확인하세요
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* 액션 버튼 + 팁 */}
        <div
          className="space-y-4 animate-slide-up"
          style={{ animationDelay: '400ms' }}
        >
          <div className="flex justify-center gap-4 mt-8">
            <Button variant="outline" onClick={handleRestart}>
              다시 하기
            </Button>
          </div>
          <GuideTipBox variant="tip">
            투자 성향은 시간에 따라 변할 수 있어요. 가끔 다시 테스트해보세요!
          </GuideTipBox>
        </div>
      </div>
    )
  }

  return null
}
