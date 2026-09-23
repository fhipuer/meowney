import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RegimeSummaryView } from './RegimeSummary'
import type { RegimeDashboardSummary } from '@/types'

const summary: RegimeDashboardSummary = {
  available: true,
  evaluated_at: '2026-09-24T00:00:00+00:00',
  automatic_regime: '경계',
  review_urgency: 'watch',
  review_acknowledged: false,
  needs_new_review: false,
  active_trigger_count: 2,
}

describe('RegimeSummaryView', () => {
  it('renders the persisted compact regime summary', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RegimeSummaryView data={summary} isLoading={false} />
      </MemoryRouter>,
    )

    expect(html).toContain('다음 발표까지 관찰')
    expect(html).toContain('활성 위험 신호 2개')
    expect(html).toContain('위험 신호 관찰')
  })

  it('renders a safe placeholder before the first persisted evaluation', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RegimeSummaryView
          data={{ ...summary, available: false, automatic_regime: null, active_trigger_count: 0 }}
          isLoading={false}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('레짐 데이터 준비 중')
    expect(html).toContain('레짐 데이터 설정 후 시장 맥락을 표시합니다.')
  })
})
