import { NavLink } from 'react-router-dom'
import { Activity, BarChart3, Briefcase, Scale, Settings, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

const navigation = [
  { title: '대시보드', href: '/', icon: BarChart3 },
  { title: '자산', href: '/assets', icon: Briefcase },
  { title: '리밸런싱', href: '/rebalance', icon: Scale },
  { title: '플랜', href: '/rebalance/plans', icon: Target },
  { title: '레짐', href: '/regime', icon: Activity },
]

export function Header() {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center px-5 md:px-8">
          <NavLink to="/" className="flex items-center gap-3" aria-label="Meowney 홈">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-[13px] font-semibold text-primary">M</div>
            <span className="text-[17px] font-medium tracking-[-0.01em]">Meowney</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" aria-label={`버전 ${APP_VERSION}`}>
              v{APP_VERSION}
            </span>
          </NavLink>

          <nav className="ml-12 hidden h-full items-center gap-1 md:flex" aria-label="주요 메뉴">
            {navigation.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/' || item.href === '/rebalance'}
                className={({ isActive }) => cn(
                  'relative flex h-full items-center px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'text-foreground after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-primary'
                )}
              >
                {item.title}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <NavLink to="/settings" aria-label="설정"><Settings className="h-[18px] w-[18px]" /></NavLink>
            </Button>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="모바일 주요 메뉴">
        {navigation.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/' || item.href === '/rebalance'}
            className={({ isActive }) => cn('flex flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground', isActive && 'text-primary')}
          >
            <item.icon className="h-5 w-5" strokeWidth={1.7} />
            {item.title}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
