/**
 * Zustand 전역 스토어 냥~ 🐱
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  // 현재 선택된 포트폴리오 ID
  currentPortfolioId: string | null
  setCurrentPortfolioId: (id: string | null) => void

  // 사이드바 상태
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // 프라이버시 모드 (금액 숨김) 냥~
  isPrivacyMode: boolean
  togglePrivacyMode: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // 포트폴리오
      currentPortfolioId: null,
      setCurrentPortfolioId: (id) => set({ currentPortfolioId: id }),

      // 사이드바
      isSidebarOpen: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),

      // 프라이버시 모드 냥~
      isPrivacyMode: false,
      togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })),
    }),
    {
      name: 'meowney-storage', // localStorage 키
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        isPrivacyMode: state.isPrivacyMode,
      }),
    }
  )
)

