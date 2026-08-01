/**
 * 리밸런싱 알림 컴포넌트 냥~ 🐱
 * 대시보드 상단에 표시되는 알림 배너
 */
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '@/lib/api'
import { useSettings } from '@/hooks/useSettings'

export function RebalanceAlert() {
  // 편차 밴드 기본값을 알림 기준으로 사용 냥~
  const { data: settings } = useSettings()
  const alertThreshold = settings?.default_absolute_band ?? 5.0

  const { data: alerts } = useQuery({
    queryKey: ['rebalanceAlerts', alertThreshold],
    queryFn: () => dashboardApi.getRebalanceAlerts(undefined, alertThreshold),
    staleTime: 5 * 60 * 1000,
    enabled: alertThreshold > 0,
  })

  if (!alerts?.needs_rebalancing) {
    return null
  }

  const topAlert = alerts.alerts[0]

  return (
    <div className="flex flex-col gap-3 rounded border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm sm:flex-row sm:items-center dark:border-amber-900 dark:bg-amber-950/20">
      <div className="flex min-w-0 items-center gap-2 text-amber-900 dark:text-amber-300">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="font-medium">배분 점검</span>
        <span className="truncate text-amber-800/80 dark:text-amber-300/80">
          {topAlert.category_name} {Math.abs(topAlert.deviation).toFixed(1)}%p {topAlert.direction === 'over' ? '초과' : '부족'}
          {alerts.alerts.length > 1 && ` · 추가 ${alerts.alerts.length - 1}개`}
        </span>
      </div>
      <Link to="/rebalance" className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-amber-900 hover:underline dark:text-amber-300">
        확인 <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
