/**
 * 자산 목록 컴포넌트 냥~ 🐱
 */
import { Fragment, useState } from 'react'
import {
  ArrowRight,
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
  ChevronDown,
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
import { getAssetReturnBreakdown, getPriceStatusLabel } from './asset-display'

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

function getKrxGoldPriceMeta(asset: Asset) {
  if (!asset.ticker?.startsWith('M04020')) return null
  if (asset.price_source === 'KRX Open API') {
    const priceDate = asset.price_as_of?.slice(0, 10)
    return `한국거래소 통계정보${priceDate ? ` · ${priceDate} 종가` : ' · 공식 종가'}`
  }
  return `KRX 연동 · ${getPriceStatusLabel(asset.price_status)}`
}

function formatSignedKRW(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatKRW(Math.abs(value))}`
}

function ReturnSummary({
  asset,
  expanded,
  detailsId,
  onToggle,
}: {
  asset: Asset
  expanded: boolean
  detailsId: string
  onToggle: () => void
}) {
  if (asset.asset_type === 'cash' || asset.profit_rate == null) {
    return <span className="text-muted-foreground">-</span>
  }

  const breakdown = getAssetReturnBreakdown(asset)

  return (
    <div className="flex flex-col items-end tabular-nums">
      <div className={cn('font-medium', getProfitClass(asset.profit_rate))}>
        {formatPercent(asset.profit_rate)}
        {breakdown && <span className="ml-1 text-[10px] font-normal text-muted-foreground">원화</span>}
      </div>
      {breakdown && (
        <button
          type="button"
          className="mt-0.5 inline-flex items-center gap-1 rounded-sm text-[11px] font-normal text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${asset.name} 수익 분해 ${expanded ? '접기' : '펼치기'}`}
          onClick={onToggle}
        >
          <span className={getProfitClass(breakdown.nativeProfitRate)}>
            자산 {formatPercent(breakdown.nativeProfitRate)}
          </span>
          <span aria-hidden="true">·</span>
          <span className={getProfitClass(breakdown.fxChangeRate)}>
            환율 {formatPercent(breakdown.fxChangeRate)}
          </span>
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  )
}

function ReturnBreakdownDetails({ asset, isPrivacyMode }: { asset: Asset; isPrivacyMode: boolean }) {
  const breakdown = getAssetReturnBreakdown(asset)
  if (!breakdown) return null

  const rateOptions: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }
  const pricePath = asset.current_price != null
    ? `${formatUSD(Number(asset.average_price))} → ${formatUSD(Number(asset.current_price))}`
    : '현재 USD 평가액 기준'
  const fxPath = asset.purchase_exchange_rate != null && asset.current_exchange_rate != null
    ? `${Number(asset.purchase_exchange_rate).toLocaleString('ko-KR', rateOptions)} → ${Number(asset.current_exchange_rate).toLocaleString('ko-KR', rateOptions)}`
    : null
  const priceDetail = isPrivacyMode
    ? formatPercent(breakdown.nativeProfitRate)
    : `${pricePath} (${formatPercent(breakdown.nativeProfitRate)})`
  const fxDetail = fxPath
    ? isPrivacyMode
      ? formatPercent(breakdown.fxChangeRate)
      : `${fxPath} (${formatPercent(breakdown.fxChangeRate)})`
    : null

  return (
    <div className="rounded-md border border-border/70 bg-muted/25 p-3 sm:p-4">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <div className="rounded-md bg-background/80 p-3">
          <p className="text-[11px] text-muted-foreground">매입 원금</p>
          <p className="mt-1 font-medium tabular-nums">
            {maskValue(formatKRW(breakdown.costBasisKrw), isPrivacyMode)}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 px-1 text-xs md:flex-col md:gap-0.5">
          <span className="text-muted-foreground">자산 가격</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className={cn('font-medium tabular-nums', getProfitClass(breakdown.assetPriceEffectKrw))}>
            {maskValue(formatSignedKRW(breakdown.assetPriceEffectKrw), isPrivacyMode)}
          </span>
        </div>

        <div className="rounded-md bg-background/80 p-3">
          <p className="text-[11px] text-muted-foreground">자산 가격 반영</p>
          <p className="mt-1 font-medium tabular-nums">
            {maskValue(formatKRW(breakdown.priceAdjustedValueKrw), isPrivacyMode)}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 px-1 text-xs md:flex-col md:gap-0.5">
          <span className="text-muted-foreground">환율</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className={cn('font-medium tabular-nums', getProfitClass(breakdown.fxEffectKrw))}>
            {maskValue(formatSignedKRW(breakdown.fxEffectKrw), isPrivacyMode)}
          </span>
        </div>

        <div className="rounded-md border border-border/70 bg-background p-3">
          <p className="text-[11px] text-muted-foreground">현재 평가액</p>
          <p className="mt-1 font-semibold tabular-nums">
            {maskValue(formatKRW(breakdown.marketValueKrw), isPrivacyMode)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          자산 가격 <span className={getProfitClass(breakdown.nativeProfitRate)}>{priceDetail}</span>
        </span>
        {fxDetail && (
          <span>
            USD/KRW <span className={getProfitClass(breakdown.fxChangeRate)}>{fxDetail}</span>
          </span>
        )}
        <span>자산 효과와 환율 효과의 합이 최종 원화 손익입니다.</span>
      </div>
    </div>
  )
}

export function AssetList({ assets, isLoading }: AssetListProps) {
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null)
  const [expandedReturnIds, setExpandedReturnIds] = useState<Set<string>>(new Set())

  const deleteAssetMutation = useDeleteAsset()
  const { isPrivacyMode } = useStore()


  const toggleReturnDetails = (assetId: string) => {
    setExpandedReturnIds(current => {
      const next = new Set(current)
      if (next.has(assetId)) next.delete(assetId)
      else next.add(assetId)
      return next
    })
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
                const krxGoldPriceMeta = getKrxGoldPriceMeta(asset)
                const breakdown = getAssetReturnBreakdown(asset)
                const expanded = expandedReturnIds.has(asset.id)
                const detailsId = `return-breakdown-desktop-${asset.id}`
                return (
                  <Fragment key={asset.id}>
                    <tr className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-3.5"><div className="font-medium">{asset.name}</div><div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><span>{asset.ticker || '수동 입력'}</span><span>{asset.currency}</span>{krxGoldPriceMeta && <span>{krxGoldPriceMeta}</span>}{!asset.ticker && asset.updated_at && <span>{formatRelativeTime(asset.updated_at)}</span>}</div></td>
                      <td className="px-4 py-3.5"><span className="inline-flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', type.bgColor)} />{type.label}</span></td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{asset.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{maskValue(asset.currency === 'USD' ? formatUSD(asset.average_price) : formatKRW(asset.average_price), isPrivacyMode)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums"><div className="font-medium">{asset.market_value ? maskValue(formatKRW(asset.market_value), isPrivacyMode) : '-'}</div>{asset.asset_type === 'gold' && asset.current_price != null && <div className="text-xs text-muted-foreground">{maskValue(`${formatKRW(asset.current_price)}/g`, isPrivacyMode)}</div>}{asset.currency === 'USD' && asset.market_value_usd != null && <div className="text-xs text-muted-foreground">{maskValue(formatUSD(asset.market_value_usd), isPrivacyMode)}</div>}</td>
                      <td className="px-4 py-3.5 text-right">
                        <ReturnSummary
                          asset={asset}
                          expanded={expanded}
                          detailsId={detailsId}
                          onToggle={() => toggleReturnDetails(asset.id)}
                        />
                      </td>
                      <td className="px-3 py-3.5"><div className="flex justify-end"><Button variant="ghost" size="icon" onClick={() => setEditingAsset(asset)} aria-label={`${asset.name} 수정`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDeletingAsset(asset)} aria-label={`${asset.name} 삭제`}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></div></td>
                    </tr>
                    {breakdown && expanded && (
                      <tr id={detailsId} className="bg-muted/10">
                        <td colSpan={7} className="px-5 pb-4 pt-1">
                          <ReturnBreakdownDetails asset={asset} isPrivacyMode={isPrivacyMode} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border/70 md:hidden">
          {assets.map((asset) => {
            const type = ASSET_TYPE_ICONS[asset.asset_type] || ASSET_TYPE_ICONS.other
            const krxGoldPriceMeta = getKrxGoldPriceMeta(asset)
            const breakdown = getAssetReturnBreakdown(asset)
            const expanded = expandedReturnIds.has(asset.id)
            const detailsId = `return-breakdown-mobile-${asset.id}`
            return (
              <div key={asset.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className={cn('h-2 w-2 shrink-0 rounded-full', type.bgColor)} /><p className="truncate font-medium">{asset.name}</p></div>
                    <p className="mt-1 pl-4 text-xs text-muted-foreground">{asset.ticker || type.label} · {asset.currency}{krxGoldPriceMeta ? ` · ${krxGoldPriceMeta}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">{asset.market_value ? maskValue(formatKRW(asset.market_value), isPrivacyMode) : '-'}</p>
                    {asset.asset_type === 'gold' && asset.current_price != null && <p className="text-xs text-muted-foreground">{maskValue(`${formatKRW(asset.current_price)}/g`, isPrivacyMode)}</p>}
                    <div className="mt-1 text-xs">
                      <ReturnSummary
                        asset={asset}
                        expanded={expanded}
                        detailsId={detailsId}
                        onToggle={() => toggleReturnDetails(asset.id)}
                      />
                    </div>
                  </div>
                </div>
                {breakdown && expanded && (
                  <div id={detailsId} className="mt-3">
                    <ReturnBreakdownDetails asset={asset} isPrivacyMode={isPrivacyMode} />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3"><p className="text-xs text-muted-foreground">{asset.quantity.toLocaleString()} × {maskValue(asset.currency === 'USD' ? formatUSD(asset.average_price) : formatKRW(asset.average_price), isPrivacyMode)}</p><div className="flex"><Button variant="ghost" size="sm" onClick={() => setEditingAsset(asset)}><Pencil className="mr-1.5 h-3.5 w-3.5" />수정</Button><Button variant="ghost" size="icon" onClick={() => setDeletingAsset(asset)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button></div></div>
              </div>
            )
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
