/**
 * Meowney App 메인 컴포넌트 냥~ 🐱
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Layout } from '@/components/layout/Layout'
import { DashboardPage } from '@/pages/DashboardPage'
import { AssetsPage } from '@/pages/AssetsPage'
import { RebalancePage } from '@/pages/RebalancePage'
import { RebalancePlanPage } from '@/pages/RebalancePlanPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { RegimePage } from '@/pages/RegimePage'

// React Query 클라이언트 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/rebalance" element={<RebalancePage />} />
            <Route path="/rebalance/plans" element={<RebalancePlanPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/regime" element={<RegimePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
