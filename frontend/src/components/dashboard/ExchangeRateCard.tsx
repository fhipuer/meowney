/**
 * 환율 카드 컴포넌트 냥~ 🐱
 * USD/KRW 현재 환율 표시
 */
import { RefreshCw, DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useExchangeRate } from '@/hooks/useDashboard'
import { formatKRW } from '@/lib/utils'

export function ExchangeRateCard() {
  const { data: exchangeRate, isLoading, refetch, isFetching } = useExchangeRate()

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-200/50 dark:border-emerald-800/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">USD/KRW 환율</p>
              {isLoading ? (
                <div className="h-6 w-24 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {exchangeRate ? formatKRW(exchangeRate.rate) : '-'}
                </p>
              )}
              {exchangeRate && (
                <p className="text-xs text-muted-foreground">
                  {formatTime(exchangeRate.timestamp)} 기준
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
