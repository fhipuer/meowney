/**
 * 리밸런싱 플랜 관리 페이지
 */
import { useState } from 'react'
import { Plus, Star, Trash2, Edit2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  usePlans,
  useCreatePlan,
  useDeletePlan,
  useSetMainPlan,
} from '@/hooks/useRebalance'
import { AllocationEditor } from '@/components/rebalance/AllocationEditor'
import { TickerSparkline } from '@/components/rebalance/TickerSparkline'
import type { RebalancePlan } from '@/types'

export function RebalancePlanPage() {
  const { data: plans, isLoading } = usePlans()
  const createPlanMutation = useCreatePlan()
  const deletePlanMutation = useDeletePlan()
  const setMainPlanMutation = useSetMainPlan()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<RebalancePlan | null>(null)
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanDescription, setNewPlanDescription] = useState('')
  const [newPlanStrategyPrompt, setNewPlanStrategyPrompt] = useState('')
  const [newPlanIsMain, setNewPlanIsMain] = useState(false)

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) return

    await createPlanMutation.mutateAsync({
      name: newPlanName.trim(),
      description: newPlanDescription.trim() || undefined,
      strategy_prompt: newPlanStrategyPrompt.trim() || undefined,
      is_main: newPlanIsMain,
    })

    setNewPlanName('')
    setNewPlanDescription('')
    setNewPlanStrategyPrompt('')
    setNewPlanIsMain(false)
    setIsCreateOpen(false)
  }

  const handleDeletePlan = async (planId: string) => {
    if (confirm('이 플랜을 삭제하시겠습니까?')) {
      await deletePlanMutation.mutateAsync(planId)
    }
  }

  const handleSetMain = async (planId: string) => {
    await setMainPlanMutation.mutateAsync(planId)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">플랜 설정</h1>
          <p className="text-muted-foreground">
            리밸런싱 플랜을 관리합니다.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">플랜 설정</h1>
          <p className="text-muted-foreground">
            리밸런싱 플랜을 생성하고 목표 배분을 설정합니다.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              새 플랜
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 플랜 생성</DialogTitle>
              <DialogDescription>
                리밸런싱 목표를 설정할 새 플랜을 생성합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="planName">플랜 이름</Label>
                <Input
                  id="planName"
                  placeholder="예: 공격형 포트폴리오"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planDescription">설명 (선택)</Label>
                <Textarea
                  id="planDescription"
                  placeholder="플랜에 대한 설명을 입력하세요."
                  value={newPlanDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewPlanDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planStrategyPrompt">전략 프롬프트 (선택)</Label>
                <Textarea
                  id="planStrategyPrompt"
                  placeholder="예: 장기 성장 중심, 분기별 리밸런싱, 기술주 비중 확대 시 보수적 접근..."
                  value={newPlanStrategyPrompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewPlanStrategyPrompt(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  투자 전략이나 리밸런싱 기준을 기록합니다. AI 분석 시 참고됩니다.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isMain">메인 플랜으로 설정</Label>
                <Switch
                  id="isMain"
                  checked={newPlanIsMain}
                  onCheckedChange={setNewPlanIsMain}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                취소
              </Button>
              <Button
                onClick={handleCreatePlan}
                disabled={!newPlanName.trim() || createPlanMutation.isPending}
              >
                {createPlanMutation.isPending ? '생성 중...' : '생성'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 플랜 목록 */}
      {(!plans || plans.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              아직 생성된 플랜이 없습니다.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              첫 번째 플랜 만들기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={plan.is_main ? 'border-primary' : ''}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {plan.is_main && (
                      <Star className="h-4 w-4 text-primary fill-primary" />
                    )}
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingPlan(plan)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePlan(plan.id)}
                      disabled={deletePlanMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {plan.description && (
                  <CardDescription>{plan.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {plan.allocations?.length || 0}개 자산 목표 설정됨
                  </div>
                  {/* 주요 자산 Sparklines */}
                  {plan.allocations && plan.allocations.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {plan.allocations
                        .filter((alloc) => alloc.ticker)
                        .slice(0, 3)
                        .map((alloc) => (
                          <div
                            key={alloc.id}
                            className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1"
                          >
                            <span className="text-muted-foreground">{alloc.ticker}</span>
                            <TickerSparkline
                              ticker={alloc.ticker}
                              days={14}
                              showChangeRate={false}
                              width={40}
                              height={16}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                  {!plan.is_main && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleSetMain(plan.id)}
                      disabled={setMainPlanMutation.isPending}
                    >
                      <Star className="mr-2 h-3 w-3" />
                      메인 플랜으로 설정
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 배분 편집기 다이얼로그 */}
      {editingPlan && (
        <AllocationEditor
          plan={editingPlan}
          open={!!editingPlan}
          onOpenChange={(open) => !open && setEditingPlan(null)}
        />
      )}
    </div>
  )
}
