import { expect, test } from '@playwright/test'

test.describe('Calm Wealth Workspace', () => {
  test('desktop navigation and dashboard hierarchy are visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const consoleErrors: string[] = []
    page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()))
    await page.goto('/')

    await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible()
    await expect(page.getByRole('link', { name: '자산', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '자산배분이란?' })).toHaveCount(0)
    await expect(page.getByText('총 자산', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('시장 현황', { exact: true })).toBeVisible({ timeout: 30_000 })
    const summaryCards = page.getByTestId('summary-card-content')
    await expect(summaryCards).toHaveCount(4, { timeout: 30_000 })
    for (const card of await summaryCards.all()) {
      const hasOverflow = await card.evaluate((element) =>
        element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight
      )
      expect(hasOverflow, 'summary card content must not be clipped').toBe(false)
    }
    expect(consoleErrors).toEqual([])
  })

  test('mobile layout uses bottom navigation without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await expect(page.getByRole('navigation', { name: '모바일 주요 메뉴' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '주요 메뉴', exact: true })).toBeHidden()
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
  })

  test('asset management provides dense table and an accessible editor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/assets')

    await expect(page.getByRole('heading', { name: '보유 자산' })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('table')).toBeVisible()
    await expect(page.getByText('평가 금액', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '자산 추가' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '자산 추가' })).toBeVisible()
    await expect(dialog.getByLabel('자산명 *')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '추가하기' })).toBeVisible()
  })

  test('mobile asset rows remain within the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: '보유 자산' })).toBeVisible({ timeout: 30_000 })
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
  })

  test('remaining product pages do not overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const route of ['/rebalance', '/rebalance/plans', '/settings']) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
      expect(dimensions.scrollWidth, `${route} has horizontal overflow`).toBeLessThanOrEqual(dimensions.width)
    }
  })
})
