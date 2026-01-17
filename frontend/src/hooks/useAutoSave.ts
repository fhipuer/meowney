/**
 * 자동 저장 훅 냥~
 * localStorage에 편집 중인 데이터를 자동 저장하고 복구 기능 제공
 */
import { useEffect, useRef, useCallback, useState } from 'react'

interface AutoSaveData<T> {
  data: T
  savedAt: number
  version: number
}

interface UseAutoSaveOptions<T> {
  /** localStorage 키 */
  key: string
  /** 저장할 데이터 */
  data: T
  /** 초기 데이터 (원본과 비교하여 변경사항 있을 때만 복구 프롬프트 표시) */
  initialData?: T
  /** 디바운스 시간 (ms, 기본 1000) */
  debounceMs?: number
  /** 데이터 만료 시간 (ms, 기본 7일) */
  expirationMs?: number
  /** 자동 저장 활성화 여부 (기본 true) */
  enabled?: boolean
}

interface UseAutoSaveReturn<T> {
  /** 복구 가능한 데이터가 있는지 */
  hasRecoveryData: boolean
  /** 복구 데이터 가져오기 */
  recover: () => T | null
  /** 복구 데이터 삭제 */
  clearRecovery: () => void
  /** 마지막 저장 시간 */
  lastSaved: Date | null
  /** 수동 저장 트리거 */
  saveNow: () => void
}

const STORAGE_VERSION = 1
const DEFAULT_DEBOUNCE_MS = 1000
const DEFAULT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000 // 7일

// 두 객체가 동일한지 깊은 비교 (JSON 문자열 비교)
function isDataEqual<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function useAutoSave<T>({
  key,
  data,
  initialData,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  expirationMs = DEFAULT_EXPIRATION_MS,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasRecoveryData, setHasRecoveryData] = useState(false)
  // 복구 확인 완료 여부 - 완료 전에는 자동 저장 비활성화
  const [hasCheckedRecovery, setHasCheckedRecovery] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dataRef = useRef(data)
  const initialDataRef = useRef(initialData)
  // 무시 플래그 - clearRecovery 호출 시 세션 동안 복구 프롬프트 비활성화
  const dismissedRef = useRef(false)
  // 첫 데이터 변경 스킵 플래그 - 복구 후 첫 번째 저장 방지
  const isFirstChangeRef = useRef(true)

  // 데이터 레퍼런스 업데이트
  dataRef.current = data
  initialDataRef.current = initialData

  // 저장 로직
  const saveToStorage = useCallback(() => {
    if (!enabled) return

    try {
      const saveData: AutoSaveData<T> = {
        data: dataRef.current,
        savedAt: Date.now(),
        version: STORAGE_VERSION,
      }
      localStorage.setItem(key, JSON.stringify(saveData))
      setLastSaved(new Date())
    } catch (error) {
      console.error('자동 저장 실패 냥:', error)
    }
  }, [key, enabled])

  // 수동 저장
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    saveToStorage()
  }, [saveToStorage])

  // 디바운스 저장 - 복구 확인 완료 후에만 저장
  useEffect(() => {
    // 복구 확인 전이거나 비활성화 상태면 저장하지 않음
    if (!enabled || !hasCheckedRecovery) return

    // 첫 번째 변경은 스킵 (초기 데이터 로드)
    if (isFirstChangeRef.current) {
      isFirstChangeRef.current = false
      return
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      saveToStorage()
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, debounceMs, enabled, hasCheckedRecovery, saveToStorage])

  // 초기 복구 데이터 확인 - enabled가 true일 때만 실행
  useEffect(() => {
    if (!enabled) {
      // 비활성화되면 상태 초기화
      setHasCheckedRecovery(false)
      isFirstChangeRef.current = true
      return
    }

    // 무시 플래그가 설정되어 있으면 복구 프롬프트 표시 안함
    if (dismissedRef.current) {
      setHasRecoveryData(false)
      setHasCheckedRecovery(true)
      return
    }

    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed: AutoSaveData<T> = JSON.parse(stored)

        // 버전 체크
        if (parsed.version !== STORAGE_VERSION) {
          localStorage.removeItem(key)
          setHasRecoveryData(false)
          setHasCheckedRecovery(true)
          return
        }

        // 만료 체크
        if (Date.now() - parsed.savedAt > expirationMs) {
          localStorage.removeItem(key)
          setHasRecoveryData(false)
          setHasCheckedRecovery(true)
          return
        }

        // 초기 데이터와 비교 - 동일하면 복구할 필요 없음
        if (initialDataRef.current !== undefined) {
          if (isDataEqual(parsed.data, initialDataRef.current)) {
            // 저장된 데이터가 원본과 동일하면 복구 프롬프트 표시 안함
            setHasRecoveryData(false)
            setLastSaved(new Date(parsed.savedAt))
            setHasCheckedRecovery(true)
            return
          }
        }

        setHasRecoveryData(true)
        setLastSaved(new Date(parsed.savedAt))
      } else {
        setHasRecoveryData(false)
      }
    } catch {
      setHasRecoveryData(false)
    }
    setHasCheckedRecovery(true)
  }, [key, expirationMs, enabled])

  // 복구 함수
  const recover = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(key)
      if (!stored) return null

      const parsed: AutoSaveData<T> = JSON.parse(stored)

      // 버전/만료 체크
      if (parsed.version !== STORAGE_VERSION) return null
      if (Date.now() - parsed.savedAt > expirationMs) return null

      return parsed.data
    } catch {
      return null
    }
  }, [key, expirationMs])

  // 복구 데이터 삭제 (무시 버튼 클릭 시)
  const clearRecovery = useCallback(() => {
    try {
      localStorage.removeItem(key)
      setHasRecoveryData(false)
      setLastSaved(null)
      // 무시 플래그 설정 - 이 세션 동안은 복구 프롬프트 표시 안함
      dismissedRef.current = true
    } catch (error) {
      console.error('복구 데이터 삭제 실패 냥:', error)
    }
  }, [key])

  // 컴포넌트 언마운트 시 즉시 저장
  useEffect(() => {
    return () => {
      if (enabled && timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        saveToStorage()
      }
    }
  }, [enabled, saveToStorage])

  return {
    hasRecoveryData,
    recover,
    clearRecovery,
    lastSaved,
    saveNow,
  }
}

/**
 * 마지막 저장 시간을 사람이 읽기 쉬운 형식으로 변환
 */
export function formatLastSaved(date: Date | null): string {
  if (!date) return ''

  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 10) return '방금 전'
  if (seconds < 60) return `${seconds}초 전`
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`

  return date.toLocaleDateString('ko-KR')
}
