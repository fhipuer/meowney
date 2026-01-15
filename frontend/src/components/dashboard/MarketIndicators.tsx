/**
 * 시장 현황 지표 컴포넌트 냥~ 🐱
 */
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, RefreshCw, Activity, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { dashboardApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export function MarketIndicators() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['marketIndicators'],
    queryFn: dashboardApi.getMarketIndicators,
    staleTime: 5 * 60 * 1000, // 5분
    refetchInterval: 10 * 60 * 1000, // 10분마다 자동 갱신
  })

  // 지표별 아이콘 및 설명
  const getIndicatorInfo = (ticker: string) => {
    switch (ticker) {
      case '^KS11':
        return { description: '한국 종합주가지수' }
      case '^GSPC':
        return { description: '미국 대형주 500개' }
      case '^IXIC':
        return { description: '미국 기술주 중심' }
      case '^VIX':
        return { description: '시장 변동성/공포지수' }
      case 'USDKRW=X':
        return { description: '달러당 원화' }
      default:
        return { description: '' }
    }
  }

  // VIX 레벨 표시
  const getVixLevel = (price: number) => {
    if (price < 15) return { level: '안정', color: 'text-green-500' }
    if (price < 25) return { level: '보통', color: 'text-yellow-500' }
    if (price < 35) return { level: '불안', color: 'text-orange-500' }
    return { level: '공포', color: 'text-red-500' }
  }

  // 숫자 포맷
  const formatPrice = (price: number, ticker: string) => {
    if (ticker === 'USDKRW=X') {
      return `₩${price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    if (ticker === '^VIX') {
      return price.toFixed(2)
    }
    return price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (isLoading) {
    return (
      <Card className="border-0 bg-gradient-to-br from-background to-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            시장 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50 animate-pulse">
                <div className="h-3 w-16 bg-muted rounded mb-2" />
                <div className="h-5 w-20 bg-muted rounded mb-1" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-background to-muted/30 opacity-0 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            시장 현황
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2"
          >
            <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {data?.indicators.map((indicator) => {
            const info = getIndicatorInfo(indicator.ticker)
            const isVix = indicator.ticker === '^VIX'
            const vixInfo = isVix ? getVixLevel(indicator.price) : null
            const isPositive = indicator.change_rate >= 0

            return (
              <div
                key={indicator.ticker}
                className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {indicator.name}
                  </span>
                  {isVix ? (
                    <Activity className={cn('h-3 w-3', vixInfo?.color)} />
                  ) : isPositive ? (
                    <TrendingUp className="h-3 w-3 text-red-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-blue-500" />
                  )}
                </div>

                <div className="font-semibold text-sm">
                  {formatPrice(indicator.price, indicator.ticker)}
                </div>

                <div className="flex items-center justify-between mt-1">
                  {isVix ? (
                    <span className={cn('text-xs font-medium', vixInfo?.color)}>
                      {vixInfo?.level}
                    </span>
                  ) : (
                    <span className={cn(
                      'text-xs',
                      isPositive ? 'text-red-500' : 'text-blue-500'
                    )}>
                      {isPositive ? '+' : ''}{indicator.change_rate.toFixed(2)}%
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground truncate ml-1">
                    {info.description}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {data?.timestamp && (
          <p className="text-[10px] text-muted-foreground text-right mt-2">
            마지막 업데이트: {new Date(data.timestamp).toLocaleTimeString('ko-KR')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
