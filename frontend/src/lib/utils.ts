import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 숫자를 한국식 통화로 포맷팅 냥~
 */
export function formatKRW(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
}

/** 큰 원화 금액을 대시보드에서 빠르게 읽을 수 있는 개략값으로 표시한다. */
export function formatApproxKRW(value: number): string {
  const absoluteValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absoluteValue >= 100_000_000) {
    return `${sign}약 ${(absoluteValue / 100_000_000).toFixed(1)}억원`
  }
  if (absoluteValue >= 10_000) {
    return `${sign}약 ${Math.round(absoluteValue / 10_000).toLocaleString('ko-KR')}만원`
  }
  return `${sign}약 ${Math.round(absoluteValue).toLocaleString('ko-KR')}원`
}

/**
 * 숫자를 퍼센트로 포맷팅 냥~
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * 수익/손실에 따른 클래스 반환 냥~
 * 한국식: 빨간색 = 수익, 파란색 = 손실
 */
export function getProfitClass(value: number): string {
  if (value > 0) return 'text-red-500'  // 수익
  if (value < 0) return 'text-blue-500' // 손실
  return 'text-gray-500'
}

/**
 * 날짜 포맷팅 냥~
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * 숫자를 달러로 포맷팅 냥~
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * USD 가격을 달러/원화 병행 표시 냥~
 */
export function formatUSDWithKRW(usdValue: number, exchangeRate: number): string {
  const krwValue = usdValue * exchangeRate
  return `${formatUSD(usdValue)} (${formatKRW(krwValue)})`
}

/**
 * 프라이버시 마스킹 문자열 냥~
 */
export const PRIVACY_MASK = '***,***'

/**
 * 프라이버시 모드일 때 금액 마스킹 냥~
 */
export function maskValue(value: string, isPrivacyMode: boolean): string {
  return isPrivacyMode ? PRIVACY_MASK : value
}
