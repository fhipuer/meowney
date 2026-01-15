/**
 * 자산 추가/수정 폼 컴포넌트 냥~ 🐱
 */
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, CheckCircle, XCircle, Loader2 } from 'lucide-react'
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
import { dashboardApi, assetsApi } from '@/lib/api'
import { formatKRW } from '@/lib/utils'
import type { Asset, AssetCreate, AssetUpdate, TickerValidation } from '@/types'

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
    purchase_exchange_rate: '',
    notes: '',
  })

  // 티커 검증 상태
  const [tickerValidation, setTickerValidation] = useState<TickerValidation | null>(null)

  // 현재 환율 조회 (USD 선택시)
  const { data: exchangeRateData } = useQuery({
    queryKey: ['exchangeRate'],
    queryFn: () => dashboardApi.getExchangeRate(),
    enabled: formData.currency === 'USD',
    staleTime: 5 * 60 * 1000, // 5분
  })

  // 티커 검증 뮤테이션
  const validateTickerMutation = useMutation({
    mutationFn: (ticker: string) => assetsApi.validateTicker(ticker),
    onSuccess: (data) => {
      setTickerValidation(data)
      // 검증 성공 시 자산명 자동 완성 제안
      if (data.valid && data.name && !formData.name) {
        setFormData(prev => ({ ...prev, name: data.name! }))
      }
    },
    onError: () => {
      setTickerValidation({ valid: false, ticker: formData.ticker, error: '검증 중 오류가 발생했습니다.' } as TickerValidation)
    }
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
        purchase_exchange_rate: asset.purchase_exchange_rate?.toString() || '',
        notes: asset.notes || '',
      })
      setTickerValidation(null)
    } else {
      setFormData({
        name: '',
        ticker: '',
        asset_type: 'stock',
        quantity: '',
        average_price: '',
        currency: 'KRW',
        current_value: '',
        purchase_exchange_rate: '',
        notes: '',
      })
      setTickerValidation(null)
    }
  }, [asset, open])

  // 티커 검증 핸들러
  const handleValidateTicker = () => {
    if (formData.ticker.trim()) {
      validateTickerMutation.mutate(formData.ticker.trim())
    }
  }

  // USD 자산 원화 환산 취득가 계산
  const krwCostBasis = useMemo(() => {
    if (formData.currency !== 'USD') return null
    const price = parseFloat(formData.average_price) || 0
    const qty = parseFloat(formData.quantity) || 0
    const rate = parseFloat(formData.purchase_exchange_rate) || exchangeRateData?.rate || 0
    if (price <= 0 || qty <= 0 || rate <= 0) return null
    return price * qty * rate
  }, [formData.currency, formData.average_price, formData.quantity, formData.purchase_exchange_rate, exchangeRateData])

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
      purchase_exchange_rate: formData.purchase_exchange_rate
        ? parseFloat(formData.purchase_exchange_rate)
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
              {isEditing ? '자산 수정' : '자산 추가'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? '자산 정보를 수정합니다.'
                : '새로운 자산을 추가합니다.'}
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
                <div className="flex gap-2">
                  <Input
                    id="ticker"
                    placeholder="예: 005930.KS, AAPL, BTC-USD"
                    value={formData.ticker}
                    onChange={(e) => {
                      setFormData({ ...formData, ticker: e.target.value.toUpperCase() })
                      setTickerValidation(null) // 입력 변경시 검증 결과 초기화
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleValidateTicker}
                    disabled={!formData.ticker.trim() || validateTickerMutation.isPending}
                  >
                    {validateTickerMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '검증'
                    )}
                  </Button>
                </div>

                {/* 티커 검증 결과 */}
                {tickerValidation && (
                  <div className={`p-3 rounded-lg border ${
                    tickerValidation.valid
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                  }`}>
                    <div className="flex items-start gap-2">
                      {tickerValidation.valid ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      )}
                      <div className="text-sm">
                        {tickerValidation.valid ? (
                          <>
                            <p className="font-medium text-green-700 dark:text-green-400">
                              {tickerValidation.name}
                            </p>
                            <p className="text-green-600 dark:text-green-500">
                              현재가: {tickerValidation.currency} {tickerValidation.current_price?.toLocaleString()}
                              {tickerValidation.exchange && ` (${tickerValidation.exchange})`}
                            </p>
                          </>
                        ) : (
                          <p className="text-red-700 dark:text-red-400">
                            {tickerValidation.error || '유효하지 않은 티커입니다.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">티커 형식 안내</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>한국 주식: 종목코드.KS (예: 005930.KS - 삼성전자)</li>
                    <li>코스닥: 종목코드.KQ (예: 035720.KQ - 카카오)</li>
                    <li>미국 주식/ETF: 티커 그대로 (예: AAPL, SPY, QQQ)</li>
                    <li>암호화폐: 심볼-USD (예: BTC-USD, ETH-USD)</li>
                  </ul>
                </div>
              </div>
            )}

            {/* 수량 & 평균 매수가 */}
            {!isCashType ? (
              <>
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
                    <Label htmlFor="average_price">
                      평균 매수가 {formData.currency === 'USD' ? '(USD)' : ''} *
                    </Label>
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

                {/* USD 자산일 때 환율 입력 */}
                {formData.currency === 'USD' && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="purchase_exchange_rate">
                        매수 시점 환율 (USD/KRW)
                      </Label>
                      <Input
                        id="purchase_exchange_rate"
                        type="number"
                        step="0.01"
                        placeholder={exchangeRateData ? `현재: ${exchangeRateData.rate.toLocaleString()}` : '예: 1350.00'}
                        value={formData.purchase_exchange_rate}
                        onChange={(e) =>
                          setFormData({ ...formData, purchase_exchange_rate: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        비워두면 현재 환율로 계산됩니다.
                        {exchangeRateData && (
                          <span className="ml-2 text-primary">
                            현재 환율: 1 USD = {exchangeRateData.rate.toLocaleString()} KRW
                          </span>
                        )}
                      </p>
                    </div>

                    {/* 원화 환산 취득가 표시 */}
                    {krwCostBasis && (
                      <div className="p-3 rounded-lg border bg-muted/50">
                        <p className="text-sm text-muted-foreground">원화 환산 취득가</p>
                        <p className="text-lg font-semibold">{formatKRW(krwCostBasis)}</p>
                      </div>
                    )}
                  </>
                )}
              </>
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
                placeholder="투자 메모, 매수 이유 등"
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
