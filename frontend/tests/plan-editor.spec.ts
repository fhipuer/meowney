import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 1365, height: 900 },
})

test('플랜 편집 전략 프롬프트가 충분한 높이로 표시된다', async ({ page }) => {
  await page.goto('/rebalance/plans')
  await expect(page.getByRole('heading', { name: '플랜 설정' })).toBeVisible()

  const planCard = page.locator('[class*="rounded"][class*="border"]').filter({
    has: page.locator('button'),
  }).filter({
    hasText: '목표 설정됨',
  }).first()
  await planCard.locator('button').first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/^플랜 편집:/)).toBeVisible()

  const strategyPrompt = dialog.locator('#editPlanStrategy')
  await expect(strategyPrompt).toBeVisible()
  const box = await strategyPrompt.boundingBox()

  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(280)
  await dialog.screenshot({ path: 'test-results/plan-editor.png' })
})
