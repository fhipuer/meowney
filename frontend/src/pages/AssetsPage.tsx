/**
 * 자산 목록 페이지 냥~ 🐱
 * v0.7.0: API 응답의 summary 사용 (프론트엔드 재계산 제거)
 */
import { AlertTriangle, Clock3, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { AssetList } from '@/components/assets/AssetList'
import { CountryRatioChart } from '@/components/rebalance/CountryRatioChart'
import { AssetAllocationChart } from '@/components/rebalance/AssetAllocationChart'
import { PlanAllocationChart } from '@/components/rebalance/PlanAllocationChart'
import { useAssets } from '@/hooks/useAssets'
import { useStore } from '@/store/useStore'
import { formatKRW, formatPercent, getProfitClass, maskValue } from '@/lib/utils'

export function AssetsPage() {
  const { data, isLoading } = useAssets()
  const { isPrivacyMode } = useStore()

  // API 응답에서 assets와 summary 추출
  const assets = data?.assets
  const summary = data?.summary

  const TrendIcon = (summary?.total_profit ?? 0) >= 0 ? TrendingUp : TrendingDown

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">자산 목록</h1>
        <p className="text-muted-foreground">
          보유 중인 자산을 관리합니다.
        </p>
      </div>

      {/* 총 자산가치 요약 - API에서 계산된 값 사용 */}
      {summary && assets && assets.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">
              총 자산: {maskValue(formatKRW(summary.total_value), isPrivacyMode)}
            </span>
            <div className={`flex items-center gap-1 ${getProfitClass(summary.profit_rate)}`}>
              <TrendIcon className="h-4 w-4" />
              <span className="font-medium">
                {maskValue(formatPercent(summary.profit_rate), isPrivacyMode)}
              </span>
            </div>
          </div>
        </div>
      )}

      {summary && (!summary.valuation_complete || summary.stale_asset_count > 0) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
          {summary.valuation_complete ? <Clock3 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <p>
            {summary.unavailable_asset_count > 0 && `${summary.unavailable_asset_count}개 자산의 시세를 확인하지 못했습니다. `}
            {summary.stale_asset_count > 0 && `${summary.stale_asset_count}개 자산은 마지막 정상 시세를 사용했습니다.`}
          </p>
        </div>
      )}

      {/* 국가별 비중 - 컴팩트 가로 막대 */}
      {assets && assets.length > 0 && (
        <CountryRatioChart assets={assets} />
      )}

      {/* 자산별/플랜별 배분 차트 (가로 2열) */}
      {assets && assets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AssetAllocationChart assets={assets} />
          <PlanAllocationChart />
        </div>
      )}

      {/* 자산 목록 */}
      <AssetList assets={assets} isLoading={isLoading} />
    </div>
  )
}
