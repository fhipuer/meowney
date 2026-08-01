import { describe, expect, it } from 'vitest'
import { getExchangeRateChange, getPriceStatusLabel } from './asset-display'

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
    ['stale', '지연 시세'],
    ['unavailable', '확인 불가'],
    ['fresh', '정상'],
    [undefined, '정상'],
  ])('maps %s to %s', (status, expected) => {
    expect(getPriceStatusLabel(status)).toBe(expected)
  })
})
