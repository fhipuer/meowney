/**
 * 대시보드 요약 카드 컴포넌트 냥~ 🐱
 * 글래스모피즘 & 애니메이션 적용
 */
import { AlertTriangle, ArrowRight, CalendarDays, Clock3, TrendingUp, TrendingDown, Wallet, PiggyBank, Cat, Percent } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatApproxKRW, formatDate, formatKRW, formatPercent, getProfitClass, cn, maskValue } from '@/lib/utils'
import { useStore } from '@/store/useStore'
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
  className?: string
  prominent?: boolean
}

function StatCard({ title, value, subtitle, icon, iconBgClass, valueClass, delay = 0, className, prominent = false }: StatCardProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden bg-white dark:bg-card',
        'shadow-none transition-colors duration-[330ms]',
        'opacity-0 animate-slide-up',
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="min-w-0 p-5 !pt-5" data-testid="summary-card-content">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm font-medium text-muted-foreground">{title}</p>
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded',
              iconBgClass
            )}
          >
            {icon}
          </div>
        </div>
        <div className="mt-4 min-w-0 space-y-2">
          <p className={cn(
            'whitespace-nowrap font-medium leading-none tracking-tight',
            prominent ? 'text-[clamp(1.75rem,2.35vw,2.25rem)]' : 'text-[clamp(1.5rem,2vw,1.875rem)]',
            valueClass
          )}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {/* 배경 그라데이션 장식 */}
      </CardContent>
    </Card>
  )
}

export function SummaryCards({ summary, isLoading }: SummaryCardsProps) {
  const { isPrivacyMode } = useStore()

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className={cn(
            'border-0 bg-gradient-to-br from-background to-muted/30',
            i === 4 ? 'md:col-span-2 xl:col-span-4' : ''
          )}>
            <CardContent className="p-5 !pt-5">
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
      <Card className="p-8 text-center">
        <Cat className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-float" />
        <p className="text-muted-foreground">
          아직 자산 데이터가 없습니다.
        </p>
      </Card>
    )
  }

  const isProfitable = summary.total_profit >= 0
  const hasAnnualBaseline = summary.annual_baseline_value != null && summary.annual_baseline_date != null
  const annualChange = hasAnnualBaseline
    ? summary.total_value - summary.annual_baseline_value!
    : null

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {(!summary.valuation_complete || summary.stale_asset_count > 0) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900 md:col-span-2 xl:col-span-4 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
          {summary.valuation_complete ? <Clock3 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <p>
            {summary.unavailable_asset_count > 0 && `${summary.unavailable_asset_count}개 자산의 시세를 확인하지 못했습니다. `}
            {summary.stale_asset_count > 0 && `${summary.stale_asset_count}개 자산은 마지막 정상 시세를 사용했습니다.`}
          </p>
        </div>
      )}
      <StatCard
        title="총 자산"
        value={maskValue(formatKRW(summary.total_value), isPrivacyMode)}
        subtitle={`${summary.asset_count}개 자산 보유`}
        icon={<Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        iconBgClass="bg-blue-100 dark:bg-blue-900/30"
        delay={0}
        prominent
      />

      <StatCard
        title="투자 원금"
        value={maskValue(formatKRW(summary.total_principal), isPrivacyMode)}
        subtitle="누적 투자 금액"
        icon={<PiggyBank className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
        iconBgClass="bg-purple-100 dark:bg-purple-900/30"
        delay={50}
      />

      <StatCard
        title="총 손익"
        value={maskValue(`${summary.total_profit >= 0 ? '+' : ''}${formatKRW(summary.total_profit)}`, isPrivacyMode)}
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
        valueClass={isPrivacyMode ? '' : getProfitClass(summary.total_profit)}
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

      <Card
        className="overflow-hidden border-0 bg-gradient-to-r from-amber-50/80 via-background to-orange-50/70 opacity-0 animate-slide-up md:col-span-2 xl:col-span-4 dark:from-amber-950/20 dark:to-orange-950/10"
        style={{ animationDelay: '200ms' }}
      >
        <CardContent className="p-5 !pt-5 sm:p-6 sm:!pt-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-[190px]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold">연간 자산증감</p>
                  <p className="text-xs text-muted-foreground">저축과 소비를 포함한 순자산 변화</p>
                </div>
              </div>
            </div>

            {hasAnnualBaseline ? (
              <>
                <div className="flex flex-1 items-center gap-4 sm:gap-8 lg:justify-center">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">시작 자산</p>
                    <p className="mt-1 text-lg font-bold sm:text-xl">
                      {maskValue(formatApproxKRW(summary.annual_baseline_value!), isPrivacyMode)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(summary.annual_baseline_date!)} 기준
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">현재 자산</p>
                    <p className="mt-1 text-lg font-bold sm:text-xl">
                      {maskValue(formatApproxKRW(summary.total_value), isPrivacyMode)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">현재 총 자산 기준</p>
                  </div>
                </div>

                <div className="border-t pt-4 lg:min-w-[190px] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 lg:text-right">
                  <p className="text-xs text-muted-foreground">연간 자산증감률</p>
                  <p className={cn(
                    'mt-1 text-3xl font-bold',
                    summary.annual_asset_change_rate == null
                      ? 'text-muted-foreground'
                      : getProfitClass(summary.annual_asset_change_rate)
                  )}>
                    {summary.annual_asset_change_rate == null
                      ? '-'
                      : formatPercent(summary.annual_asset_change_rate)}
                  </p>
                  {annualChange != null && (
                    <p className={cn('mt-1 text-sm font-medium', isPrivacyMode ? '' : getProfitClass(annualChange))}>
                      {maskValue(`${annualChange >= 0 ? '+' : ''}${formatApproxKRW(annualChange)}`, isPrivacyMode)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                연초 기준 스냅샷이 없어 시작 자산을 계산할 수 없습니다.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
