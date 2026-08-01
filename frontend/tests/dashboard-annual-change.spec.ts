import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })

test('연간 자산증감 패널에 시작 자산과 현재 자산을 표시한다', async ({ page }) => {
  await page.goto('/')

  const panel = page.getByText('연간 자산증감', { exact: true })
    .locator('xpath=ancestor::div[contains(@class, "overflow-hidden")]')
  await expect(page.getByText('시작 자산', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('현재 자산', { exact: true })).toBeVisible()
  await expect(page.getByText('연간 자산증감률', { exact: true })).toBeVisible()
  await expect(panel).toBeVisible()

  await panel.screenshot({ path: 'test-results/dashboard-annual-change.png' })
})
