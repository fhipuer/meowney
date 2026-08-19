import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const capture = process.env.VISUAL_CAPTURE === '1'

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function expectNoElementOverflow(locator: Locator) {
  const count = await locator.count()
  for (let index = 0; index < count; index += 1) {
    const fits = await locator.nth(index).evaluate((element) =>
      element.scrollWidth <= element.clientWidth + 1,
    )
    expect(fits).toBe(true)
  }
}

test('regime current and indicator drill-down remain readable', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/regime')
  await expect(page.getByRole('heading', { name: '투자 레짐' })).toBeVisible()
  await expect(page.getByText('v1.13.0', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '상세점검용 데이터' })).toHaveCount(0)
  await expect(page.getByText('미국 거시경제 현재 수준과 최근 방향')).toBeVisible()
  await expect(page.getByText('DRAM·HBM 병목', { exact: true })).toBeVisible()
  const dramStage = page.locator('[data-thesis-stage="dram"]')
  await expect(dramStage).toHaveAttribute('aria-expanded', 'false')
  await expect(
    dramStage.getByText('DRAM 공급 부족 압력 지속', { exact: true }),
  ).toBeVisible()
  await dramStage.click()
  await expect(dramStage).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('DRAM 수급 핵심축')).toBeVisible()
  await expect(page.getByText('HBM·서버 DRAM 간접계측', { exact: true })).toBeVisible()
  await expect(page.getByText('수출 수요 강세·서버 가격 확인 대기', { exact: true })).toBeVisible()
  await expect(page.getByText('수익률곡선 선행위험', { exact: true })).toBeVisible()
  const hbmEvidence = page.locator('[data-thesis-evidence="hbm"]')
  await expect(hbmEvidence.getByText('서버 RDIMM', { exact: true })).toBeVisible()
  await dramStage.click()
  await expect(dramStage).toHaveAttribute('aria-expanded', 'false')
  const confirmationStage = page.locator('[data-thesis-stage="confirmation"]')
  await confirmationStage.click()
  await expect(page.getByText('DRAM 수출 구조', { exact: true })).toBeVisible()
  await expect(page.getByText('국내 2사 실적 확인', { exact: true })).toBeVisible()
  await expect(page.getByText('완제품 재고 반등·수준은 아직 낮음', { exact: true })).toBeVisible()
  await confirmationStage.click()
  expect((await page.getByTestId('ai-thesis-monitor').boundingBox())?.height).toBeLessThanOrEqual(650)
  await expectNoElementOverflow(page.locator('[data-thesis-stage]'))
  await expectNoElementOverflow(page.locator('[data-financial-card]'))
  await page.getByRole('button', { name: '정책 긴축 설명' }).hover()
  await expect(page.getByText(/0~1%p는 약한 억제/)).toBeVisible()
  await page.mouse.move(0, 0)
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1130-current-desktop.png', fullPage: true })
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
    await page.screenshot({ path: '../.local-run/regime-v1130-growth-desktop.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '금리', exact: true }).click()
  await expect(page.getByText('금리 환경 판단')).toBeVisible()
  await expect(page.getByText('1 · 현재 금리 부담')).toBeVisible()
  await expect(page.getByText('2 · 최근 추가 금리 충격')).toBeVisible()
  await expect(page.getByText('3 · 30년물 장기채 부담')).toBeVisible()
  await expect(page.getByText('4 · 수익률곡선의 침체 선행 신호')).toBeVisible()
  await expect(page.getByText('단기금리가 수요를 약하게 억제').first()).toBeVisible()
  await expect(page.getByText('투자·차입에 뚜렷한 부담').first()).toBeVisible()
  await expect(page.getByText('수익률곡선 최근 1년')).toBeVisible()
  await expect(page.getByText('미국 10년 금리의 수준 구성')).toBeVisible()
  await expect(page.getByText('미국 장기금리 10Y·30Y')).toBeVisible()
  await expect(page.getByText('정책금리와 단기금리')).toBeVisible()
  await expect(page.getByText('실질금리와 기대인플레이션')).toBeVisible()
  await expect(page.getByText('미국 국채 3M (SGOV 프록시)')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1130-rates-desktop.png', fullPage: true })
    await page.getByText('금리 환경 판단').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1130-rates-viewport.png' })
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
    await page.screenshot({ path: '../.local-run/regime-v1130-semiconductor-desktop.png', fullPage: true })
    await page.getByText('국내 2사 실적 확인 · 보조축').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1130-company-viewport.png' })
  }

  const historyTab = page.getByRole('tab', { name: '기록', exact: true })
  await historyTab.click()
  await expect(historyTab).toHaveAttribute('aria-selected', 'true')
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1130-history-desktop.png', fullPage: true })
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
  expect((await page.getByTestId('ai-thesis-monitor').boundingBox())?.height).toBeLessThanOrEqual(960)
  await expectNoElementOverflow(page.locator('[data-thesis-stage]'))
  await expectNoElementOverflow(page.locator('[data-financial-card]'))
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1130-current-mobile.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '지표', exact: true }).click()
  await page.getByRole('tab', { name: '금리', exact: true }).click()
  await expect(page.getByText('금리 환경 판단')).toBeVisible()
  await expect(page.getByText('수익률곡선 최근 1년')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.getByText('금리 환경 판단').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1130-rates-mobile.png' })
  }

  await page.getByRole('tab', { name: '메모리·반도체', exact: true }).click()
  await expect(page.getByText('HBM·서버 DRAM 간접계측', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('DRAM 관세 신고 기준 수출 구조 프록시')).toBeVisible()
  await expect(page.getByText('재고자산 YoY · 절대액').first()).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1130-semiconductor-mobile.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '기록', exact: true }).click()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1130-history-mobile.png', fullPage: true })
  }
})

test('portfolio review document is exposed from plans only', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })

  await page.goto('/regime')
  await expect(page.getByRole('button', { name: '상세점검용 데이터' })).toHaveCount(0)

  await page.goto('/rebalance/plans')
  await expect(page.getByRole('heading', { name: '플랜 설정' })).toBeVisible()
  const decisionButtons = page.getByRole('button', { name: 'AI 포트폴리오 점검 문서' })
  await expect(decisionButtons.first()).toBeVisible({ timeout: 10_000 })
  expect(await decisionButtons.count()).toBeGreaterThan(0)
  await decisionButtons.first().scrollIntoViewIfNeeded()
  await expectNoPageOverflow(page)

  if (capture) {
    await page.screenshot({ path: '../.local-run/plan-v1130-decision-document.png', fullPage: true })
    await page.screenshot({ path: '../.local-run/plan-v1130-decision-document-viewport.png' })
  }
})
