/**
 * 자산 목록 컴포넌트 냥~ 🐱
 */
import { useState } from 'react'
import {
  Pencil,
  Trash2,
  Briefcase,
  TrendingUp,
  Landmark,
  Coins,
  Building,
  Bitcoin,
  Banknote,
  Package,
  BarChart3,
  Layers,
  CircleDollarSign,
  type LucideIcon,
} from 'lucide-react'
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
import { formatKRW, formatPercent, getProfitClass, formatUSD, maskValue, cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { useDeleteAsset } from '@/hooks/useAssets'
import { AssetForm } from './AssetForm'
import type { Asset } from '@/types'
import { getExchangeRateChange } from './asset-display'

interface AssetListProps {
  assets: Asset[] | undefined
  isLoading: boolean
}

// 자산 유형별 아이콘 매핑 냥~
const ASSET_TYPE_ICONS: Record<string, { icon: LucideIcon; label: string; bgColor: string }> = {
  stock: { icon: TrendingUp, label: '주식', bgColor: 'bg-blue-500' },
  etf: { icon: BarChart3, label: 'ETF', bgColor: 'bg-indigo-500' },
  fund: { icon: Layers, label: '펀드', bgColor: 'bg-violet-500' },
  bond: { icon: Landmark, label: '채권', bgColor: 'bg-amber-500' },
  gold: { icon: Coins, label: '금', bgColor: 'bg-yellow-500' },
  commodity: { icon: Package, label: '원자재', bgColor: 'bg-orange-500' },
  real_estate: { icon: Building, label: '부동산', bgColor: 'bg-emerald-500' },
  crypto: { icon: Bitcoin, label: '암호화폐', bgColor: 'bg-purple-500' },
  cash: { icon: Banknote, label: '현금', bgColor: 'bg-green-500' },
  other: { icon: CircleDollarSign, label: '기타', bgColor: 'bg-gray-500' },
}

export function AssetList({ assets, isLoading }: AssetListProps) {
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null)

  const deleteAssetMutation = useDeleteAsset()
  const { isPrivacyMode } = useStore()


  // 환율 변동 정보 표시 컴포넌트 냥~
  const ExchangeRateInfo = ({ asset }: { asset: Asset }) => {
    if (asset.currency !== 'USD' || !asset.purchase_exchange_rate) {
      return null
    }

    const change = getExchangeRateChange(
      asset.purchase_exchange_rate,
      asset.current_exchange_rate
    )
    if (!change) return null

    const colorClass = change.isPositive
      ? 'text-red-500 dark:text-red-400'
      : change.changePercent < 0
        ? 'text-blue-500 dark:text-blue-400'
        : 'text-muted-foreground'

    const percentStr = `${change.changePercent >= 0 ? '+' : ''}${change.changePercent.toFixed(1)}%`

    // 프라이버시 모드: 변동률만
    if (isPrivacyMode) {
      return (
        <span className={`text-xs ${colorClass} ml-2`}>
          FX: {percentStr}
        </span>
      )
    }

    // 일반 모드
    return (
      <>
        {/* 데스크톱: 전체 표시 */}
        <span className={`hidden sm:inline text-xs ${colorClass} ml-2`}>
          FX: {change.purchaseRate.toLocaleString()}→{change.currentRate.toLocaleString()} ({percentStr})
        </span>
        {/* 모바일: 압축 */}
        <span className={`sm:hidden text-xs ${colorClass} ml-1`}>
          환율{percentStr}
        </span>
      </>
    )
  }

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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Briefcase className="h-5 w-5 text-muted-foreground" /></div>
          <p className="font-medium">등록된 자산이 없습니다.</p>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">첫 자산을 추가하면 포트폴리오 분석을 시작할 수 있습니다.</p>
          <AssetForm />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <section className="overflow-hidden rounded-md border border-border/70 bg-card">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-4 sm:px-5">
          <div><h2 className="text-lg font-medium">보유 자산</h2><p className="mt-0.5 text-xs text-muted-foreground">총 {assets.length}개 자산</p></div>
          <AssetForm />
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-muted/45 text-left text-xs font-medium text-muted-foreground">
              <tr><th className="px-5 py-3">자산</th><th className="px-4 py-3">유형</th><th className="px-4 py-3 text-right">수량</th><th className="px-4 py-3 text-right">평균 매수가</th><th className="px-4 py-3 text-right">평가 금액</th><th className="px-4 py-3 text-right">수익률</th><th className="w-24 px-4 py-3"><span className="sr-only">작업</span></th></tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {assets.map((asset) => {
                const type = ASSET_TYPE_ICONS[asset.asset_type] || ASSET_TYPE_ICONS.other
                return <tr key={asset.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-5 py-3.5"><div className="font-medium">{asset.name}</div><div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><span>{asset.ticker || '수동 입력'}</span><span>{asset.currency}</span>{!asset.ticker && asset.updated_at && <span>{formatRelativeTime(asset.updated_at)}</span>}</div></td>
                  <td className="px-4 py-3.5"><span className="inline-flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', type.bgColor)} />{type.label}</span></td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{asset.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{maskValue(asset.currency === 'USD' ? formatUSD(asset.average_price) : formatKRW(asset.average_price), isPrivacyMode)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums"><div className="font-medium">{asset.market_value ? maskValue(formatKRW(asset.market_value), isPrivacyMode) : '-'}</div>{asset.currency === 'USD' && asset.market_value_usd != null && <div className="text-xs text-muted-foreground">{maskValue(formatUSD(asset.market_value_usd), isPrivacyMode)}</div>}</td>
                  <td className={cn('px-4 py-3.5 text-right font-medium tabular-nums', asset.asset_type === 'cash' ? 'text-muted-foreground' : getProfitClass(asset.profit_rate || 0))}>{asset.asset_type === 'cash' ? '-' : formatPercent(asset.profit_rate || 0)}<ExchangeRateInfo asset={asset} /></td>
                  <td className="px-3 py-3.5"><div className="flex justify-end"><Button variant="ghost" size="icon" onClick={() => setEditingAsset(asset)} aria-label={`${asset.name} 수정`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDeletingAsset(asset)} aria-label={`${asset.name} 삭제`}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></div></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border/70 md:hidden">
          {assets.map((asset) => {
            const type = ASSET_TYPE_ICONS[asset.asset_type] || ASSET_TYPE_ICONS.other
            return <div key={asset.id} className="p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={cn('h-2 w-2 shrink-0 rounded-full', type.bgColor)} /><p className="truncate font-medium">{asset.name}</p></div><p className="mt-1 pl-4 text-xs text-muted-foreground">{asset.ticker || type.label} · {asset.currency}</p></div><div className="text-right"><p className="font-medium tabular-nums">{asset.market_value ? maskValue(formatKRW(asset.market_value), isPrivacyMode) : '-'}</p><p className={cn('mt-1 text-xs font-medium', asset.asset_type === 'cash' ? 'text-muted-foreground' : getProfitClass(asset.profit_rate || 0))}>{asset.asset_type === 'cash' ? '-' : formatPercent(asset.profit_rate || 0)}</p></div></div>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3"><p className="text-xs text-muted-foreground">{asset.quantity.toLocaleString()} × {maskValue(asset.currency === 'USD' ? formatUSD(asset.average_price) : formatKRW(asset.average_price), isPrivacyMode)}</p><div className="flex"><Button variant="ghost" size="sm" onClick={() => setEditingAsset(asset)}><Pencil className="mr-1.5 h-3.5 w-3.5" />수정</Button><Button variant="ghost" size="icon" onClick={() => setDeletingAsset(asset)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button></div></div>
            </div>
          })}
        </div>
      </section>

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
