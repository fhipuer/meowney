/**
 * 리밸런싱 알림 컴포넌트 냥~ 🐱
 * 대시보드 상단에 표시되는 알림 배너
 */
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { dashboardApi } from '@/lib/api'

export function RebalanceAlert() {
  const [dismissed, setDismissed] = useState(false)

  const { data: alerts } = useQuery({
    queryKey: ['rebalanceAlerts'],
    queryFn: () => dashboardApi.getRebalanceAlerts(undefined, 5.0),
    staleTime: 5 * 60 * 1000,
  })

  if (dismissed || !alerts?.needs_rebalancing) {
    return null
  }

  const topAlert = alerts.alerts[0]

  return (
    <div className="relative rounded-lg border border-yellow-500/50 bg-yellow-50/50 p-4 dark:bg-yellow-950/20">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 text-yellow-700 hover:text-yellow-900 dark:text-yellow-500"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-yellow-800 dark:text-yellow-400">
            리밸런싱이 필요합니다.
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
            {topAlert.category_name}이(가) 목표 대비{' '}
            <span className="font-medium">
              {topAlert.deviation.toFixed(1)}%
            </span>{' '}
            {topAlert.direction === 'over' ? '초과' : '부족'}했습니다.
            {alerts.alerts.length > 1 && ` (외 ${alerts.alerts.length - 1}개)`}
          </p>
          <Link to="/rebalance" className="inline-block mt-2">
            <Button variant="outline" size="sm" className="text-yellow-700 border-yellow-500/50 hover:bg-yellow-100">
              리밸런싱 페이지에서 확인하기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
