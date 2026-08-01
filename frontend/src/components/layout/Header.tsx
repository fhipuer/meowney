/**
 * 헤더 컴포넌트 냥~ 🐱
 */
import { Menu, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store/useStore'

export function Header() {
  const { toggleSidebar, isDarkMode, toggleDarkMode } = useStore()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-white/90 backdrop-blur-xl dark:bg-background/90">
      <div className="flex h-16 items-center px-5 md:px-7">
        {/* 사이드바 토글 */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">메뉴 토글</span>
        </Button>

        {/* 로고 */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#171a20] text-[13px] font-medium text-white dark:bg-white dark:text-[#171a20]">M</div>
          <span className="font-medium text-[17px] tracking-[-0.01em] hidden sm:inline-block">
            Meowney
          </span>
        </div>

        {/* 스페이서 */}
        <div className="flex-1" />

        {/* 우측 메뉴 */}
        <div className="flex items-center gap-2">
          {/* 다크모드 토글 */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded bg-[#f4f4f4] dark:bg-muted"
            onClick={toggleDarkMode}
            title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            <span className="sr-only">테마 토글</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
