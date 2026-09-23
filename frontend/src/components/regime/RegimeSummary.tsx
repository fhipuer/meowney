import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { Activity, ArrowRight } from 'lucide-react'
import { regimeApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TONE_STYLES, regimeLevelTone } from '@/lib/regime-tone'
import { regimeLevelLabel } from '@/lib/regime-display'
import type { RegimeDashboardSummary } from '@/types'

export function RegimeSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['regime', 'summary'],
    queryFn: regimeApi.getSummary,
    staleTime: 60 * 1000,
  })
  return <RegimeSummaryView data={data} isLoading={isLoading} />
}

export function RegimeSummaryView({
  data,
  isLoading,
}: {
  data?: RegimeDashboardSummary
  isLoading: boolean
}) {
  const reviewTone = data?.needs_new_review
    ? 'text-danger'
    : data?.review_urgency === 'watch'
      ? 'text-warning'
      : 'text-success'
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Activity className="h-5 w-5" /></div>
        <div className="min-w-40">
          <p className="text-xs text-muted-foreground">포트폴리오 점검 신호</p>
          <p className={`text-xl font-semibold ${isLoading ? 'text-foreground' : reviewTone}`}>{isLoading ? '확인 중' : !data?.available ? '레짐 데이터 준비 중' : data.needs_new_review ? '상세 점검 필요' : data.review_acknowledged ? '마지막 신호 확인 완료' : data.review_urgency === 'watch' ? '다음 발표까지 관찰' : '새 점검 사유 없음'}</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {data?.available && data.automatic_regime ? (
            <>
              <Badge className="max-w-full whitespace-normal text-center leading-4" variant={TONE_STYLES[regimeLevelTone(data.automatic_regime)].badge}>{regimeLevelLabel(data.automatic_regime)}</Badge>
              <span className={data.active_trigger_count ? 'text-danger' : undefined}>활성 위험 신호 {data.active_trigger_count}개</span>
            </>
          ) : '레짐 데이터 설정 후 시장 맥락을 표시합니다.'}
        </div>
        <NavLink to="/regime" className="flex items-center gap-1 text-sm font-medium text-primary">상세 보기 <ArrowRight className="h-4 w-4" /></NavLink>
      </CardContent>
    </Card>
  )
}
