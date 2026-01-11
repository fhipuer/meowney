/**
 * 자산 목록 페이지 냥~ 🐱
 */
import { AssetList } from '@/components/assets/AssetList'
import { useAssets } from '@/hooks/useAssets'

export function AssetsPage() {
  const { data: assets, isLoading } = useAssets()

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">자산 목록</h1>
        <p className="text-muted-foreground">
          보유 중인 자산을 관리하세요 냥~ 🐱
        </p>
      </div>

      {/* 자산 목록 */}
      <AssetList assets={assets} isLoading={isLoading} />
    </div>
  )
}
