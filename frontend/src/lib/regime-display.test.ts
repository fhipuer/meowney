import { describe, expect, it } from "vitest";

import {
  aiCapexStateLabel,
  domainStateLabel,
  longRatePressureLabel,
  policyPressureLabel,
  plainLanguageStateText,
  powerDemandAxisLabel,
  powerStateLabel,
  powerSupplyAxisLabel,
  recentRateShockLabel,
  termPremiumLabel,
  yieldCurveStateLabel,
} from "./regime-display";

describe("regime display vocabulary", () => {
  it("explains the same rate vocabulary according to its economic role", () => {
    expect(policyPressureLabel("다소 제한적")).toBe("단기금리가 수요를 약하게 억제");
    expect(longRatePressureLabel("제한적")).toBe("투자·차입에 뚜렷한 부담");
    expect(recentRateShockLabel("변화 제한적")).toBe("최근 추가 금리 충격 거의 없음");
  });

  it("does not expose a bare neutral or strong label without domain context", () => {
    expect(domainStateLabel("inflation", "중립")).toBe("새 물가 경보 없음");
    expect(domainStateLabel("rates", "둔화")).toBe("금리 부담 높음");
    expect(domainStateLabel("liquidity", "강함")).toBe("자금조달 여건 양호");
  });

  it("turns model shorthand into an actionable observation sentence", () => {
    expect(aiCapexStateLabel("확대 강함")).toBe("주요 기업 설비투자 빠르게 확대");
    expect(powerStateLabel("완만한 변화")).toBe("전력 수요는 증가하나 가속 신호 약함");
    expect(yieldCurveStateLabel("역전 후 관찰")).toBe("과거 금리 역전의 영향 관찰 중");
  });

  it("keeps an unknown future value visible instead of hiding it", () => {
    expect(powerStateLabel("새 분류")).toBe("새 분류");
  });

  it("explains the separate power demand, supply, and composite states", () => {
    expect(powerStateLabel("수요 확대·공급 확충")).toBe("수요 증가와 설비 확충 동행");
    expect(powerDemandAxisLabel("광범위한 수요 가속")).toBe("여러 지역에서 수요 가속");
    expect(powerSupplyAxisLabel("공급 대응 제한")).toBe("예정된 순설비 확충이 제한적");
  });

  it("explains missing comparison data instead of showing a bare judgment failure", () => {
    expect(termPremiumLabel("판정 불가")).toBe("기간 프리미엄 자료 부족");
    expect(recentRateShockLabel(null)).toBe("자료가 부족해 판단할 수 없음");
  });

  it("rephrases legacy rule text that can still arrive from stored observations", () => {
    expect(plainLanguageStateText("중립 규칙")).toBe("설정된 위험 기준에 해당하지 않음");
    expect(plainLanguageStateText("현재 2.39% · 제한적 실질금리"))
      .toBe("현재 2.39% · 높은 실질금리 부담");
  });
});
