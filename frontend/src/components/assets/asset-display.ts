export interface ExchangeRateChange {
  purchaseRate: number
  currentRate: number
  changePercent: number
  isPositive: boolean
}

export function getExchangeRateChange(
  purchaseRate: number | null | undefined,
  currentRate: number | null | undefined
): ExchangeRateChange | null {
  if (!purchaseRate || !currentRate) return null
  const changePercent = ((currentRate - purchaseRate) / purchaseRate) * 100
  return { purchaseRate, currentRate, changePercent, isPositive: changePercent > 0 }
}

export function getPriceStatusLabel(status: string | null | undefined) {
  if (status === 'live') return '실시간 시세'
  if (status === 'close') return '공식 종가'
  if (status === 'cached') return '캐시 시세'
  if (status === 'stale') return '지연 시세'
  if (status === 'manual') return '수동 평가'
  if (status === 'unavailable') return '확인 불가'
  return '정상'
}

export interface AssetReturnBreakdownInput {
  currency: string
  asset_type: string
  native_profit_rate?: number | string | null
  fx_change_rate?: number | string | null
  asset_price_effect_krw?: number | string | null
  fx_effect_krw?: number | string | null
  cost_basis_krw: number | string | null
  market_value: number | string | null
}

export interface AssetReturnBreakdown {
  nativeProfitRate: number
  fxChangeRate: number
  assetPriceEffectKrw: number
  fxEffectKrw: number
  costBasisKrw: number
  priceAdjustedValueKrw: number
  marketValueKrw: number
}

export function getAssetReturnBreakdown(
  asset: AssetReturnBreakdownInput
): AssetReturnBreakdown | null {
  if (asset.currency !== 'USD' || asset.asset_type === 'cash') return null

  const rawValues = [
    asset.native_profit_rate,
    asset.fx_change_rate,
    asset.asset_price_effect_krw,
    asset.fx_effect_krw,
    asset.cost_basis_krw,
    asset.market_value,
  ]
  if (rawValues.some(value => value == null || value === '')) return null

  const values = rawValues.map(Number)
  if (values.some(value => !Number.isFinite(value))) return null

  const [
    nativeProfitRate,
    fxChangeRate,
    assetPriceEffectKrw,
    fxEffectKrw,
    costBasisKrw,
    marketValueKrw,
  ] = values as number[]

  return {
    nativeProfitRate,
    fxChangeRate,
    assetPriceEffectKrw,
    fxEffectKrw,
    costBasisKrw,
    priceAdjustedValueKrw: costBasisKrw + assetPriceEffectKrw,
    marketValueKrw,
  }
}
