import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const capture = process.env.VISUAL_CAPTURE === '1'

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

test('regime current and indicator drill-down remain readable', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/regime')
  await expect(page.getByRole('heading', { name: '투자 레짐' })).toBeVisible()
  await expect(page.getByText('미국 거시경제 현재 수준과 최근 방향')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/verify-v160-current-desktop.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '지표', exact: true }).click()
  await page.getByRole('tab', { name: '성장·고용', exact: true }).click()
  await expect(page.getByRole('heading', { name: '성장·고용' })).toBeVisible()
  await expect(page.getByText(/초도 발표일|초기 발표값/)).toHaveCount(0)
  const firstChart = page.locator('details').filter({ hasText: '판정에 사용한 차트' }).first()
  await firstChart.locator('summary').click()
  await expect(firstChart.locator('svg').first()).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/verify-v160-growth-desktop.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '금리', exact: true }).click()
  await expect(page.getByText('미국 10년 금리의 수준 구성')).toBeVisible()
  await expect(page.getByText('미국 국채 3M (SGOV 프록시)')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/verify-v160-rates-desktop.png', fullPage: true })
  }

  await page.getByRole('tab', { name: 'AI CAPEX·메모리', exact: true }).click()
  await expect(page.getByText('기업별 분기 총 현금 CAPEX')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/verify-v160-ai-desktop.png', fullPage: true })
  }

  expect(runtimeErrors).toEqual([])
})

test('regime current view has no global overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/regime')
  await expect(page.getByRole('heading', { name: '투자 레짐' })).toBeVisible()
  await expect(page.getByText('미국 거시경제 현재 수준과 최근 방향')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/verify-v160-current-mobile.png', fullPage: true })
  }
})
