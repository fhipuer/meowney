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
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      <main
        className={cn(
          'min-h-[calc(100vh-3.5rem)] transition-all duration-300 ease-in-out',
          isSidebarOpen ? 'md:ml-64' : 'ml-0'
        )}
      >
        <div className="container py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
