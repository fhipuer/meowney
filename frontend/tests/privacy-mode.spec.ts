import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('meowney-storage', JSON.stringify({
      state: { isSidebarOpen: false, isPrivacyMode: true },
      version: 0,
    }))
  })
})

test('privacy mode hides the dashboard trend axis amounts', async ({ page }) => {
  await page.goto('/')

  const chart = page.getByTestId('asset-trend-chart')
  await expect(chart).toBeVisible()
  await expect(chart).toContainText('***,***')
  await expect(chart.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value')).toHaveCount(0)
})

test('privacy mode masks all monetary rebalance results', async ({ page }) => {
  await page.goto('/rebalance')
  await page.getByRole('button', { name: '리밸런싱 계산', exact: true }).click()

  const result = page.getByTestId('rebalance-result')
  await expect(result).toBeVisible()
  await expect(result).toContainText('***,***')

  const text = await result.innerText()
  expect(text).not.toMatch(/₩\s*[\d]/)
})
