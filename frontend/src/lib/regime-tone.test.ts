import { describe, expect, it } from "vitest";

import {
  aiCapexDeltaTone,
  aiCapexTone,
  availabilityTone,
  dataQualityTone,
  financialConditionTone,
  memoryPriceTone,
  memorySupplierPriceDeltaTone,
  regimeLevelTone,
  signalStatusTone,
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
    expect(aiCapexTone("감속 관찰")).toBe("negative");
    expect(aiCapexTone("혼조")).toBe("caution");
    expect(memoryPriceTone("가격 상승")).toBe("positive");
    expect(memoryPriceTone("관측가격 하락")).toBe("negative");
    expect(memoryPriceTone("가격 유지")).toBe("neutral");
  });

  it("keeps availability separate from investment direction", () => {
    expect(availabilityTone("연결")).toBe("info");
    expect(availabilityTone("제한")).toBe("caution");
    expect(availabilityTone("미연결")).toBe("neutral");
    expect(dataQualityTone("충분")).toBe("info");
  });

  it("maps financial restriction by its economic meaning", () => {
    expect(financialConditionTone("완화적")).toBe("positive");
    expect(financialConditionTone("다소 제한적")).toBe("caution");
    expect(financialConditionTone("매우 제한적")).toBe("negative");
  });

  it("only colors deltas inside explicitly supportive contexts", () => {
    expect(aiCapexDeltaTone(25)).toBe("positive");
    expect(aiCapexDeltaTone(-5)).toBe("negative");
    expect(aiCapexDeltaTone(25, false)).toBe("neutral");
    expect(memorySupplierPriceDeltaTone(2.7)).toBe("positive");
    expect(memorySupplierPriceDeltaTone(-1.2)).toBe("negative");
  });
});
