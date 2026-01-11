/**
 * 사이드바 컴포넌트 냥~ 🐱
 */
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  Calculator,
  Settings,
  Cat,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  {
    title: '대시보드',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: '자산 목록',
    href: '/assets',
    icon: Wallet,
  },
  {
    title: '리밸런싱',
    href: '/rebalance',
    icon: Calculator,
  },
  {
    title: '설정',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const { isSidebarOpen } = useStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 border-r bg-background transition-transform duration-300 ease-in-out md:translate-x-0',
        !isSidebarOpen && '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col gap-2 p-4">
        {/* 네비게이션 */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          ))}
        </nav>

        {/* 하단 정보 */}
        <div className="mt-auto">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm">
              <Cat className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Meowney v1.0</p>
                <p className="text-xs text-muted-foreground">
                  냥이와 함께하는 자산관리
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
