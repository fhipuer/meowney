/**
 * 자산 목록 컴포넌트 냥~ 🐱
 */
import { useState } from 'react'
import { Pencil, Trash2, PawPrint, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatKRW, formatPercent, getProfitClass, formatUSD } from '@/lib/utils'
import { useDeleteAsset } from '@/hooks/useAssets'
import { useExchangeRate } from '@/hooks/useDashboard'
import { AssetForm } from './AssetForm'
import type { Asset } from '@/types'

interface AssetListProps {
  assets: Asset[] | undefined
  isLoading: boolean
}

export function AssetList({ assets, isLoading }: AssetListProps) {
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null)

  const deleteAssetMutation = useDeleteAsset()
  const { data: exchangeRate } = useExchangeRate()

  // 상대적 시간 표시 (예: "2시간 전", "3일 전")
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const handleDelete = async () => {
    if (!deletingAsset) return

    await deleteAssetMutation.mutateAsync({ id: deletingAsset.id })
    setDeletingAsset(null)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>자산 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 border rounded-lg">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
                <div className="h-6 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!assets || assets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>자산 목록</CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <PawPrint className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            아직 등록된 자산이 없습니다.
          </p>
          <AssetForm />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            자산 목록
            <span className="text-sm font-normal text-muted-foreground">
              ({assets.length}개)
            </span>
          </CardTitle>
          <AssetForm />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                {/* 카테고리 색상 표시 */}
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white text-lg"
                  style={{ backgroundColor: asset.category_color || '#6b7280' }}
                >
                  🐱
                </div>

                {/* 자산 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{asset.name}</span>
                    {asset.ticker ? (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {asset.ticker}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                        수동
                      </span>
                    )}
                    {/* USD 자산 뱃지 */}
                    {asset.currency === 'USD' && (
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded">
                        USD
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    {/* USD 자산: 달러 단가 표시 */}
                    {asset.currency === 'USD' ? (
                      <span>{asset.quantity.toLocaleString()}주 × {formatUSD(asset.average_price)}</span>
                    ) : (
                      <span>{asset.quantity.toLocaleString()}주 × {formatKRW(asset.average_price)}</span>
                    )}
                    {/* 티커 없는 자산은 갱신일시 표시 */}
                    {!asset.ticker && asset.updated_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(asset.updated_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 평가금액 & 수익률 */}
                <div className="text-right">
                  {/* USD 자산: 달러/원화 병행 표시 */}
                  {asset.currency === 'USD' && asset.current_price && exchangeRate ? (
                    <div>
                      <div className="font-medium text-emerald-600 dark:text-emerald-400">
                        {formatUSD(asset.current_price * asset.quantity)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatKRW(asset.current_price * asset.quantity * exchangeRate.rate)}
                      </div>
                    </div>
                  ) : (
                    <div className="font-medium">
                      {asset.market_value ? formatKRW(asset.market_value) : '-'}
                    </div>
                  )}
                  <div className={`flex items-center justify-end gap-1 text-sm ${getProfitClass(asset.profit_rate || 0)}`}>
                    {(asset.profit_rate || 0) >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatPercent(asset.profit_rate || 0)}
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingAsset(asset)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingAsset(asset)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 수정 다이얼로그 */}
      {editingAsset && (
        <AssetForm
          asset={editingAsset}
          open={!!editingAsset}
          onOpenChange={(open) => !open && setEditingAsset(null)}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deletingAsset} onOpenChange={(open) => !open && setDeletingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>자산 삭제 확인</DialogTitle>
            <DialogDescription>
              정말로 &quot;{deletingAsset?.name}&quot;을(를) 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingAsset(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteAssetMutation.isPending}
            >
              {deleteAssetMutation.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
