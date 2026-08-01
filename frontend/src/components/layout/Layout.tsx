/**
 * 메인 레이아웃 컴포넌트 냥~ 🐱
 */
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export function Layout() {
  const { isSidebarOpen } = useStore()

  return (
    <div className="min-h-screen bg-[#f7f7f7] dark:bg-background">
      <Header />
      <Sidebar />
      <main
        className={cn(
          'min-h-[calc(100vh-4rem)] transition-all duration-[330ms] ease-in-out',
          isSidebarOpen ? 'md:ml-60' : 'ml-0'
        )}
      >
        <div className="container max-w-[1360px] px-5 py-8 md:px-10 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
