import { describe, expect, it } from 'vitest'

import { PRIVACY_MASK } from '@/lib/utils'
import { formatAssetTrendYAxisTick } from './AssetTrendChart'

describe('AssetTrendChart privacy mode', () => {
  it('masks Y-axis monetary ticks in privacy mode', () => {
    expect(formatAssetTrendYAxisTick(400_000_000, true)).toBe(PRIVACY_MASK)
  })

  it('keeps the existing monetary scale outside privacy mode', () => {
    expect(formatAssetTrendYAxisTick(400_000_000, false)).toBe('40000만')
  })
})
