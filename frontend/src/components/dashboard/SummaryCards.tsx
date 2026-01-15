/**
 * 대시보드 요약 카드 컴포넌트 냥~ 🐱
 */
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Cat } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatKRW, formatPercent, getProfitClass } from '@/lib/utils'
import type { DashboardSummary } from '@/types'

interface SummaryCardsProps {
  summary: DashboardSummary | undefined
  isLoading: boolean
}

export function SummaryCards({ summary, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!summary) {
    return (
      <Card className="p-8 text-center">
        <Cat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          아직 자산 데이터가 없습니다.
        </p>
      </Card>
    )
  }

  const isProfitable = summary.total_profit >= 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 총 자산 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 자산</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatKRW(summary.total_value)}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.asset_count}개 자산 보유
          </p>
        </CardContent>
      </Card>

      {/* 투자 원금 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">투자 원금</CardTitle>
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatKRW(summary.total_principal)}
          </div>
          <p className="text-xs text-muted-foreground">
            누적 투자 금액
          </p>
        </CardContent>
      </Card>

      {/* 총 손익 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 손익</CardTitle>
          {isProfitable ? (
            <TrendingUp className="h-4 w-4 text-red-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-blue-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getProfitClass(summary.total_profit)}`}>
            {summary.total_profit >= 0 ? '+' : ''}
            {formatKRW(summary.total_profit)}
          </div>
          <p className="text-xs text-muted-foreground">
            평가손익
          </p>
        </CardContent>
      </Card>

      {/* 수익률 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 수익률</CardTitle>
          <Cat className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getProfitClass(summary.profit_rate)}`}>
            {formatPercent(summary.profit_rate)}
          </div>
          <p className="text-xs text-muted-foreground">
            원금 대비 수익률
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
