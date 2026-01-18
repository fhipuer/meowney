/**
 * 자산 목록 페이지 냥~ 🐱
 * v0.7.0: API 응답의 summary 사용 (프론트엔드 재계산 제거)
 */
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { AssetList } from '@/components/assets/AssetList'
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

      {/* 자산 목록 */}
      <AssetList assets={assets} isLoading={isLoading} />
    </div>
  )
}
