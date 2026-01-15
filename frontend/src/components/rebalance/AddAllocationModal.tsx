/**
 * 개별 배분 항목 추가 모달 냥~
 */
import { useState } from 'react'
import { Plus, Search, Package, Hash, FileText } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Asset } from '@/types'

interface AllocationItem {
  id: string
  asset_id?: string
  ticker?: string
  alias?: string
}

interface AddAllocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: { type: 'asset' | 'ticker' | 'alias'; value: string; display_name?: string }) => void
  assets: Asset[]
  existingAllocations: AllocationItem[]
}

type AddType = 'asset' | 'ticker' | 'alias'

export function AddAllocationModal({
  open,
  onOpenChange,
  onAdd,
  assets,
  existingAllocations,
}: AddAllocationModalProps) {
  const [addType, setAddType] = useState<AddType>('asset')
  const [selectedAssetId, setSelectedAssetId] = useState<string>('')
  const [tickerValue, setTickerValue] = useState('')
  const [aliasValue, setAliasValue] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // 이미 추가된 자산 필터링
  const existingAssetIds = existingAllocations
    .map((a) => a.asset_id)
    .filter(Boolean) as string[]
  const existingTickers = existingAllocations
    .map((a) => a.ticker?.toUpperCase())
    .filter(Boolean) as string[]

  // 검색 필터링된 자산 목록
  const filteredAssets = assets.filter((asset) => {
    // 이미 추가된 자산 제외
    if (existingAssetIds.includes(asset.id)) return false
    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        asset.name.toLowerCase().includes(term) ||
        (asset.ticker?.toLowerCase().includes(term) ?? false)
      )
    }
    return true
  })

  const handleReset = () => {
    setAddType('asset')
    setSelectedAssetId('')
    setTickerValue('')
    setAliasValue('')
    setDisplayName('')
    setSearchTerm('')
  }

  const handleSubmit = () => {
    if (addType === 'asset' && selectedAssetId) {
      onAdd({ type: 'asset', value: selectedAssetId })
    } else if (addType === 'ticker' && tickerValue.trim()) {
      onAdd({
        type: 'ticker',
        value: tickerValue.trim().toUpperCase(),
        display_name: displayName || undefined,
      })
    } else if (addType === 'alias' && aliasValue.trim()) {
      onAdd({
        type: 'alias',
        value: aliasValue.trim(),
        display_name: displayName || aliasValue.trim(),
      })
    }
    handleReset()
  }

  const isValid = () => {
    if (addType === 'asset') return !!selectedAssetId
    if (addType === 'ticker') {
      const ticker = tickerValue.trim().toUpperCase()
      return ticker.length > 0 && !existingTickers.includes(ticker)
    }
    if (addType === 'alias') return aliasValue.trim().length > 0
    return false
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>항목 추가</DialogTitle>
          <DialogDescription>
            리밸런싱 플랜에 추가할 자산을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 추가 유형 선택 */}
          <RadioGroup
            value={addType}
            onValueChange={(v: string) => setAddType(v as AddType)}
            className="grid grid-cols-3 gap-2"
          >
            <Label
              htmlFor="type-asset"
              className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                addType === 'asset' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value="asset" id="type-asset" className="sr-only" />
              <Package className="h-5 w-5" />
              <span className="text-sm font-medium">보유 자산</span>
            </Label>
            <Label
              htmlFor="type-ticker"
              className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                addType === 'ticker' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value="ticker" id="type-ticker" className="sr-only" />
              <Hash className="h-5 w-5" />
              <span className="text-sm font-medium">티커</span>
            </Label>
            <Label
              htmlFor="type-alias"
              className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                addType === 'alias' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value="alias" id="type-alias" className="sr-only" />
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium">별칭</span>
            </Label>
          </RadioGroup>

          {/* 보유 자산 선택 */}
          {addType === 'asset' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="자산 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="자산을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAssets.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      {searchTerm ? '검색 결과가 없습니다' : '추가 가능한 자산이 없습니다'}
                    </div>
                  ) : (
                    filteredAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        <div className="flex items-center gap-2">
                          <span>{asset.name}</span>
                          {asset.ticker && (
                            <span className="text-xs text-muted-foreground">
                              ({asset.ticker})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                현재 보유 중인 자산을 직접 선택합니다. 자동으로 연결됩니다.
              </p>
            </div>
          )}

          {/* 티커 입력 */}
          {addType === 'ticker' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticker">티커 심볼</Label>
                <Input
                  id="ticker"
                  placeholder="예: AAPL, MSFT, 005930.KS"
                  value={tickerValue}
                  onChange={(e) => setTickerValue(e.target.value.toUpperCase())}
                />
                {existingTickers.includes(tickerValue.trim().toUpperCase()) && (
                  <p className="text-xs text-destructive">이미 추가된 티커입니다</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">표시명 (선택)</Label>
                <Input
                  id="displayName"
                  placeholder="예: 애플"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                티커로 입력하면 보유 자산 중 같은 티커가 있으면 자동 매칭됩니다.
                미보유 자산도 추가할 수 있습니다.
              </p>
            </div>
          )}

          {/* 별칭 입력 */}
          {addType === 'alias' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alias">별칭</Label>
                <Input
                  id="alias"
                  placeholder="예: 금현물, CMA 계좌"
                  value={aliasValue}
                  onChange={(e) => setAliasValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayNameAlias">표시명 (선택)</Label>
                <Input
                  id="displayNameAlias"
                  placeholder="기본값: 별칭과 동일"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                티커가 없는 자산(금 현물, CMA 등)을 위한 별칭입니다.
                보유 자산 이름에 별칭이 포함되면 자동 매칭됩니다.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid()}>
            <Plus className="mr-2 h-4 w-4" />
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
