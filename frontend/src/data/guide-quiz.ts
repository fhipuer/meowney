import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  ShieldAlert,
  GraduationCap,
  Target,
  TrendingDown,
  Wallet,
} from 'lucide-react'

export interface QuizOption {
  text: string
  score: number
}

export interface QuizQuestion {
  id: number
  question: string
  description?: string
  icon: LucideIcon
  options: QuizOption[]
}

export interface QuizResultAllocation {
  name: string
  percentage: number
  color: string
}

export interface QuizResult {
  type:
    | 'conservative'
    | 'moderate-conservative'
    | 'balanced'
    | 'moderate-aggressive'
    | 'aggressive'
  nameKo: string
  emoji: string
  catPersonality: string
  description: string
  recommendedPortfolios: string[] // IDs from guide-portfolios.ts
  allocationSuggestion: QuizResultAllocation[]
  scoreRange: [number, number]
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: '투자한 돈을 얼마나 오래 묻어둘 수 있나요?',
    icon: Calendar,
    options: [
      { text: '1년 이내', score: 1 },
      { text: '1~3년', score: 2 },
      { text: '3~5년', score: 3 },
      { text: '5~10년', score: 4 },
      { text: '10년 이상', score: 5 },
    ],
  },
  {
    id: 2,
    question: '투자 금액이 일시적으로 얼마나 떨어져도 견딜 수 있나요?',
    icon: ShieldAlert,
    options: [
      { text: '-5% 이하만 괜찮아요', score: 1 },
      { text: '-10% 정도는 괜찮아요', score: 2 },
      { text: '-20% 정도는 괜찮아요', score: 3 },
      { text: '-30%도 버틸 수 있어요', score: 4 },
      { text: '-50%도 장기적으로 회복 기다릴 수 있어요', score: 5 },
    ],
  },
  {
    id: 3,
    question: '투자 경험은 어느 정도인가요?',
    icon: GraduationCap,
    options: [
      { text: '처음이에요 (예적금만 해봤어요)', score: 1 },
      { text: '주식을 조금 해봤어요 (1년 미만)', score: 2 },
      { text: '주식/ETF 투자 중이에요 (1~3년)', score: 3 },
      { text: '다양한 자산에 투자해봤어요 (3년+)', score: 4 },
      { text: '전문적으로 투자하고 있어요', score: 5 },
    ],
  },
  {
    id: 4,
    question: '주된 투자 목적은 무엇인가요?',
    icon: Target,
    options: [
      { text: '원금을 잃지 않는 것이 최우선', score: 1 },
      { text: '물가 상승률 정도의 안정적 수익', score: 2 },
      { text: '은행 이자보다 높은 적당한 수익', score: 3 },
      { text: '시장 평균 수준의 성장', score: 4 },
      { text: '높은 수익, 위험은 감수', score: 5 },
    ],
  },
  {
    id: 5,
    question:
      '주식 시장이 한 달 만에 -20% 폭락했어요. 어떻게 하시겠어요?',
    icon: TrendingDown,
    options: [
      { text: '즉시 전량 매도! 더 떨어지기 전에!', score: 1 },
      { text: '일부만 매도하고 안전자산으로 이동', score: 2 },
      { text: '아무것도 안 하고 지켜본다', score: 3 },
      { text: '계획대로 리밸런싱한다', score: 4 },
      { text: '오히려 추가 매수! 세일이다!', score: 5 },
    ],
  },
  {
    id: 6,
    question: '현재 수입 상황은 어떤가요?',
    icon: Wallet,
    options: [
      { text: '수입이 불안정하거나 은퇴 후', score: 1 },
      { text: '수입은 있지만 여유가 적어요', score: 2 },
      { text: '안정적 수입, 적당한 여유', score: 3 },
      { text: '안정적 수입, 충분한 여유 자금', score: 4 },
      { text: '높은 수입, 투자 금액은 전체의 일부', score: 5 },
    ],
  },
]

export const QUIZ_RESULTS: QuizResult[] = [
  {
    type: 'conservative',
    nameKo: '보수형 투자자',
    emoji: '😺',
    catPersonality:
      '느긋한 노묘 스타일! 따뜻한 양지에서 낮잠 자듯 안전한 투자를 선호해요.',
    description:
      '원금 보존을 최우선으로 하며, 안정적인 수익을 추구합니다. 큰 변동이 적은 포트폴리오가 적합해요.',
    recommendedPortfolios: ['permanent', 'all-weather'],
    allocationSuggestion: [
      { name: '주식', percentage: 20, color: '#ef4444' },
      { name: '채권', percentage: 55, color: '#3b82f6' },
      { name: '현금', percentage: 15, color: '#22c55e' },
      { name: '금', percentage: 10, color: '#eab308' },
    ],
    scoreRange: [6, 10],
  },
  {
    type: 'moderate-conservative',
    nameKo: '안정형 투자자',
    emoji: '🐱',
    catPersonality:
      '조심스러운 실내묘 스타일! 안전한 집 안에서 가끔 창밖을 구경하는 타입이에요.',
    description:
      '안정성을 중시하면서도 적당한 성장을 원합니다. 채권 중심에 주식을 적절히 배합해요.',
    recommendedPortfolios: ['all-weather', 'sixty-forty'],
    allocationSuggestion: [
      { name: '주식', percentage: 35, color: '#ef4444' },
      { name: '채권', percentage: 40, color: '#3b82f6' },
      { name: '현금', percentage: 15, color: '#22c55e' },
      { name: '금', percentage: 10, color: '#eab308' },
    ],
    scoreRange: [11, 14],
  },
  {
    type: 'balanced',
    nameKo: '균형형 투자자',
    emoji: '😸',
    catPersonality:
      '균형 잡힌 집고양이 스타일! 놀 때는 놀고, 쉴 때는 쉬는 현명한 고양이에요.',
    description:
      '위험과 수익의 균형을 추구합니다. 주식과 채권을 적절히 배합하여 안정적 성장을 노려요.',
    recommendedPortfolios: ['sixty-forty', 'korean-balanced'],
    allocationSuggestion: [
      { name: '주식', percentage: 50, color: '#ef4444' },
      { name: '채권', percentage: 30, color: '#3b82f6' },
      { name: '현금', percentage: 10, color: '#22c55e' },
      { name: '금', percentage: 10, color: '#eab308' },
    ],
    scoreRange: [15, 19],
  },
  {
    type: 'moderate-aggressive',
    nameKo: '적극형 투자자',
    emoji: '😼',
    catPersonality:
      '호기심 많은 탐험묘 스타일! 높은 곳도 두려워하지 않고 뛰어오르는 용감한 고양이!',
    description:
      '높은 성장을 추구하며 상당한 변동성을 감내할 수 있습니다. 주식 중심 포트폴리오가 적합해요.',
    recommendedPortfolios: ['three-fund', 'korean-balanced'],
    allocationSuggestion: [
      { name: '주식', percentage: 65, color: '#ef4444' },
      { name: '채권', percentage: 25, color: '#3b82f6' },
      { name: '현금', percentage: 5, color: '#22c55e' },
      { name: '금', percentage: 5, color: '#eab308' },
    ],
    scoreRange: [20, 24],
  },
  {
    type: 'aggressive',
    nameKo: '공격형 투자자',
    emoji: '🙀',
    catPersonality:
      '야생 고양이 스타일! 어떤 모험도 두렵지 않은 대담한 정글의 왕이에요!',
    description:
      '최대 수익을 목표로 높은 위험을 감수합니다. 주식 비중이 매우 높은 공격적 배분이 적합해요.',
    recommendedPortfolios: ['three-fund'],
    allocationSuggestion: [
      { name: '주식', percentage: 80, color: '#ef4444' },
      { name: '채권', percentage: 15, color: '#3b82f6' },
      { name: '현금', percentage: 5, color: '#22c55e' },
    ],
    scoreRange: [25, 30],
  },
]

export function getQuizResult(totalScore: number): QuizResult {
  const result = QUIZ_RESULTS.find(
    (r) => totalScore >= r.scoreRange[0] && totalScore <= r.scoreRange[1]
  )

  if (!result) {
    // Fallback to balanced if score is out of expected range
    return QUIZ_RESULTS.find((r) => r.type === 'balanced')!
  }

  return result
}
