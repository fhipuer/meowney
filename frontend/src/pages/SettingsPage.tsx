/**
 * 설정 페이지 냥~ 🐱
 */
import { useState, useRef, useEffect } from 'react'
import { Moon, Sun, Cat, Eye, EyeOff, Download, Upload, FileJson, Loader2, Plus, Trash2, History, Calendar, Scale } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useStore } from '@/store/useStore'
import { dataMigrationApi } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useManualHistory, useCreateManualHistory, useDeleteAssetHistory } from '@/hooks/useDashboard'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { formatKRW, formatDate } from '@/lib/utils'
import type { ManualHistoryEntry } from '@/types'

export function SettingsPage() {
  const { isDarkMode, toggleDarkMode, isPrivacyMode, togglePrivacyMode } = useStore()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // 과거 데이터 관리 상태 냥~
  const { data: manualHistory, isLoading: historyLoading } = useManualHistory()
  const createManualHistory = useCreateManualHistory()
  const deleteAssetHistory = useDeleteAssetHistory()
  const [newEntries, setNewEntries] = useState<ManualHistoryEntry[]>([
    { snapshot_date: '', total_value: 0, total_principal: 0 }
  ])
  const [historyMessage, setHistoryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 리밸런싱 설정 상태 냥~
  const { data: settings, isLoading: settingsLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const [alertThreshold, setAlertThreshold] = useState(5.0)
  const [calculatorTolerance, setCalculatorTolerance] = useState(5.0)
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // 설정값이 로드되면 상태 업데이트 냥~
  useEffect(() => {
    if (settings) {
      setAlertThreshold(settings.alert_threshold)
      setCalculatorTolerance(settings.calculator_tolerance)
      setHasChanges(false)
    }
  }, [settings])

  // 설정 저장 냥~
  const handleSaveSettings = async () => {
    try {
      await updateSettings.mutateAsync({
        alert_threshold: alertThreshold,
        calculator_tolerance: calculatorTolerance,
      })
      setSettingsMessage({ type: 'success', text: '설정이 저장됐다냥~ 🎉' })
      setHasChanges(false)
    } catch {
      setSettingsMessage({ type: 'error', text: '저장 실패 냥~ 😿' })
    }
  }

  // 설정 변경 감지 냥~
  const handleAlertThresholdChange = (value: number[]) => {
    setAlertThreshold(value[0])
    setHasChanges(true)
    setSettingsMessage(null)
  }

  const handleCalculatorToleranceChange = (value: number[]) => {
    setCalculatorTolerance(value[0])
    setHasChanges(true)
    setSettingsMessage(null)
  }

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

  // 과거 데이터 입력 행 추가 냥~
  const addEntryRow = () => {
    setNewEntries([...newEntries, { snapshot_date: '', total_value: 0, total_principal: 0 }])
  }

  // 과거 데이터 입력 행 삭제 냥~
  const removeEntryRow = (index: number) => {
    if (newEntries.length > 1) {
      setNewEntries(newEntries.filter((_, i) => i !== index))
    }
  }

  // 과거 데이터 입력 값 변경 냥~
  const updateEntry = (index: number, field: keyof ManualHistoryEntry, value: string | number) => {
    const updated = [...newEntries]
    if (field === 'snapshot_date') {
      updated[index][field] = value as string
    } else {
      updated[index][field] = Number(value) || 0
    }
    setNewEntries(updated)
  }

  // 과거 데이터 저장 냥~
  const handleSaveHistory = async () => {
    // 유효성 검사
    const validEntries = newEntries.filter(
      (e) => e.snapshot_date && e.total_value > 0
    )

    if (validEntries.length === 0) {
      setHistoryMessage({ type: 'error', text: '유효한 데이터를 입력해주세요 냥~ 🙀' })
      return
    }

    try {
      await createManualHistory.mutateAsync({ entries: validEntries })
      setHistoryMessage({ type: 'success', text: `${validEntries.length}개의 데이터가 저장됐다냥~ 🎉` })
      setNewEntries([{ snapshot_date: '', total_value: 0, total_principal: 0 }])
    } catch {
      setHistoryMessage({ type: 'error', text: '저장 실패 냥~ 😿' })
    }
  }

  // 과거 데이터 삭제 냥~
  const handleDeleteHistory = async (historyId: string) => {
    if (!confirm('정말 삭제할까냥? 🙀')) return

    try {
      await deleteAssetHistory.mutateAsync(historyId)
      setHistoryMessage({ type: 'success', text: '삭제 완료다냥~ 🎉' })
    } catch {
      setHistoryMessage({ type: 'error', text: '삭제 실패 냥~ 😿' })
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
              🙈 모든 금액이 ***,*** 로 표시됩니다. 비율과 차트는 유지됩니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 리밸런싱 설정 냥~ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            리밸런싱 설정
          </CardTitle>
          <CardDescription>
            리밸런싱 알림 기준과 계산기 기본값을 설정하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              설정을 불러오는 중 냥~...
            </div>
          ) : (
            <>
              {/* 알림 기준 설정 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>대시보드 알림 기준</Label>
                  <span className="text-sm font-medium text-primary">
                    ±{alertThreshold.toFixed(1)}%
                  </span>
                </div>
                <Slider
                  value={[alertThreshold]}
                  onValueChange={handleAlertThresholdChange}
                  min={0}
                  max={20}
                  step={0.5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  목표 비율과 현재 비율의 차이가 이 값을 초과하면 대시보드에 리밸런싱 알림이 표시됩니다.
                </p>
              </div>

              <Separator />

              {/* 계산기 기본값 설정 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>리밸런싱 계산기 기본값</Label>
                  <span className="text-sm font-medium text-primary">
                    ±{calculatorTolerance.toFixed(1)}%
                  </span>
                </div>
                <Slider
                  value={[calculatorTolerance]}
                  onValueChange={handleCalculatorToleranceChange}
                  min={0}
                  max={20}
                  step={0.5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  리밸런싱 페이지에서 허용 오차 슬라이더의 초기값으로 사용됩니다.
                </p>
              </div>

              {/* 저장 버튼 */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveSettings}
                  disabled={!hasChanges || updateSettings.isPending}
                >
                  {updateSettings.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  설정 저장
                </Button>
                {settingsMessage && (
                  <p className={`text-sm ${settingsMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {settingsMessage.text}
                  </p>
                )}
              </div>
            </>
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

      {/* 과거 데이터 관리 (v0.6.0) 냥~ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            과거 데이터 관리
          </CardTitle>
          <CardDescription>
            서비스 사용 이전의 자산 추이 데이터를 수동으로 입력할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 새 데이터 입력 폼 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">새 데이터 추가</h4>
              <Button variant="ghost" size="sm" onClick={addEntryRow}>
                <Plus className="h-4 w-4 mr-1" />
                행 추가
              </Button>
            </div>

            <div className="space-y-3">
              {newEntries.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">날짜</Label>
                      <Input
                        type="date"
                        value={entry.snapshot_date}
                        onChange={(e) => updateEntry(index, 'snapshot_date', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">총자산 (원)</Label>
                      <Input
                        type="number"
                        value={entry.total_value || ''}
                        onChange={(e) => updateEntry(index, 'total_value', e.target.value)}
                        placeholder="50000000"
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">투자원금 (원)</Label>
                      <Input
                        type="number"
                        value={entry.total_principal || ''}
                        onChange={(e) => updateEntry(index, 'total_principal', e.target.value)}
                        placeholder="45000000"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntryRow(index)}
                    disabled={newEntries.length === 1}
                    className="mt-5"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSaveHistory}
              disabled={createManualHistory.isPending}
              className="w-full sm:w-auto"
            >
              {createManualHistory.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              데이터 저장
            </Button>

            {historyMessage && (
              <p className={`text-sm ${historyMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {historyMessage.text}
              </p>
            )}
          </div>

          <Separator />

          {/* 기존 데이터 목록 */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">저장된 히스토리 (최근 20개)</h4>

            {historyLoading ? (
              <div className="text-sm text-muted-foreground">로딩 중 냥~...</div>
            ) : manualHistory && manualHistory.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {manualHistory.slice(0, 20).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{formatDate(item.snapshot_date)}</span>
                      <span className="text-muted-foreground">
                        총자산: {formatKRW(item.total_value)}
                      </span>
                      <span className="text-muted-foreground">
                        원금: {formatKRW(item.total_principal)}
                      </span>
                      {item.is_manual && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          수동 입력
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteHistory(item.id)}
                      disabled={deleteAssetHistory.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                저장된 히스토리가 없다냥~ 🐱
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            📝 수동으로 입력한 데이터는 자산 추이 차트에 반영됩니다.
            기존 날짜에 데이터가 있으면 덮어씁니다.
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
              <p className="text-sm text-muted-foreground">버전 {APP_VERSION}</p>
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
