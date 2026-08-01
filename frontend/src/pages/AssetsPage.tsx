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
    <div className="space-y-7">
      {/* 페이지 헤더 */}
      <div className="border-b border-border/70 pb-6">
        <p className="mb-2 text-xs font-medium text-primary">Portfolio</p>
        <h1 className="text-3xl font-bold tracking-tight">자산 목록</h1>
        <p className="mt-1 text-muted-foreground">
          보유 자산과 수익률, 배분 현황을 관리합니다.
        </p>
      </div>

      {/* 총 자산가치 요약 - API에서 계산된 값 사용 */}
      {summary && assets && assets.length > 0 && (
        <div className="flex items-center gap-4 rounded-md border border-border/70 bg-white p-5 dark:bg-card">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-[#eef2ff] text-primary dark:bg-primary/15"><Wallet className="h-5 w-5" /></div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-medium">
              {maskValue(formatKRW(summary.total_value), isPrivacyMode)}
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
