/**
 * 설정 페이지 냥~ 🐱
 */
import { Moon, Sun, Cat } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useStore } from '@/store/useStore'

export function SettingsPage() {
  const { isDarkMode, toggleDarkMode } = useStore()

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">설정</h1>
        <p className="text-muted-foreground">
          앱 설정을 관리하세요 냥~ 🐱
        </p>
      </div>

      {/* 테마 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>테마</CardTitle>
          <CardDescription>
            화면 테마를 설정하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isDarkMode ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              <Label>
                {isDarkMode ? '다크 모드' : '라이트 모드'}
              </Label>
            </div>
            <Button variant="outline" onClick={toggleDarkMode}>
              {isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 앱 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>앱 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Cat className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Meowney</h3>
              <p className="text-muted-foreground">냥이 집사의 자산 관리</p>
              <p className="text-sm text-muted-foreground">버전 1.0.0</p>
            </div>
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              🐱 Meowney는 개인 자산 포트폴리오를 관리하고,
              일별 자산 추이를 추적하며, 리밸런싱을 도와주는 서비스입니다.
            </p>
            <p>
              🐾 냥이와 함께 즐거운 투자 생활 되세요!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
