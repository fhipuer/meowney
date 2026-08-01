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
  BookOpen,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { APP_VERSION } from '@/lib/version'

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
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
        'fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-60 border-r border-border/70 bg-white transition-transform duration-[330ms] ease-in-out dark:bg-background md:translate-x-0',
        !isSidebarOpen && '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col gap-2 px-3 py-7">
        {/* 네비게이션 */}
        <p className="px-4 pb-2 text-[11px] font-medium text-muted-foreground">Portfolio</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/rebalance'}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-10 items-center gap-3 rounded px-4 py-2 text-sm font-medium transition-colors duration-[330ms]',
                  isActive
                    ? 'bg-[#eef2ff] text-[#2f55bd] dark:bg-primary/15 dark:text-blue-300'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {item.title}
            </NavLink>
          ))}
        </nav>

        {/* 하단 정보 */}
        <div className="mt-auto">
          <div className="rounded bg-[#f7f7f7] p-4 dark:bg-muted">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-xs font-medium text-[#171a20] dark:bg-background dark:text-foreground">M</div>
              <div>
                <p className="font-medium">Meowney</p>
                <p className="text-xs text-muted-foreground">
                  Version {APP_VERSION}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
