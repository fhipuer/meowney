import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { Activity, ArrowRight } from 'lucide-react'
import { regimeApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'

export function RegimeSummary() {
  const { data, isLoading } = useQuery({ queryKey: ['regime', 'current'], queryFn: regimeApi.getCurrent })
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Activity className="h-5 w-5" /></div>
        <div className="min-w-40">
          <p className="text-xs text-muted-foreground">포트폴리오 점검 신호</p>
          <p className="text-xl font-semibold">{isLoading ? '확인 중' : data?.needs_new_review ? '상세 점검 필요' : data?.review_acknowledged ? '점검 완료' : data?.review_urgency === 'watch' ? '관찰 필요' : '점검 불필요'}</p>
        </div>
        <p className="flex-1 text-sm text-muted-foreground">{data ? `확정 레짐 ${data.automatic_regime} · 활성 경보 ${data.triggers.length}개` : '레짐 데이터 설정 후 시장 맥락을 표시합니다.'}</p>
        <NavLink to="/regime" className="flex items-center gap-1 text-sm font-medium text-primary">상세 보기 <ArrowRight className="h-4 w-4" /></NavLink>
      </CardContent>
    </Card>
  )
}
