export interface ExchangeRateChange {
  purchaseRate: number
  currentRate: number
  changePercent: number
  isPositive: boolean
}

export function getExchangeRateChange(
  purchaseRate: number | null | undefined,
  currentRate: number | null | undefined
): ExchangeRateChange | null {
  if (!purchaseRate || !currentRate) return null
  const changePercent = ((currentRate - purchaseRate) / purchaseRate) * 100
  return { purchaseRate, currentRate, changePercent, isPositive: changePercent > 0 }
}

export function getPriceStatusLabel(status: string | null | undefined) {
  if (status === 'stale') return '지연 시세'
  if (status === 'unavailable') return '확인 불가'
  return '정상'
}
