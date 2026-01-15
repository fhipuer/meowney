/**
 * 대시보드 페이지 냥~ 🐱
 */
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { PortfolioDonut } from '@/components/dashboard/PortfolioDonut'
import { AssetTrendChart } from '@/components/dashboard/AssetTrendChart'
import { RebalanceAlert } from '@/components/dashboard/RebalanceAlert'
import { GoalProgress } from '@/components/dashboard/GoalProgress'
import { useDashboardSummary, useAssetHistory } from '@/hooks/useDashboard'

export function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary()
  const { data: history, isLoading: historyLoading } = useAssetHistory()

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          자산 현황을 한눈에 확인하세요.
        </p>
      </div>

      {/* 리밸런싱 알림 */}
      <RebalanceAlert />

      {/* 요약 카드 */}
      <SummaryCards summary={summary} isLoading={summaryLoading} />

      {/* 차트 영역 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PortfolioDonut
          allocations={summary?.allocations}
          isLoading={summaryLoading}
        />
        <AssetTrendChart history={history} isLoading={historyLoading} />
      </div>

      {/* 목표 진행률 (목표가 설정된 경우에만 표시) */}
      <GoalProgress />
    </div>
  )
}
