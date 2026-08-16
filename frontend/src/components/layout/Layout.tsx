/**
 * 메인 레이아웃 컴포넌트 냥~ 🐱
 */
import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
        <div className="container max-w-[1280px] px-4 py-7 sm:px-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
