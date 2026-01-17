/**
 * 자산 목록 페이지 냥~ 🐱
 */
import { useMemo } from 'react'
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { AssetList } from '@/components/assets/AssetList'
import { useAssets } from '@/hooks/useAssets'
import { useStore } from '@/store/useStore'
import { formatKRW, formatPercent, getProfitClass, maskValue } from '@/lib/utils'

export function AssetsPage() {
  const { data: assets, isLoading } = useAssets()
  const { isPrivacyMode } = useStore()

  // 총 자산가치 및 수익률 계산
  const summary = useMemo(() => {
    if (!assets || assets.length === 0) {
      return { totalValue: 0, totalCost: 0, profitRate: 0, profit: 0 }
    }

    const totalValue = assets.reduce((sum, a) => sum + (Number(a.market_value) || 0), 0)
    const totalCost = assets.reduce((sum, a) => sum + (a.quantity * a.average_price), 0)
    const profit = totalValue - totalCost
    const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0

    return { totalValue, totalCost, profitRate, profit }
  }, [assets])

  const TrendIcon = summary.profit >= 0 ? TrendingUp : TrendingDown

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">자산 목록</h1>
        <p className="text-muted-foreground">
          보유 중인 자산을 관리합니다.
        </p>
      </div>

      {/* 총 자산가치 요약 */}
      {assets && assets.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">
              총 자산: {maskValue(formatKRW(summary.totalValue), isPrivacyMode)}
            </span>
            <div className={`flex items-center gap-1 ${getProfitClass(summary.profitRate)}`}>
              <TrendIcon className="h-4 w-4" />
              <span className="font-medium">
                {maskValue(formatPercent(summary.profitRate), isPrivacyMode)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 자산 목록 */}
      <AssetList assets={assets} isLoading={isLoading} />
    </div>
  )
}
