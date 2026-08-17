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
  await expect(page.getByText('v1.11.2', { exact: true })).toBeVisible()
  await expect(page.getByText('미국 거시경제 현재 수준과 최근 방향')).toBeVisible()
  await expect(page.getByText('DRAM·HBM 병목', { exact: true })).toBeVisible()
  const dramStage = page.locator('[data-thesis-stage="dram"]')
  await expect(dramStage).toHaveAttribute('aria-expanded', 'false')
  await expect(
    dramStage.getByText('타이트 신호', { exact: true }),
  ).toBeVisible()
  await dramStage.click()
  await expect(dramStage).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('DRAM 수급 핵심축')).toBeVisible()
  await expect(page.getByText('HBM·서버 DRAM 간접계측', { exact: true })).toBeVisible()
  await expect(page.getByText('타이트 지속 신호', { exact: true })).toBeVisible()
  await expect(page.getByText('수익률곡선 선행위험', { exact: true })).toBeVisible()
  const hbmEvidence = page.locator('[data-thesis-evidence="hbm"]')
  await expect(hbmEvidence.getByText('서버 RDIMM', { exact: true })).toBeVisible()
  await dramStage.click()
  await expect(dramStage).toHaveAttribute('aria-expanded', 'false')
  const confirmationStage = page.locator('[data-thesis-stage="confirmation"]')
  await confirmationStage.click()
  await expect(page.getByText('DRAM 수출 구조', { exact: true })).toBeVisible()
  await expect(page.getByText('국내 2사 실적 확인', { exact: true })).toBeVisible()
  await expect(page.getByText('재고 반등 관찰', { exact: true })).toBeVisible()
  await confirmationStage.click()
  expect((await page.getByTestId('ai-thesis-monitor').boundingBox())?.height).toBeLessThanOrEqual(650)
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1111-current-desktop.png', fullPage: true })
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
    await page.screenshot({ path: '../.local-run/regime-v1111-growth-desktop.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '금리', exact: true }).click()
  await expect(page.getByText('금리 레짐 계산')).toBeVisible()
  await expect(page.getByText('1 · 현재 제약 수준')).toBeVisible()
  await expect(page.getByText('2 · 최근 금리 충격')).toBeVisible()
  await expect(page.getByText('3 · 침체 선행위험')).toBeVisible()
  await expect(page.getByText('수익률곡선 최근 1년')).toBeVisible()
  await expect(page.getByText('미국 10년 금리의 수준 구성')).toBeVisible()
  await expect(page.getByText('미국 국채 3M (SGOV 프록시)')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1111-rates-desktop.png', fullPage: true })
    await page.getByText('금리 레짐 계산').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1111-rates-viewport.png' })
  }

  await page.getByRole('tab', { name: '메모리·반도체', exact: true }).click()
  await expect(page.getByRole('heading', { name: '반도체·메모리 수요·공급' })).toBeVisible()
  await expect(page.getByText('DRAM 수급 핵심축', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('HBM·서버 DRAM 간접계측', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('DRAM 관세 신고 기준 수출 구조 프록시')).toBeVisible()
  await expect(page.getByText('공급사 분기매출 대비 재고 · 회사별 추세')).toBeVisible()
  await expect(page.getByText('국내 2사 실적 확인 · 보조축')).toBeVisible()
  await expect(page.getByText('재고자산 YoY · 절대액').first()).toBeVisible()
  await expect(page.getByText('공급사 CAPEX 맥락 · 현재 판정 미사용')).toBeVisible()
  await expect(page.getByText('한국 반도체 완제품 생산·출하·재고')).toBeVisible()
  await expect(page.locator('[data-metric-label="재고자산 YoY · 절대액"]').first()).toHaveAttribute('data-semantic-tone', 'neutral')
  await expect(page.locator('[data-metric-label^="공급사 CAPEX YoY"]').first()).toHaveAttribute('data-semantic-tone', 'neutral')
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1111-semiconductor-desktop.png', fullPage: true })
    await page.getByText('국내 2사 실적 확인 · 보조축').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1111-company-viewport.png' })
  }

  expect(runtimeErrors).toEqual([])
})

test('regime current view has no global overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/regime')
  await expect(page.getByRole('heading', { name: '투자 레짐' })).toBeVisible()
  await expect(page.getByText('미국 거시경제 현재 수준과 최근 방향')).toBeVisible()
  await expect(page.locator('[data-thesis-stage]')).toHaveCount(4)
  await expect(page.locator('[data-thesis-stage="dram"]')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#ai-thesis-dram-panel')).toBeHidden()
  expect((await page.getByTestId('ai-thesis-monitor').boundingBox())?.height).toBeLessThanOrEqual(900)
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1111-current-mobile.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '지표', exact: true }).click()
  await page.getByRole('tab', { name: '금리', exact: true }).click()
  await expect(page.getByText('금리 레짐 계산')).toBeVisible()
  await expect(page.getByText('수익률곡선 최근 1년')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.getByText('금리 레짐 계산').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1111-rates-mobile.png' })
  }

  await page.getByRole('tab', { name: '메모리·반도체', exact: true }).click()
  await expect(page.getByText('HBM·서버 DRAM 간접계측', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('DRAM 관세 신고 기준 수출 구조 프록시')).toBeVisible()
  await expect(page.getByText('재고자산 YoY · 절대액').first()).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1111-semiconductor-mobile.png', fullPage: true })
  }
})
