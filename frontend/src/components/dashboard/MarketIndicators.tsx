/**
 * 시장 현황 지표 컴포넌트 냥~ 🐱
 */
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, RefreshCw, Activity, Globe, Scale, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { dashboardApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { GoldSilverRatio, IndexPer } from '@/types'

export function MarketIndicators() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['marketIndicators'],
    queryFn: dashboardApi.getMarketIndicators,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  const getIndicatorInfo = (ticker: string) => {
    switch (ticker) {
      case '^KS11': return { description: '한국 종합주가지수' }
      case '^GSPC': return { description: '미국 대형주 500개' }
      case '^IXIC': return { description: '미국 기술주 중심' }
      case '^VIX':  return { description: '시장 변동성/공포지수' }
      case 'USDKRW=X': return { description: '달러당 원화' }
      default: return { description: '' }
    }
  }

  const getVixLevel = (price: number) => {
    if (price < 15) return { level: '안정', color: 'text-green-500' }
    if (price < 25) return { level: '보통', color: 'text-yellow-500' }
    if (price < 35) return { level: '불안', color: 'text-orange-500' }
    return { level: '공포', color: 'text-red-500' }
  }

  const getGoldSilverRatioLevel = (ratio: number) => {
    if (ratio < 60) return { level: '은 고평가', color: 'text-blue-500' }
    if (ratio < 80) return { level: '적정', color: 'text-green-500' }
    if (ratio < 90) return { level: '금 고평가', color: 'text-yellow-500' }
    return { level: '금 극고평가', color: 'text-red-500' }
  }

  const getPerLevel = (per: number) => {
    if (per < 15) return { level: '저평가', color: 'text-blue-500' }
    if (per < 20) return { level: '적정', color: 'text-green-500' }
    if (per < 25) return { level: '고평가', color: 'text-yellow-500' }
    return { level: '버블주의', color: 'text-red-500' }
  }

  const formatPrice = (price: number, ticker: string) => {
    if (ticker === 'USDKRW=X') {
      return `₩${price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    if (ticker === '^VIX') return price.toFixed(2)
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50 animate-pulse">
                <div className="h-3 w-16 bg-muted rounded mb-2" />
                <div className="h-5 w-20 bg-muted rounded mb-1" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50 animate-pulse">
                <div className="h-3 w-20 bg-muted rounded mb-2" />
                <div className="h-5 w-24 bg-muted rounded mb-1" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const goldSilver: GoldSilverRatio | null = data?.gold_silver_ratio ?? null
  const indexPer: IndexPer | null = data?.index_per ?? null

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
      <CardContent className="space-y-4">

        {/* 기존 지수 지표 */}
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
                    <span className={cn('text-xs', isPositive ? 'text-red-500' : 'text-blue-500')}>
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

        {/* 금/은 비율 + PER 섹션 */}
        <div className="border-t border-muted/50 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* 금/은 비율 */}
            <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-1.5 mb-2">
                <Scale className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-xs font-medium text-muted-foreground">금/은 비율 (Gold/Silver Ratio)</span>
              </div>
              {goldSilver ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold">{goldSilver.ratio.toFixed(1)}</span>
                    <span className={cn('text-xs font-medium', getGoldSilverRatioLevel(goldSilver.ratio).color)}>
                      {getGoldSilverRatioLevel(goldSilver.ratio).level}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    <span>금 ${goldSilver.gold_price.toFixed(1)}</span>
                    <span>은 ${goldSilver.silver_price.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    금 1oz = 은 {goldSilver.ratio.toFixed(1)}oz · 역사적 평균 ~65
                  </p>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">데이터 없음</span>
              )}
            </div>

            {/* 주요 지수 PER */}
            <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">주요 지수 PER (Trailing)</span>
              </div>
              {indexPer ? (
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'sp500', label: 'S&P 500' },
                      { key: 'nasdaq', label: 'NASDAQ' },
                      { key: 'kospi', label: 'KOSPI' },
                    ] as { key: keyof IndexPer; label: string }[]
                  ).map(({ key, label }) => {
                    const entry = indexPer[key]
                    const per = entry?.per
                    const level = per ? getPerLevel(per) : null
                    return (
                      <div key={key} className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                        {per != null ? (
                          <>
                            <div className="font-semibold text-sm">{per.toFixed(1)}x</div>
                            <div className={cn('text-[10px] font-medium', level?.color)}>{level?.level}</div>
                          </>
                        ) : (
                          <div className="text-[10px] text-muted-foreground">-</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">데이터 없음</span>
              )}
            </div>
          </div>
        </div>

        {data?.timestamp && (
          <p className="text-[10px] text-muted-foreground text-right">
            마지막 업데이트: {new Date(data.timestamp).toLocaleTimeString('ko-KR')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
