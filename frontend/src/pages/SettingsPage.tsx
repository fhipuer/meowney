/**
 * 설정 페이지 냥~ 🐱
 */
import { useState, useRef } from 'react'
import { Moon, Sun, Cat, Eye, EyeOff, Download, Upload, FileJson, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useStore } from '@/store/useStore'
import { dataMigrationApi } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

export function SettingsPage() {
  const { isDarkMode, toggleDarkMode, isPrivacyMode, togglePrivacyMode } = useStore()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // 데이터 내보내기 냥~
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const data = await dataMigrationApi.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meowney-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setImportMessage({ type: 'success', text: '내보내기 성공이다냥~ 🎉' })
    } catch (error) {
      setImportMessage({ type: 'error', text: '내보내기 실패 냥~ 😿' })
    } finally {
      setIsExporting(false)
    }
  }

  // 데이터 가져오기 냥~
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportMessage(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // 스키마 버전 확인
      if (!data.schema_version) {
        throw new Error('유효하지 않은 파일 형식이다냥~')
      }

      const result = await dataMigrationApi.importData(data, 'replace')
      setImportMessage({
        type: 'success',
        text: `${result.message} (포트폴리오: ${result.stats.portfolios_created}, 자산: ${result.stats.assets_created}, 플랜: ${result.stats.plans_created})`
      })

      // 캐시 무효화
      queryClient.invalidateQueries()
    } catch (error) {
      const message = error instanceof Error ? error.message : '가져오기 실패 냥~ 😿'
      setImportMessage({ type: 'error', text: message })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

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

      {/* 프라이버시 설정 냥~ */}
      <Card>
        <CardHeader>
          <CardTitle>프라이버시</CardTitle>
          <CardDescription>
            금액 표시를 숨겨서 다른 사람에게 보여줄 때 사용하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPrivacyMode ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
              <Label>
                {isPrivacyMode ? '금액 숨김 중' : '금액 표시 중'}
              </Label>
            </div>
            <Button variant="outline" onClick={togglePrivacyMode}>
              {isPrivacyMode ? '금액 표시하기' : '금액 숨기기'}
            </Button>
          </div>
          {isPrivacyMode && (
            <p className="text-sm text-muted-foreground mt-3">
              🙈 모든 금액이 ●●●●● 로 표시됩니다. 비율과 차트는 유지됩니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 데이터 관리 냥~ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            데이터 관리
          </CardTitle>
          <CardDescription>
            자산 및 플랜 데이터를 내보내거나 가져올 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              데이터 내보내기
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex-1"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              데이터 가져오기
            </Button>
          </div>

          {importMessage && (
            <p className={`text-sm ${importMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {importMessage.text}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            💾 JSON 형식으로 포트폴리오, 자산, 리밸런싱 플랜 데이터를 백업하고 복원할 수 있습니다.
            가져오기 시 기존 데이터는 삭제됩니다.
          </p>
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
