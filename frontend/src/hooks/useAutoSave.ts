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

export function useAutoSave<T>({
  key,
  data,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  expirationMs = DEFAULT_EXPIRATION_MS,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasRecoveryData, setHasRecoveryData] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dataRef = useRef(data)

  // 데이터 레퍼런스 업데이트
  dataRef.current = data

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

  // 디바운스 저장
  useEffect(() => {
    if (!enabled) return

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
  }, [data, debounceMs, enabled, saveToStorage])

  // 초기 복구 데이터 확인
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed: AutoSaveData<T> = JSON.parse(stored)

        // 버전 체크
        if (parsed.version !== STORAGE_VERSION) {
          localStorage.removeItem(key)
          setHasRecoveryData(false)
          return
        }

        // 만료 체크
        if (Date.now() - parsed.savedAt > expirationMs) {
          localStorage.removeItem(key)
          setHasRecoveryData(false)
          return
        }

        setHasRecoveryData(true)
        setLastSaved(new Date(parsed.savedAt))
      }
    } catch {
      setHasRecoveryData(false)
    }
  }, [key, expirationMs])

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

  // 복구 데이터 삭제
  const clearRecovery = useCallback(() => {
    try {
      localStorage.removeItem(key)
      setHasRecoveryData(false)
      setLastSaved(null)
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
