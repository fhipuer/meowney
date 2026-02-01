export interface PortfolioAllocation {
  name: string
  percentage: number
  color: string
}

export interface PortfolioTemplate {
  id: string
  name: string
  nameKo: string
  creator: string
  year: number
  description: string
  philosophy: string
  riskLevel: 'low' | 'medium-low' | 'medium' | 'medium-high' | 'high'
  riskScore: number // 1-5
  expectedReturn: string // "연 5~7%"
  suitableFor: string[]
  allocations: PortfolioAllocation[]
  pros: string[]
  cons: string[]
  koreaAdapted?: PortfolioAllocation[]
}

export const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
  {
    id: 'all-weather',
    name: 'All Weather',
    nameKo: '레이 달리오 올웨더',
    creator: 'Ray Dalio (Bridgewater Associates)',
    year: 1996,
    description: '어떤 경제 환경에서도 안정적인 수익을 추구하는 사계절 포트폴리오',
    philosophy:
      '경제는 4가지 환경(성장/침체 × 인플레/디플레)을 순환하며, 각 환경에 강한 자산을 배분',
    riskLevel: 'medium-low',
    riskScore: 2,
    expectedReturn: '연 5~7%',
    suitableFor: ['안정 추구 투자자', '장기 보유 가능자', '시장 타이밍을 포기한 분'],
    allocations: [
      { name: '장기국채', percentage: 40, color: '#6366f1' },
      { name: '주식', percentage: 30, color: '#ef4444' },
      { name: '중기국채', percentage: 15, color: '#3b82f6' },
      { name: '금', percentage: 7.5, color: '#eab308' },
      { name: '원자재', percentage: 7.5, color: '#f97316' },
    ],
    pros: [
      '낮은 변동성',
      '어떤 시장 환경에도 대응',
      '장기적으로 안정적',
    ],
    cons: [
      '주식 비중이 낮아 강세장에서 수익 제한',
      '원자재 접근이 어려울 수 있음',
    ],
    koreaAdapted: [
      { name: '미국 장기채 ETF', percentage: 40, color: '#6366f1' },
      { name: '국내+해외 주식 ETF', percentage: 30, color: '#ef4444' },
      { name: '미국 중기채 ETF', percentage: 15, color: '#3b82f6' },
      { name: '금 ETF', percentage: 7.5, color: '#eab308' },
      { name: '원자재 ETF', percentage: 7.5, color: '#f97316' },
    ],
  },
  {
    id: 'sixty-forty',
    name: 'Classic 60/40',
    nameKo: '전통 60/40 포트폴리오',
    creator: '전통적 자산배분 이론',
    year: 1952,
    description: '가장 오래되고 널리 알려진 기본 자산배분 전략',
    philosophy:
      '주식으로 성장을 추구하고, 채권으로 안정성을 확보하는 균형 전략',
    riskLevel: 'medium',
    riskScore: 3,
    expectedReturn: '연 6~8%',
    suitableFor: [
      '투자 입문자',
      '균형 잡힌 투자를 원하는 분',
      '중기~장기 투자자',
    ],
    allocations: [
      { name: '주식', percentage: 60, color: '#ef4444' },
      { name: '채권', percentage: 40, color: '#3b82f6' },
    ],
    pros: [
      '단순하고 이해하기 쉬움',
      '오랜 역사로 검증됨',
      '리밸런싱이 간단',
    ],
    cons: [
      '저금리 환경에서 채권 수익 제한',
      '인플레이션 헤지 부족',
    ],
    koreaAdapted: [
      { name: '국내 주식 ETF', percentage: 25, color: '#ef4444' },
      { name: '해외 주식 ETF', percentage: 35, color: '#f43f5e' },
      { name: '국내 채권 ETF', percentage: 20, color: '#3b82f6' },
      { name: '해외 채권 ETF', percentage: 20, color: '#6366f1' },
    ],
  },
  {
    id: 'three-fund',
    name: 'Boglehead Three Fund',
    nameKo: '보글헤드 3펀드 포트폴리오',
    creator: 'John C. Bogle (Vanguard 창립자)',
    year: 1999,
    description: '단 3개의 인덱스 펀드로 전 세계 시장을 커버하는 심플한 전략',
    philosophy:
      '저비용 인덱스 펀드로 시장 전체에 투자하면 대부분의 액티브 펀드를 이길 수 있다',
    riskLevel: 'medium-high',
    riskScore: 4,
    expectedReturn: '연 7~9%',
    suitableFor: ['장기 투자자 (10년+)', '낮은 비용을 원하는 분', 'DIY 투자자'],
    allocations: [
      { name: '미국 주식', percentage: 40, color: '#ef4444' },
      { name: '국제 주식', percentage: 20, color: '#f97316' },
      { name: '채권', percentage: 40, color: '#3b82f6' },
    ],
    pros: ['극도로 단순', '최저 비용', '광범위한 분산'],
    cons: ['대체자산 미포함', '신흥국 비중이 상대적으로 낮음'],
    koreaAdapted: [
      { name: '국내 주식 ETF (KODEX 200)', percentage: 20, color: '#ef4444' },
      { name: '미국 주식 ETF (S&P 500)', percentage: 30, color: '#f43f5e' },
      { name: '선진국 주식 ETF', percentage: 10, color: '#f97316' },
      { name: '국내+해외 채권 ETF', percentage: 40, color: '#3b82f6' },
    ],
  },
  {
    id: 'permanent',
    name: 'Permanent Portfolio',
    nameKo: '해리 브라운 영구 포트폴리오',
    creator: 'Harry Browne',
    year: 1981,
    description:
      '4가지 자산을 동일 비중으로 보유하여 어떤 경제 상황에도 대응하는 영구 전략',
    philosophy: '경제의 4가지 상태(번영/침체/인플레/디플레)에 각각 25%씩 대응',
    riskLevel: 'low',
    riskScore: 1,
    expectedReturn: '연 4~6%',
    suitableFor: [
      '극도의 안정을 원하는 분',
      '은퇴자 또는 은퇴 임박자',
      '투자에 시간을 쓰고 싶지 않은 분',
    ],
    allocations: [
      { name: '주식', percentage: 25, color: '#ef4444' },
      { name: '장기 국채', percentage: 25, color: '#3b82f6' },
      { name: '금', percentage: 25, color: '#eab308' },
      { name: '현금/단기채', percentage: 25, color: '#22c55e' },
    ],
    pros: [
      '매우 낮은 변동성',
      '극도로 단순한 리밸런싱',
      '어떤 환경에서도 방어',
    ],
    cons: ['성장기에 수익 제한', '금 비중이 높음'],
    koreaAdapted: [
      { name: '주식 ETF', percentage: 25, color: '#ef4444' },
      { name: '미국 장기채 ETF', percentage: 25, color: '#3b82f6' },
      { name: '금 ETF', percentage: 25, color: '#eab308' },
      { name: 'CMA/MMF', percentage: 25, color: '#22c55e' },
    ],
  },
  {
    id: 'korean-balanced',
    name: 'Korean Balanced',
    nameKo: '한국형 균형 포트폴리오',
    creator: 'Meowney 추천',
    year: 2024,
    description: '한국 투자자의 환경에 맞춘 실용적인 균형 포트폴리오',
    philosophy:
      '국내외 분산 + 환율 헤지 + 접근 가능한 ETF 중심의 실용적 배분',
    riskLevel: 'medium',
    riskScore: 3,
    expectedReturn: '연 5~8%',
    suitableFor: ['한국 ETF 투자자', '해외 투자도 원하는 분', '중기~장기 투자자'],
    allocations: [
      { name: '국내 주식', percentage: 25, color: '#ef4444' },
      { name: '해외 주식', percentage: 30, color: '#f43f5e' },
      { name: '국내 채권', percentage: 20, color: '#3b82f6' },
      { name: '해외 채권', percentage: 10, color: '#6366f1' },
      { name: '금', percentage: 10, color: '#eab308' },
      { name: '현금', percentage: 5, color: '#22c55e' },
    ],
    pros: [
      '한국 시장 접근 용이',
      '환율 분산 효과',
      '실제 매수 가능한 ETF 중심',
    ],
    cons: ['6개 자산으로 리밸런싱이 약간 복잡'],
  },
]

export const RISK_LEVEL_CONFIG: Record<
  PortfolioTemplate['riskLevel'],
  { label: string; color: string; bgColor: string }
> = {
  low: {
    label: '안정',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  'medium-low': {
    label: '안정~중립',
    color: 'text-teal-600',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
  },
  medium: {
    label: '중립',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  'medium-high': {
    label: '중립~공격',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  high: {
    label: '공격',
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
}
