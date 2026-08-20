import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PRIVACY_MASK } from '@/lib/utils'
import { RebalancePage } from './RebalancePage'

const privacy = vi.hoisted(() => ({ enabled: false }))

vi.mock('@/store/useStore', () => ({
  useStore: () => ({ isPrivacyMode: privacy.enabled }),
}))

vi.mock('@/hooks/useRebalance', () => ({
  usePlans: () => ({
    data: [{ id: 'main-plan', name: '메인 플랜', is_main: true }],
    isLoading: false,
  }),
  useCalculateRebalance: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
    data: {
      plan_name: '메인 플랜',
      total_value: 486_500_000,
      valuation_complete: true,
      stale_asset_count: 0,
      suggestions: [{
        asset_name: '테스트 자산',
        ticker: 'TEST',
        current_percentage: 25,
        target_percentage: 30,
        current_value: 123_456_789,
        suggested_amount: 25_000_000,
        suggested_quantity: 2,
        action: 'buy',
        effective_band: 5,
      }],
      group_suggestions: [{
        group_name: '테스트 그룹',
        current_percentage: 20,
        target_percentage: 15,
        current_value: 98_765_432,
        suggested_amount: -12_000_000,
        action: 'sell',
      }],
    },
  }),
}))

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    data: { default_absolute_band: 5, default_relative_band: 25 },
  }),
}))

function renderPage() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RebalancePage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  privacy.enabled = false
})

describe('RebalancePage privacy mode', () => {
  it('masks every monetary result while preserving allocation percentages', () => {
    privacy.enabled = true

    const html = renderPage()

    expect(html.match(/\*\*\*,\*\*\*/g)?.length).toBeGreaterThanOrEqual(5)
    expect(html).not.toContain('₩486,500,000')
    expect(html).not.toContain('₩123,456,789')
    expect(html).not.toContain('₩25,000,000')
    expect(html).not.toContain('₩98,765,432')
    expect(html).not.toContain('₩12,000,000')
    expect(html).toContain('현재: 25.0%')
    expect(html).toContain('약 2.00주')
    expect(html).toContain(PRIVACY_MASK)
  })

  it('keeps monetary results visible when privacy mode is disabled', () => {
    privacy.enabled = false

    const html = renderPage()

    expect(html).toContain('₩486,500,000')
    expect(html).toContain('₩123,456,789')
    expect(html).toContain('₩25,000,000')
    expect(html).not.toContain(PRIVACY_MASK)
  })
})
