import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MarketIndicators, normalizedDollarTrend } from './MarketIndicators'
import type { RegimeCurrent, RegimeSignal } from '@/types'

const signal = (id: string, name: string, value: number, history = true): RegimeSignal => ({
  id,
  name,
  value,
  domain: '시장·밸류에이션',
  source: id === 'market_kospi' || id === 'market_dxy' ? 'yfinance' : 'fred',
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
        signal('market_dxy', 'ICE 미국 달러지수 DXY', 98.8),
        signal('market_dollar', '미국 달러지수(광의)', 118.9),
        signal('market_wti', 'WTI 유가', 78, false),
        signal('market_ovx', '원유 변동성 OVX', 49.6, false),
        signal('market_copper', '구리 가격', 9900, false),
      ]}
      triggers={[{
        rule_id: 'market.market_nasdaq.drawdown',
        rule_version: 'test',
        domain: 'market',
        severity: 'high',
        evidence_cluster: 'market_price',
        summary: 'NASDAQ 급락',
        evidence: {},
      }]}
      energyShock={{
        state: '가격·변동성 경계',
        reason: '유가와 원유 변동성은 부담을 가리키지만 미국 상업용 재고가 공급 부족을 확인하지 않습니다.',
        tone: 'caution',
        severity: 'medium',
        role: 'macro_early_warning',
        asset_recommendation: false,
        coverage: 1,
        as_of_date: '2026-08-18',
        methodology: 'test',
        limitations: 'test',
        components: {
          wti: { value: 86.48, observation_date: '2026-08-18', change_5d: 1, change_20d: 2.5, change_63d: -23, change_12m: 35.8, fresh: true },
          ovx: { value: 49.6, observation_date: '2026-08-18', percentile_1y: 88, fresh: true },
          inventory: { value: 428815, unit: 'thousand barrels', observation_date: '2026-08-14', change_4w: 4.2, change_52w: 1.9, physical_tightening: false, inventory_build: true, fresh: true },
        },
      } as RegimeCurrent['energy_shock']}
    />)

    expect(html).toContain('aria-label="시장 환경 지표 사용법"')
    expect(html).toContain('위험자산 상대 흐름')
    expect(html).toContain('달러 환경')
    expect(html).toContain('DXY')
    expect(html).toContain('Fed 광의 달러')
    expect(html).toContain('aria-label="DXY와 광의 달러의 역할"')
    expect(html).toContain('달러 강도 방향 비교')
    expect(html).toContain('WTI')
    expect(html).toContain('구리')
    expect(html).toContain('OVX')
    expect(html).toContain('에너지 가격·공급충격')
    expect(html).toContain('가격·변동성 경계')
    expect(html).toContain('거시 조기경보')
    expect(html).toContain('aria-label="위험자산 상대 흐름 계산 방식"')
    expect(html).not.toContain('지수 간 절대 수준 비교가 아닙니다')
    expect(html).toContain('경보 전용')
    expect(html).toContain('위험회피 경보')
    expect(html).toContain('aria-label="시장 환경 지표 사용법"')
  })

  it('normalizes DXY and broad dollar to their shared display start', () => {
    const dxy = signal('market_dxy', 'DXY', 102)
    dxy.history = [
      { date: '2026-07-01', value: 100 },
      { date: '2026-08-01', value: 102 },
    ]
    const broad = signal('market_dollar', '광의 달러', 204)
    broad.history = [
      { date: '2026-06-01', value: 190 },
      { date: '2026-07-01', value: 200 },
      { date: '2026-08-01', value: 204 },
    ]

    const trend = normalizedDollarTrend(dxy, broad)

    expect(trend).toEqual([
      { date: '2026-07-01', market_dxy: 100, market_dollar: 100 },
      { date: '2026-08-01', market_dxy: 102, market_dollar: 102 },
    ])
  })
})
