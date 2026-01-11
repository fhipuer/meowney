/**
 * 리밸런싱 페이지 냥~ 🐱
 */
import { RebalanceCalculator } from '@/components/assets/RebalanceCalculator'

export function RebalancePage() {
  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">리밸런싱</h1>
        <p className="text-muted-foreground">
          목표 비율에 맞게 포트폴리오를 조정하세요 냥~ 🐱
        </p>
      </div>

      {/* 리밸런싱 계산기 */}
      <RebalanceCalculator />
    </div>
  )
}
