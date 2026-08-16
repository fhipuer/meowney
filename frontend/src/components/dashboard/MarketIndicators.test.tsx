import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MarketIndicators } from './MarketIndicators'
import type { RegimeSignal } from '@/types'

const signal = (id: string, name: string, value: number, history = true): RegimeSignal => ({
  id,
  name,
  value,
  domain: '시장·밸류에이션',
  source: id === 'market_kospi' ? 'yfinance' : 'fred',
  score: 0,
  status: '중립',
  reason: '시장 참고 지표',
  observation_date: '2026-08-14',
  change_1m: 1.2,
  change_3m: 3.4,
  change_12m: 8.6,
  history: history ? [
    { date: '2026-07-14', value: value * 0.95 },
    { date: '2026-08-14', value },
  ] : [],
  usage: id === 'market_sp500' || id === 'market_nasdaq' ? 'trigger' : 'display',
  decision_role: id === 'market_sp500' || id === 'market_nasdaq' ? 'corroborative' : 'context',
})

describe('MarketIndicators cached market view', () => {
  it('renders cached cross-asset indicators and normalized risk chart', () => {
    const html = renderToStaticMarkup(<MarketIndicators
      fetchedAt="2026-08-16T01:00:00Z"
      signals={[
        signal('market_sp500', 'S&P 500', 6500),
        signal('market_nasdaq', 'NASDAQ', 23000),
        signal('market_kospi', 'KOSPI', 3225),
        signal('market_wti', 'WTI 유가', 78, false),
        signal('market_copper', '구리 가격', 9900, false),
      ]}
    />)

    expect(html).toContain('시장가격만으로 자동 레짐을 변경하지 않습니다')
    expect(html).toContain('위험자산 상대 흐름')
    expect(html).toContain('WTI')
    expect(html).toContain('구리')
    expect(html).toContain('표시 구간 시작값을 100으로 환산')
    expect(html).toContain('경보 전용')
  })
})
