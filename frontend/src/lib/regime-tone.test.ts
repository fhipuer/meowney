import { describe, expect, it } from "vitest";

import {
  aiCapexDeltaTone,
  aiCapexTone,
  availabilityTone,
  dataQualityTone,
  financialConditionTone,
  memoryPriceTone,
  memorySupplierPriceDeltaTone,
  powerDemandTone,
  regimeLevelTone,
  signalMetricTone,
  signalStatusTone,
  thesisSignalTone,
} from "./regime-tone";

describe("regime semantic color context", () => {
  it("maps regime and signal states without relying on numeric signs", () => {
    expect(regimeLevelTone("유지")).toBe("positive");
    expect(regimeLevelTone("경계")).toBe("caution");
    expect(regimeLevelTone("약화")).toBe("negative");
    expect(signalStatusTone("강함")).toBe("positive");
    expect(signalStatusTone("약화")).toBe("negative");
    expect(signalStatusTone("강함", true)).toBe("neutral");
  });

  it("treats AI investment and supplier pricing as explicit thesis signals", () => {
    expect(aiCapexTone("확대 강함")).toBe("positive");
    expect(aiCapexTone("감속 관찰")).toBe("caution");
    expect(aiCapexTone("혼조")).toBe("caution");
    expect(memoryPriceTone("가격 상승")).toBe("positive");
    expect(memoryPriceTone("관측가격 하락")).toBe("negative");
    expect(memoryPriceTone("가격 유지")).toBe("neutral");
    expect(thesisSignalTone("타이트 신호")).toBe("positive");
    expect(thesisSignalTone("타이트 지속 신호")).toBe("positive");
    expect(thesisSignalTone("타이트 관찰")).toBe("caution");
    expect(thesisSignalTone("단가·믹스 주도 확장")).toBe("positive");
    expect(thesisSignalTone("재고 소화 강함")).toBe("positive");
    expect(thesisSignalTone("상대 재고부담 크게 완화")).toBe("positive");
    expect(thesisSignalTone("재고 반등 관찰")).toBe("caution");
    expect(thesisSignalTone("병목 완화 경계")).toBe("negative");
    expect(thesisSignalTone("재고 효율 악화")).toBe("negative");
    expect(thesisSignalTone("상대 재고부담 확대")).toBe("negative");
    expect(thesisSignalTone("경계")).toBe("caution");
    expect(thesisSignalTone("상업용 수요 우세")).toBe("caution");
  });

  it("keeps availability separate from investment direction", () => {
    expect(availabilityTone("연결")).toBe("info");
    expect(availabilityTone("제한")).toBe("caution");
    expect(availabilityTone("간접 관측")).toBe("info");
    expect(availabilityTone("부분 관측")).toBe("info");
    expect(availabilityTone("미연결")).toBe("neutral");
    expect(dataQualityTone("충분")).toBe("info");
  });

  it("maps financial restriction by its economic meaning", () => {
    expect(financialConditionTone("완화적")).toBe("positive");
    expect(financialConditionTone("다소 제한적")).toBe("caution");
    expect(financialConditionTone("매우 제한적")).toBe("negative");
    expect(financialConditionTone("완화 방향")).toBe("positive");
    expect(financialConditionTone("긴축 충격")).toBe("caution");
    expect(financialConditionTone("급격한 긴축 충격")).toBe("negative");
    expect(financialConditionTone("선행위험 낮음")).toBe("positive");
    expect(financialConditionTone("선행위험 경계")).toBe("caution");
    expect(financialConditionTone("선행위험 높음")).toBe("negative");
  });

  it("only colors deltas inside explicitly supportive contexts", () => {
    expect(aiCapexDeltaTone(25)).toBe("positive");
    expect(aiCapexDeltaTone(-5)).toBe("caution");
    expect(aiCapexDeltaTone(25, false)).toBe("neutral");
    expect(memorySupplierPriceDeltaTone(2.7)).toBe("positive");
    expect(memorySupplierPriceDeltaTone(-1.2)).toBe("caution");
    expect(memorySupplierPriceDeltaTone(-1.2, true, "direct", "가격 하락")).toBe("negative");
    expect(memorySupplierPriceDeltaTone(2.7, true, "spot", "가격 상승")).toBe("caution");
    expect(memorySupplierPriceDeltaTone(2.7, true, "context", "관측가격 상승")).toBe("neutral");
  });

  it("colors only monotonic decision metrics, not every signed value", () => {
    expect(signalMetricTone("us_indpro", "return", 1.2)).toBe("positive");
    expect(signalMetricTone("us_indpro", "return", -1.2)).toBe("negative");
    expect(signalMetricTone("us_unemployment", "delta", 0.2)).toBe("negative");
    expect(signalMetricTone("us_unemployment", "delta", -0.2)).toBe("positive");
    expect(signalMetricTone("hy_oas", "delta", 12)).toBe("negative");
    expect(signalMetricTone("core_pce", "rate", 3.2)).toBe("neutral");
    expect(signalMetricTone("us10y", "delta", -25)).toBe("neutral");
    expect(signalMetricTone("market_nasdaq", "return", 8)).toBe("neutral");
    expect(signalMetricTone("us_indpro", "return", 1.2, false)).toBe("neutral");
  });

  it("colors power values only after the combined demand rule resolves", () => {
    expect(powerDemandTone("수요 확장")).toBe("positive");
    expect(powerDemandTone("수요 둔화")).toBe("negative");
    expect(powerDemandTone("상업용 수요 우세")).toBe("caution");
    expect(powerDemandTone("완만한 변화")).toBe("neutral");
    expect(powerDemandTone("수요 확장", false)).toBe("neutral");
  });
});
