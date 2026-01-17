/**
 * 보유 자산 선택 모달 컴포넌트 냥~
 * 플랜에 자산 추가 시 체크박스로 선택
 */
import { useState, useMemo } from 'react'
import { Search, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatKRW, formatPercent } from '@/lib/utils'
import type { Asset } from '@/types'

interface AssetSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assets: Asset[]
  /** 이미 플랜에 추가된 자산 ID들 (비활성화 표시용) */
  alreadyAddedAssetIds: string[]
  /** 선택 완료 시 콜백 */
  onSelect: (selectedAssets: Asset[]) => void
  /** 모달 제목 (기본: "보유 자산 선택") */
  title?: string
  /** 모달 설명 */
  description?: string
  /** 다중 선택 허용 여부 (기본: true) */
  multiSelect?: boolean
}

export function AssetSelectorModal({
  open,
  onOpenChange,
  assets,
  alreadyAddedAssetIds,
  onSelect,
  title = "보유 자산 선택",
  description = "플랜에 추가할 자산을 선택하세요.",
  multiSelect = true,
}: AssetSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 전체 포트폴리오 가치 계산 (비중 표시용)
  const totalPortfolioValue = useMemo(() => {
    return assets.reduce((sum, asset) => sum + (asset.market_value || 0), 0)
  }, [assets])

  // 검색 필터링
  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets

    const query = searchQuery.toLowerCase()
    return assets.filter(asset =>
      asset.name.toLowerCase().includes(query) ||
      (asset.ticker && asset.ticker.toLowerCase().includes(query))
    )
  }, [assets, searchQuery])

  // 선택 가능한 자산 (이미 추가된 자산 제외)
  const selectableAssets = useMemo(() => {
    return filteredAssets.filter(asset => !alreadyAddedAssetIds.includes(asset.id))
  }, [filteredAssets, alreadyAddedAssetIds])

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedIds.size === selectableAssets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableAssets.map(a => a.id)))
    }
  }

  // 개별 선택
  const handleToggle = (assetId: string) => {
    const newSelected = new Set(selectedIds)

    if (multiSelect) {
      if (newSelected.has(assetId)) {
        newSelected.delete(assetId)
      } else {
        newSelected.add(assetId)
      }
    } else {
      // 단일 선택 모드
      newSelected.clear()
      newSelected.add(assetId)
    }

    setSelectedIds(newSelected)
  }

  // 선택 완료
  const handleConfirm = () => {
    const selectedAssets = assets.filter(a => selectedIds.has(a.id))
    onSelect(selectedAssets)
    setSelectedIds(new Set())
    setSearchQuery('')
    onOpenChange(false)
  }

  // 모달 닫기 시 초기화
  const handleClose = () => {
    setSelectedIds(new Set())
    setSearchQuery('')
    onOpenChange(false)
  }

  const isAllSelected = selectableAssets.length > 0 && selectedIds.size === selectableAssets.length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="자산명 또는 티커로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 전체 선택 */}
        {multiSelect && selectableAssets.length > 0 && (
          <div
            className="flex items-center gap-2 py-2 px-3 border-b cursor-pointer hover:bg-muted/50 rounded-md"
            onClick={handleSelectAll}
          >
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm font-medium">
              전체 선택 ({selectableAssets.length}개)
            </span>
          </div>
        )}

        {/* 자산 목록 */}
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-1">
            {filteredAssets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery ? '검색 결과가 없습니다.' : '보유 자산이 없습니다.'}
              </p>
            ) : (
              filteredAssets.map((asset) => {
                const isAlreadyAdded = alreadyAddedAssetIds.includes(asset.id)
                const isSelected = selectedIds.has(asset.id)
                const weight = totalPortfolioValue > 0
                  ? (asset.market_value || 0) / totalPortfolioValue * 100
                  : 0

                return (
                  <div
                    key={asset.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-colors
                      ${isAlreadyAdded
                        ? 'opacity-50 cursor-not-allowed bg-muted/30'
                        : isSelected
                          ? 'border-primary bg-primary/5 cursor-pointer'
                          : 'hover:bg-muted/50 cursor-pointer'
                      }
                    `}
                    onClick={() => !isAlreadyAdded && handleToggle(asset.id)}
                  >
                    {/* 체크박스 */}
                    <Checkbox
                      checked={isSelected || isAlreadyAdded}
                      disabled={isAlreadyAdded}
                      onCheckedChange={() => !isAlreadyAdded && handleToggle(asset.id)}
                    />

                    {/* 자산 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{asset.name}</span>
                        {asset.ticker && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {asset.ticker}
                          </Badge>
                        )}
                        {asset.currency === 'USD' && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            USD
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                        <span>{formatKRW(asset.market_value || 0)}</span>
                        <span className="text-xs">
                          비중 {formatPercent(weight)}
                        </span>
                      </div>
                    </div>

                    {/* 이미 추가됨 표시 */}
                    {isAlreadyAdded && (
                      <Badge variant="secondary" className="shrink-0">
                        <Check className="w-3 h-3 mr-1" />
                        추가됨
                      </Badge>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            {selectedIds.size > 0
              ? `${selectedIds.size}개 선택 완료`
              : '선택하세요'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
