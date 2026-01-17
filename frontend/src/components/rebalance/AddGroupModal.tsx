/**
 * 배분 그룹 추가 모달 냥~ (weight 제거됨 - 단순화)
 * 보유 자산 선택 기능 추가됨
 */
import { useState, useMemo } from 'react'
import { Plus, Trash2, Layers, Hash, FileText, Search } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { Asset } from '@/types'

// weight 제거됨 - 단순 소속 관계만
interface GroupItemInput {
  id: string
  type: 'ticker' | 'alias' | 'asset'
  value: string
  asset_id?: string
  asset?: Asset
}

interface AddGroupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: {
    name: string
    target_percentage: number
    items: Array<{ type: 'ticker' | 'alias'; value: string; asset_id?: string }>
  }) => void
  assets: Asset[]
}

export function AddGroupModal({
  open,
  onOpenChange,
  onAdd,
  assets,
}: AddGroupModalProps) {
  const [groupName, setGroupName] = useState('')
  const [targetPercentage, setTargetPercentage] = useState<number>(10)
  const [items, setItems] = useState<GroupItemInput[]>([])

  // 새 아이템 추가용 상태
  const [addItemType, setAddItemType] = useState<'ticker' | 'alias'>('ticker')
  const [newItemValue, setNewItemValue] = useState('')

  // 보유 자산 선택용 상태
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [assetSearchQuery, setAssetSearchQuery] = useState('')

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const handleReset = () => {
    setGroupName('')
    setTargetPercentage(10)
    setItems([])
    setAddItemType('ticker')
    setNewItemValue('')
    setSelectedAssetIds([])
    setAssetSearchQuery('')
  }

  const handleAddItem = () => {
    if (!newItemValue.trim()) return

    const newItem: GroupItemInput = {
      id: generateId(),
      type: addItemType,
      value: addItemType === 'ticker' ? newItemValue.trim().toUpperCase() : newItemValue.trim(),
    }

    setItems((prev) => [...prev, newItem])
    setNewItemValue('')
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  // 보유 자산 체크박스 토글
  const handleAssetToggle = (assetId: string, checked: boolean) => {
    if (checked) {
      setSelectedAssetIds((prev) => [...prev, assetId])
    } else {
      setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId))
    }
  }

  // 선택한 보유 자산을 아이템으로 추가
  const handleAddSelectedAssets = () => {
    const newItems: GroupItemInput[] = selectedAssetIds.map((assetId) => {
      const asset = assets.find((a) => a.id === assetId)!
      return {
        id: generateId(),
        type: 'asset' as const,
        value: asset.ticker || asset.name,
        asset_id: asset.id,
        asset: asset,
      }
    })
    setItems((prev) => [...prev, ...newItems])
    setSelectedAssetIds([])
  }

  // 이미 추가된 자산 ID 목록
  const addedAssetIds = useMemo(() => {
    return items.filter((item) => item.asset_id).map((item) => item.asset_id!)
  }, [items])

  // 필터링된 보유 자산 목록 (이미 추가된 것 제외, 검색어 적용)
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // 이미 추가된 자산 제외
      if (addedAssetIds.includes(asset.id)) return false

      // 검색어 필터링
      if (assetSearchQuery) {
        const query = assetSearchQuery.toLowerCase()
        const matchesName = asset.name.toLowerCase().includes(query)
        const matchesTicker = asset.ticker?.toLowerCase().includes(query)
        return matchesName || matchesTicker
      }

      return true
    })
  }, [assets, addedAssetIds, assetSearchQuery])

  const handleSubmit = () => {
    if (!groupName.trim() || items.length === 0 || targetPercentage <= 0) return

    onAdd({
      name: groupName.trim(),
      target_percentage: targetPercentage,
      items: items.map((item) => ({
        type: item.type === 'asset' ? 'ticker' : item.type,
        value: item.value,
        asset_id: item.asset_id,
      })),
    })
    handleReset()
  }

  const isValid = groupName.trim().length > 0 && items.length > 0 && targetPercentage > 0

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset()
    }
    onOpenChange(newOpen)
  }

  // 보유 자산 매칭 확인 (수동 입력용)
  const checkMatched = (type: 'ticker' | 'alias', value: string): Asset | undefined => {
    if (type === 'ticker') {
      return assets.find((a) => a.ticker === value)
    } else {
      const aliasLower = value.toLowerCase()
      return assets.find((a) => {
        const nameLower = a.name.toLowerCase()
        return aliasLower.includes(nameLower) || nameLower.includes(aliasLower)
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>그룹 추가</DialogTitle>
          <DialogDescription>
            여러 자산을 묶어서 하나의 목표 비율로 관리합니다.
            그룹 내 자산들의 합계가 그룹의 현재 가치가 됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 그룹 이름 및 목표 비율 */}
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="groupName">그룹 이름</Label>
              <Input
                id="groupName"
                placeholder="예: 단기채, 금현물, 배당주"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="w-28 space-y-2">
              <Label htmlFor="targetPct">목표 비율</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="targetPct"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  className="text-right"
                  value={targetPercentage}
                  onChange={(e) => setTargetPercentage(parseFloat(e.target.value) || 0)}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* 추가된 아이템 목록 */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>포함된 자산 ({items.length}개)</Label>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {items.map((item) => {
                  const matched = item.asset || (item.type !== 'asset' ? checkMatched(item.type, item.value) : undefined)

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {item.type === 'ticker' ? (
                          <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : item.type === 'asset' ? (
                          <Badge variant="default" className="text-xs flex-shrink-0">보유</Badge>
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-medium truncate">{item.value}</span>
                        {matched && item.type !== 'asset' && (
                          <Badge variant="secondary" className="text-xs">
                            {matched.name}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 보유 자산에서 선택 */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
            <Label className="text-sm font-medium">보유 자산에서 선택</Label>

            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="자산 검색..."
                value={assetSearchQuery}
                onChange={(e) => setAssetSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>

            {/* 자산 목록 */}
            <ScrollArea className="h-36 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {assetSearchQuery ? '검색 결과가 없습니다' : '추가할 보유 자산이 없습니다'}
                  </p>
                ) : (
                  filteredAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`asset-${asset.id}`}
                        checked={selectedAssetIds.includes(asset.id)}
                        onCheckedChange={(checked) => handleAssetToggle(asset.id, !!checked)}
                      />
                      <label
                        htmlFor={`asset-${asset.id}`}
                        className="flex-1 flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <span className="font-medium">{asset.name}</span>
                        {asset.ticker && (
                          <span className="text-xs text-muted-foreground">{asset.ticker}</span>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {selectedAssetIds.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddSelectedAssets}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                선택한 자산 추가 ({selectedAssetIds.length}개)
              </Button>
            )}
          </div>

          <Separator />

          {/* 수동 입력으로 추가 */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
            <Label className="text-sm text-muted-foreground">또는 직접 입력</Label>

            <RadioGroup
              value={addItemType}
              onValueChange={(v: string) => setAddItemType(v as 'ticker' | 'alias')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ticker" id="item-ticker" />
                <Label htmlFor="item-ticker" className="text-sm cursor-pointer">
                  티커
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="alias" id="item-alias" />
                <Label htmlFor="item-alias" className="text-sm cursor-pointer">
                  별칭
                </Label>
              </div>
            </RadioGroup>

            <div className="flex gap-2">
              <Input
                placeholder={addItemType === 'ticker' ? '예: SGOV, SHY' : '예: 금현물'}
                value={newItemValue}
                onChange={(e) =>
                  setNewItemValue(
                    addItemType === 'ticker' ? e.target.value.toUpperCase() : e.target.value
                  )
                }
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItemValue.trim()) {
                    e.preventDefault()
                    handleAddItem()
                  }
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddItem}
                disabled={!newItemValue.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Layers className="mr-2 h-4 w-4" />
            그룹 추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
