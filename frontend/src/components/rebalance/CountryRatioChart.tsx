/**
 * 국가별 자산 비중 차트 컴포넌트 냥~ 🐱
 * USD(해외) vs KRW(국내) 자산 비율 시각화 - 컴팩트 가로 막대
 */
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatKRW, maskValue } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { Asset } from '@/types'

// 국가별 고정 색상
const COUNTRY_COLORS = {
  usd: 'bg-blue-500',
  krw: 'bg-red-500',
}

interface CountryRatioChartProps {
  assets: Asset[]
  className?: string
}

export function CountryRatioChart({ assets, className }: CountryRatioChartProps) {
  const { isPrivacyMode } = useStore()

  // 국가별 합계 계산
  const { usdValue, krwValue, usdPct, krwPct, total } = useMemo(() => {
    const data = assets.reduce(
      (acc, asset) => {
        const value = Number(asset.market_value) || 0
        if (asset.currency === 'USD') {
          acc.usd += value
        } else {
          acc.krw += value
        }
        return acc
      },
      { usd: 0, krw: 0 }
    )

    const total = data.usd + data.krw
    return {
      usdValue: data.usd,
      krwValue: data.krw,
      usdPct: total > 0 ? (data.usd / total) * 100 : 0,
      krwPct: total > 0 ? (data.krw / total) * 100 : 0,
      total,
    }
  }, [assets])

  // 빈 데이터
  if (total === 0) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm">국가별 자산 비중</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex items-center justify-center py-4">
            <span className="text-muted-foreground text-sm">자산을 추가해주세요 냥~</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm">국가별 자산 비중</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-4">
          {/* 왼쪽: 해외 라벨 */}
          <div className="text-right min-w-[100px]">
            <div className="text-sm font-medium text-muted-foreground">해외 (USD)</div>
            <div className="text-lg font-bold text-blue-500">{usdPct.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              {maskValue(formatKRW(usdValue), isPrivacyMode)}
            </div>
          </div>

          {/* 가운데: 스택 막대 */}
          <div className="flex-1 h-6 flex rounded-full overflow-hidden bg-muted/30">
            {usdPct > 0 && (
              <div
                className={cn('transition-all duration-300', COUNTRY_COLORS.usd)}
                style={{ width: `${usdPct}%` }}
              />
            )}
            {krwPct > 0 && (
              <div
                className={cn('transition-all duration-300', COUNTRY_COLORS.krw)}
                style={{ width: `${krwPct}%` }}
              />
            )}
          </div>

          {/* 오른쪽: 국내 라벨 */}
          <div className="text-left min-w-[100px]">
            <div className="text-sm font-medium text-muted-foreground">국내 (KRW)</div>
            <div className="text-lg font-bold text-red-500">{krwPct.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              {maskValue(formatKRW(krwValue), isPrivacyMode)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
