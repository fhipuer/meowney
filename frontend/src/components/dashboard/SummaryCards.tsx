/**
 * 대시보드 요약 카드 컴포넌트 냥~ 🐱
 * 글래스모피즘 & 애니메이션 적용
 */
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Cat, Percent } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatKRW, formatPercent, getProfitClass, cn } from '@/lib/utils'
import type { DashboardSummary } from '@/types'

interface SummaryCardsProps {
  summary: DashboardSummary | undefined
  isLoading: boolean
}

interface StatCardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  iconBgClass: string
  valueClass?: string
  delay?: number
}

function StatCard({ title, value, subtitle, icon, iconBgClass, valueClass, delay = 0 }: StatCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden border-0 bg-gradient-to-br from-background to-muted/30',
        'hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5',
        'opacity-0 animate-slide-up'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-bold tracking-tight', valueClass)}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div
            className={cn(
              'h-11 w-11 rounded-xl flex items-center justify-center',
              'shadow-sm',
              iconBgClass
            )}
          >
            {icon}
          </div>
        </div>
        {/* 배경 그라데이션 장식 */}
        <div
          className={cn(
            'absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-10 blur-2xl',
            iconBgClass
          )}
        />
      </CardContent>
    </Card>
  )
}

export function SummaryCards({ summary, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-0 bg-gradient-to-br from-background to-muted/30">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="h-4 w-20 animate-shimmer rounded" />
                  <div className="h-8 w-32 animate-shimmer rounded" />
                  <div className="h-3 w-24 animate-shimmer rounded" />
                </div>
                <div className="h-11 w-11 animate-shimmer rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!summary) {
    return (
      <Card className="p-8 text-center border-0 bg-gradient-to-br from-background to-muted/30">
        <Cat className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-float" />
        <p className="text-muted-foreground">
          아직 자산 데이터가 없습니다.
        </p>
      </Card>
    )
  }

  const isProfitable = summary.total_profit >= 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="총 자산"
        value={formatKRW(summary.total_value)}
        subtitle={`${summary.asset_count}개 자산 보유`}
        icon={<Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        iconBgClass="bg-blue-100 dark:bg-blue-900/30"
        delay={0}
      />

      <StatCard
        title="투자 원금"
        value={formatKRW(summary.total_principal)}
        subtitle="누적 투자 금액"
        icon={<PiggyBank className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
        iconBgClass="bg-purple-100 dark:bg-purple-900/30"
        delay={50}
      />

      <StatCard
        title="총 손익"
        value={`${summary.total_profit >= 0 ? '+' : ''}${formatKRW(summary.total_profit)}`}
        subtitle="평가손익"
        icon={
          isProfitable ? (
            <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
          ) : (
            <TrendingDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          )
        }
        iconBgClass={
          isProfitable
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-blue-100 dark:bg-blue-900/30'
        }
        valueClass={getProfitClass(summary.total_profit)}
        delay={100}
      />

      <StatCard
        title="총 수익률"
        value={formatPercent(summary.profit_rate)}
        subtitle="원금 대비 수익률"
        icon={<Percent className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        iconBgClass="bg-emerald-100 dark:bg-emerald-900/30"
        valueClass={getProfitClass(summary.profit_rate)}
        delay={150}
      />
    </div>
  )
}
