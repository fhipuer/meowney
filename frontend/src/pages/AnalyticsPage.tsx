/**
 * 분석 페이지 냥~ 🐱
 * 상세 시각화 및 벤치마크 비교
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AllocationHistoryChart } from '@/components/analytics/AllocationHistoryChart'
import { PerformanceChart } from '@/components/analytics/PerformanceChart'
import { RebalanceHistoryChart } from '@/components/analytics/RebalanceHistoryChart'

export function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">분석</h1>
        <p className="text-muted-foreground">
          투자 분석 리포트를 확인합니다.
        </p>
      </div>

      <Tabs defaultValue="allocation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="allocation">자산 배분 변화</TabsTrigger>
          <TabsTrigger value="performance">수익률 추이</TabsTrigger>
          <TabsTrigger value="rebalance">리밸런싱 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="mt-6">
          <AllocationHistoryChart />
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <PerformanceChart />
        </TabsContent>

        <TabsContent value="rebalance" className="mt-6">
          <RebalanceHistoryChart />
        </TabsContent>
      </Tabs>
    </div>
  )
}
