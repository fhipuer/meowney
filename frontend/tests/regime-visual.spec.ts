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
  await expect(page.getByText('v1.17.0', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '상세점검용 데이터' })).toHaveCount(0)
  await expect(page.getByText(/events: partial/)).toHaveCount(0)
  await expect(page.getByText('미국 거시 판단', { exact: true })).toBeVisible()
  await expect(page.getByText('자동 매매 아님', { exact: true })).toHaveCount(0)
  await expect(page.getByText('미국 거시경제 현재 수준과 최근 방향')).toBeVisible()
  await expect(page.getByText('현재 경기악화 확인', { exact: true })).toBeVisible()
  const auxiliaryData = page.locator('details').filter({ hasText: '판정 미사용 참고자료' })
  await expect(auxiliaryData).not.toHaveAttribute('open', '')
  await expect(page.getByText('광의 DRAM 수급', { exact: true })).toBeVisible()
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
    await page.screenshot({ path: '../.local-run/regime-v1170-current-desktop.png', fullPage: true })
  }

  const powerStage = page.locator('[data-thesis-stage="power"]')
  await powerStage.click()
  await expect(page.getByText('후속 전력 인프라 근거', { exact: true })).toBeVisible()
  await expect(page.locator('[data-power-axis]')).toHaveCount(5)
  await expectNoElementOverflow(page.locator('[data-power-axis-content]'))
  await expectNoPageOverflow(page)
  if (capture) {
    await page.getByText('후속 전력 인프라 근거', { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1170-current-power-viewport.png' })
    await page.screenshot({ path: '../.local-run/regime-v1170-current-power-expanded.png', fullPage: true })
  }
  await powerStage.click()

  await page.getByRole('tab', { name: '지표', exact: true }).click()
  await page.getByRole('tab', { name: 'AI 투자', exact: true }).click()
  await expect(page.getByRole('heading', { name: '하이퍼스케일러 설비투자 프록시', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '4사 합산 CAPEX', exact: true })).toBeVisible()
  await expect(page.getByText('직전 분기 대비', { exact: true })).toBeVisible()
  await expect(page.getByText('전년 동기 대비', { exact: true })).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-ai-capex-desktop.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '시장', exact: true }).click()
  await expect(page.getByRole('heading', { name: '시장 환경', exact: true })).toBeVisible()
  await expect(page.getByText('COMEX 금 선물', { exact: true })).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-market-desktop.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '성장·고용', exact: true }).click()
  await expect(page.getByRole('heading', { name: '성장·고용' })).toBeVisible()
  await expect(page.getByText(/초도 발표일|초기 발표값/)).toHaveCount(0)
  const firstChart = page.locator('details').filter({ hasText: '판정에 사용한 차트' }).first()
  await firstChart.locator('summary').click()
  await expect(firstChart.locator('svg').first()).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-growth-desktop.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '금리', exact: true }).click()
  await expect(page.getByText('금리 환경 판단')).toBeVisible()
  await expect(page.getByText('1 · 현재 금리 부담')).toBeVisible()
  await expect(page.getByText('2 · 최근 추가 금리 충격')).toBeVisible()
  await expect(page.getByText('3 · 30년물 현재 부담과 최근 충격')).toBeVisible()
  await expect(page.getByText('4 · 수익률곡선의 침체 선행 신호')).toBeVisible()
  await expect(page.getByText('단기금리가 수요를 약하게 억제').first()).toBeVisible()
  await expect(page.getByText('투자·차입에 뚜렷한 부담').first()).toBeVisible()
  await expect(page.getByText('수익률곡선 최근 1년')).toBeVisible()
  await expect(page.getByText('미국 10년 금리의 수준 구성')).toBeVisible()
  await expect(page.getByText('미국 장기금리 10Y·30Y')).toBeVisible()
  await expect(page.getByText('정책금리와 단기금리')).toBeVisible()
  await expect(page.getByText('실질금리와 기대인플레이션')).toBeVisible()
  await expect(page.getByText('미국 3개월 국채금리')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-rates-desktop.png', fullPage: true })
    await page.getByText('금리 환경 판단').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1150-rates-viewport.png' })
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
  await expect(page.getByText(/관측 [23]회 · 추세 판단 유보/).first()).toBeVisible()
  await expect(page.getByText('수집 이후 가격 방향 비교')).toHaveCount(0)
  await expect(page.locator('[data-metric-label="재고자산 YoY · 절대액"]').first()).toHaveAttribute('data-semantic-tone', 'neutral')
  await expect(page.locator('[data-metric-label^="공급사 CAPEX YoY"]').first()).toHaveAttribute('data-semantic-tone', 'neutral')
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-semiconductor-desktop.png', fullPage: true })
    await page.getByText('국내 2사 실적 확인 · 보조축').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1150-company-viewport.png' })
  }

  await page.getByRole('tab', { name: '전력 인프라', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'AI 전력 인프라 전달경로', exact: true })).toBeVisible()
  await expect(page.getByText('1단계 · 실제 수요', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('2단계 · 운영 프록시', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('3단계 · 공사단계 설비', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('4단계 · 공급측 대기열', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('5단계 · 회계상 투자', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('최근 전력수요 방향', { exact: true })).toBeVisible()
  await expect(page.getByText('지역별 수요 확산', { exact: true })).toBeVisible()
  await expect(page.getByText('24개월 발전·저장 공사단계 설비', { exact: true })).toBeVisible()
  await expect(page.getByText('발전·저장 프로젝트 계통 접속 대기열', { exact: true })).toBeVisible()
  await expect(page.getByText('미국 전력사업자 송전설비 증가액', { exact: true })).toBeVisible()
  await expect(page.getByText(/예비율이나 송전 병목을 직접 측정한 값은 아닙니다/)).toBeVisible()
  await expect(page.locator('[data-power-flow-axis]')).toHaveCount(5)
  await expectNoPageOverflow(page)
  if (capture) {
    await page.getByRole('heading', { name: 'AI 전력 인프라 전달경로', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1170-power-top-viewport.png' })
    await page.screenshot({ path: '../.local-run/regime-v1170-power-desktop.png', fullPage: true })
    await page.getByText('최근 전력수요 방향', { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1170-power-viewport.png' })
  }

  const historyTab = page.getByRole('tab', { name: '기록', exact: true })
  await historyTab.click()
  await expect(historyTab).toHaveAttribute('aria-selected', 'true')
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-history-desktop.png', fullPage: true })
  }

  expect(runtimeErrors).toEqual([])
})

test('regime current view has no global overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/regime')
  await expect(page.getByRole('heading', { name: '투자 레짐' })).toBeVisible()
  await expect(page.getByText('미국 거시경제 현재 수준과 최근 방향')).toBeVisible()
  await expect(page.locator('[data-thesis-stage]')).toHaveCount(4)
  const stageBoxes = await page.locator('[data-thesis-stage]').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width }
    }),
  )
  expect(new Set(stageBoxes.map((box) => Math.round(box.x))).size).toBe(1)
  expect(stageBoxes.every((box) => box.width > 300)).toBe(true)
  await expect(page.locator('[data-thesis-stage="dram"]')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#ai-thesis-dram-panel')).toBeHidden()
  expect((await page.getByTestId('ai-thesis-monitor').boundingBox())?.height).toBeLessThanOrEqual(1250)
  await expectNoElementOverflow(page.locator('[data-thesis-stage]'))
  await expectNoElementOverflow(page.locator('[data-financial-card]'))
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1170-current-mobile.png', fullPage: true })
  }

  const mobilePowerStage = page.locator('[data-thesis-stage="power"]')
  await mobilePowerStage.click()
  await expect(page.locator('[data-power-axis]')).toHaveCount(5)
  await expectNoElementOverflow(page.locator('[data-power-axis-content]'))
  await expectNoPageOverflow(page)
  if (capture) {
    await page.getByText('후속 전력 인프라 근거', { exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1170-current-power-mobile-viewport.png' })
    await page.screenshot({ path: '../.local-run/regime-v1170-current-power-mobile.png', fullPage: true })
  }
  await mobilePowerStage.click()

  await page.getByRole('tab', { name: '지표', exact: true }).click()
  await page.getByRole('tab', { name: 'AI 투자', exact: true }).click()
  await expect(page.getByRole('heading', { name: '4사 합산 CAPEX', exact: true })).toBeVisible()
  await expect(page.getByText('직전 분기 대비', { exact: true })).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-ai-capex-mobile.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '금리', exact: true }).click()
  await expect(page.getByText('금리 환경 판단')).toBeVisible()
  await expect(page.getByText('수익률곡선 최근 1년')).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.getByText('금리 환경 판단').scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1150-rates-mobile.png' })
  }

  await page.getByRole('tab', { name: '메모리·반도체', exact: true }).click()
  await expect(page.getByText('HBM·서버 DRAM 간접계측', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('DRAM 관세 신고 기준 수출 구조 프록시')).toBeVisible()
  await expect(page.getByText('재고자산 YoY · 절대액').first()).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-semiconductor-mobile.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '전력 인프라', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'AI 전력 인프라 전달경로', exact: true })).toBeVisible()
  await expect(page.getByText('1단계 · 실제 수요', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('24개월 발전·저장 공사단계 설비', { exact: true })).toBeVisible()
  await expect(page.getByText('발전·저장 프로젝트 계통 접속 대기열', { exact: true })).toBeVisible()
  await expect(page.getByText('미국 전력사업자 송전설비 증가액', { exact: true })).toBeVisible()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.getByRole('heading', { name: 'AI 전력 인프라 전달경로', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '../.local-run/regime-v1170-power-mobile-top-viewport.png' })
    await page.screenshot({ path: '../.local-run/regime-v1170-power-mobile.png', fullPage: true })
  }

  await page.getByRole('tab', { name: '기록', exact: true }).click()
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-history-mobile.png', fullPage: true })
  }
})

test('regime current summary remains balanced on tablet', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/regime')
  await expect(page.getByRole('heading', { name: '투자 레짐' })).toBeVisible()
  const panels = page.locator('[data-current-summary]')
  await expect(panels).toHaveCount(3)
  const boxes = await panels.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { y: box.y, width: box.width, height: box.height }
    }),
  )
  expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1)
  expect(Math.max(...boxes.map((box) => box.height)) - Math.min(...boxes.map((box) => box.height))).toBeLessThanOrEqual(2)
  expect(boxes.every((box) => box.width > 260)).toBe(true)
  await expectNoElementOverflow(panels)
  await expectNoElementOverflow(page.locator('[data-thesis-stage]'))
  await expectNoPageOverflow(page)
  if (capture) {
    await page.screenshot({ path: '../.local-run/regime-v1150-current-tablet.png', fullPage: true })
  }
})

test('help icons open a readable dialog on touch devices', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  await page.goto('/regime')
  const help = page.getByRole('button', { name: '거시경제 상태 차트 읽는 법' })
  const box = await help.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(40)
  expect(box?.height).toBeGreaterThanOrEqual(40)
  await help.tap()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: '거시경제 상태 차트 읽는 법' })).toBeVisible()
  await expect(page.getByText(/화살표는 최근 관측치로 계산한 상대 방향/)).toBeVisible()
  await context.close()
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
    await page.screenshot({ path: '../.local-run/plan-v1150-decision-document.png', fullPage: true })
    await page.screenshot({ path: '../.local-run/plan-v1150-decision-document-viewport.png' })
  }
})
