import { describe, expect, it } from 'vitest'
import {
  getAssetReturnBreakdown,
  getExchangeRateChange,
  getPriceStatusLabel,
} from './asset-display'

describe('getAssetReturnBreakdown', () => {
  const usdAsset = {
    currency: 'USD',
    asset_type: 'stock',
    native_profit_rate: 25,
    fx_change_rate: 8.333333,
    asset_price_effect_krw: 72_000,
    fx_effect_krw: 30_000,
    cost_basis_krw: 288_000,
    market_value: 390_000,
  }

  it('builds an exact two-step KRW profit bridge', () => {
    expect(getAssetReturnBreakdown(usdAsset)).toEqual({
      nativeProfitRate: 25,
      fxChangeRate: 8.333333,
      assetPriceEffectKrw: 72_000,
      fxEffectKrw: 30_000,
      costBasisKrw: 288_000,
      priceAdjustedValueKrw: 360_000,
      marketValueKrw: 390_000,
    })
  })

  it('does not offer a split for KRW, cash, or incomplete data', () => {
    expect(getAssetReturnBreakdown({ ...usdAsset, currency: 'KRW' })).toBeNull()
    expect(getAssetReturnBreakdown({ ...usdAsset, asset_type: 'cash' })).toBeNull()
    expect(getAssetReturnBreakdown({ ...usdAsset, fx_effect_krw: null })).toBeNull()
  })

  it('accepts Decimal fields serialized as JSON strings by the API', () => {
    const result = getAssetReturnBreakdown({
      ...usdAsset,
      asset_price_effect_krw: '72000',
      fx_effect_krw: '30000',
      cost_basis_krw: '288000',
      market_value: '390000',
    })

    expect(result?.priceAdjustedValueKrw).toBe(360_000)
    expect(result?.marketValueKrw).toBe(390_000)
  })
})

describe('getExchangeRateChange', () => {
  it('calculates a positive exchange-rate change', () => {
    expect(getExchangeRateChange(1_300, 1_430)).toEqual({
      purchaseRate: 1_300,
      currentRate: 1_430,
      changePercent: 10,
      isPositive: true,
    })
  })

  it('calculates a negative exchange-rate change', () => {
    const result = getExchangeRateChange(1_400, 1_330)
    expect(result?.changePercent).toBeCloseTo(-5)
    expect(result?.isPositive).toBe(false)
  })

  it('returns null when either rate is unavailable', () => {
    expect(getExchangeRateChange(undefined, 1_400)).toBeNull()
    expect(getExchangeRateChange(1_300, null)).toBeNull()
  })
})

describe('getPriceStatusLabel', () => {
  it.each([
    ['live', '실시간 시세'],
    ['close', '공식 종가'],
    ['cached', '캐시 시세'],
    ['stale', '지연 시세'],
    ['manual', '수동 평가'],
    ['unavailable', '확인 불가'],
    ['fresh', '정상'],
    [undefined, '정상'],
  ])('maps %s to %s', (status, expected) => {
    expect(getPriceStatusLabel(status)).toBe(expected)
  })
})
