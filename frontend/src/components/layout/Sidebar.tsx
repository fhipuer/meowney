/**
 * 사이드바 컴포넌트 냥~ 🐱
 */
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  Calculator,
  Target,
  Settings,
  Cat,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { APP_VERSION } from '@/lib/version'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  {
    title: '자산배분이란?',
    href: '/guide',
    icon: BookOpen,
  },
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
    title: '플랜 설정',
    href: '/rebalance/plans',
    icon: Target,
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
              end={item.href === '/rebalance'}
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
                <p className="font-medium">Meowney v{APP_VERSION}</p>
                <p className="text-xs text-muted-foreground">
                  스마트한 집사의 투자 비서
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
