/**
 * 자산 추가/수정 폼 컴포넌트 냥~ 🐱
 */
import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateAsset, useUpdateAsset } from '@/hooks/useAssets'
import type { Asset, AssetCreate, AssetUpdate } from '@/types'

interface AssetFormProps {
  asset?: Asset
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const ASSET_TYPES = [
  { value: 'stock', label: '주식' },
  { value: 'cash', label: '현금' },
  { value: 'bond', label: '채권' },
  { value: 'crypto', label: '암호화폐' },
  { value: 'other', label: '기타' },
]

const CURRENCIES = [
  { value: 'KRW', label: '원화 (KRW)' },
  { value: 'USD', label: '달러 (USD)' },
]

export function AssetForm({ asset, open: controlledOpen, onOpenChange }: AssetFormProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    asset_type: 'stock',
    quantity: '',
    average_price: '',
    currency: 'KRW',
    current_value: '',
    notes: '',
  })

  const createAssetMutation = useCreateAsset()
  const updateAssetMutation = useUpdateAsset()

  const isEditing = !!asset

  // 수정 모드일 때 폼 데이터 초기화
  useEffect(() => {
    if (asset) {
      setFormData({
        name: asset.name,
        ticker: asset.ticker || '',
        asset_type: asset.asset_type,
        quantity: asset.quantity.toString(),
        average_price: asset.average_price.toString(),
        currency: asset.currency,
        current_value: asset.current_value?.toString() || '',
        notes: asset.notes || '',
      })
    } else {
      setFormData({
        name: '',
        ticker: '',
        asset_type: 'stock',
        quantity: '',
        average_price: '',
        currency: 'KRW',
        current_value: '',
        notes: '',
      })
    }
  }, [asset, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const data = {
      name: formData.name,
      ticker: formData.ticker || undefined,
      asset_type: formData.asset_type,
      quantity: parseFloat(formData.quantity) || 0,
      average_price: parseFloat(formData.average_price) || 0,
      currency: formData.currency,
      current_value: formData.current_value
        ? parseFloat(formData.current_value)
        : undefined,
      notes: formData.notes || undefined,
    }

    if (isEditing) {
      await updateAssetMutation.mutateAsync({
        id: asset.id,
        data: data as AssetUpdate,
      })
    } else {
      await createAssetMutation.mutateAsync(data as AssetCreate)
    }

    setOpen(false)
  }

  const isPending = createAssetMutation.isPending || updateAssetMutation.isPending
  const isCashType = formData.asset_type === 'cash'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditing && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            자산 추가
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? '자산 수정 🐱' : '새 자산 추가 🐱'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? '자산 정보를 수정하세요 냥~'
                : '새로운 자산을 추가하세요 냥~'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* 자산명 */}
            <div className="grid gap-2">
              <Label htmlFor="name">자산명 *</Label>
              <Input
                id="name"
                placeholder="예: 삼성전자, Apple Inc."
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            {/* 자산 유형 & 통화 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>자산 유형</Label>
                <Select
                  value={formData.asset_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, asset_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>통화</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, currency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 티커 (주식인 경우) */}
            {!isCashType && (
              <div className="grid gap-2">
                <Label htmlFor="ticker">티커 심볼</Label>
                <Input
                  id="ticker"
                  placeholder="예: 005930.KS, AAPL"
                  value={formData.ticker}
                  onChange={(e) =>
                    setFormData({ ...formData, ticker: e.target.value.toUpperCase() })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  한국 주식: 종목코드.KS (예: 005930.KS)
                </p>
              </div>
            )}

            {/* 수량 & 평균 매수가 */}
            {!isCashType ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="quantity">수량 *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="average_price">평균 매수가 *</Label>
                  <Input
                    id="average_price"
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formData.average_price}
                    onChange={(e) =>
                      setFormData({ ...formData, average_price: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            ) : (
              /* 현금인 경우 - 현재 가치 */
              <div className="grid gap-2">
                <Label htmlFor="current_value">현재 금액 *</Label>
                <Input
                  id="current_value"
                  type="number"
                  step="any"
                  placeholder="0"
                  value={formData.current_value}
                  onChange={(e) =>
                    setFormData({ ...formData, current_value: e.target.value })
                  }
                  required={isCashType}
                />
              </div>
            )}

            {/* 메모 */}
            <div className="grid gap-2">
              <Label htmlFor="notes">메모</Label>
              <Input
                id="notes"
                placeholder="냥이 집사의 투자 일기..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? '저장 중...'
                : isEditing
                ? '수정 완료'
                : '추가하기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
