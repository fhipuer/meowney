/**
 * 헤더 컴포넌트 냥~ 🐱
 */
import { Menu, Moon, Sun, Cat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store/useStore'

export function Header() {
  const { toggleSidebar, isDarkMode, toggleDarkMode } = useStore()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
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
        <div className="flex items-center gap-2">
          <Cat className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg hidden sm:inline-block">
            Meowney
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline-block">
            냥이 자산관리
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
