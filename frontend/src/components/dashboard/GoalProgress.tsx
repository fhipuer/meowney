/**
 * 목표 자산 진행률 컴포넌트 냥~ 🐱
 */
import { useQuery } from '@tanstack/react-query'
import { Target, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { dashboardApi } from '@/lib/api'
import { formatKRW } from '@/lib/utils'
import type { GoalProgressResponse } from '@/types'

export function GoalProgress() {
  const { data: progress, isLoading } = useQuery<GoalProgressResponse>({
    queryKey: ['goalProgress'],
    queryFn: () => dashboardApi.getGoalProgress(),
    staleTime: 5 * 60 * 1000,
  })

  // 목표가 설정되지 않은 경우 표시하지 않음
  if (isLoading || !progress || progress.target_value <= 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          목표 자산
          {progress.is_achieved && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Progress
            value={Math.min(progress.progress_percentage, 100)}
            className="h-2"
          />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatKRW(progress.current_value)}
            </span>
            <span className="font-medium">
              {progress.progress_percentage.toFixed(1)}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            목표: {formatKRW(progress.target_value)}
          </div>
          {progress.is_achieved ? (
            <p className="text-xs text-green-600">
              목표 달성!
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {formatKRW(progress.remaining_amount)} 남음
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
