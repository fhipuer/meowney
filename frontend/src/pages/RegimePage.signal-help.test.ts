import { describe, expect, it } from "vitest";

import { signalRuleHelp } from "./RegimePage";
import type { RegimeSignal } from "@/types";

const signal = (id: string) => ({ id }) as RegimeSignal;

describe("regime indicator rule help", () => {
  it("describes the indicator-specific horizon and adverse direction", () => {
    expect(signalRuleHelp(signal("core_cpi"))).toContain("3개월 연율");
    expect(signalRuleHelp(signal("tips10y"))).toContain("높은 절대수준");
    expect(signalRuleHelp(signal("hy_oas"))).toContain("현재 절대수준");
    expect(signalRuleHelp(signal("us_gdp"))).toContain("12개월 변화율");
    expect(signalRuleHelp(signal("us_claims"))).toContain("최근 13주");
    expect(signalRuleHelp(signal("us_claims"))).toContain("전년 대비 52주");
    expect(signalRuleHelp(signal("us3m"))).toContain("SGOV ETF 자체");
  });

  it("does not treat every increase as the same direction", () => {
    expect(signalRuleHelp(signal("us_unemployment"))).toContain(
      "상승은 악화 방향",
    );
    expect(signalRuleHelp(signal("us_indpro"))).toContain("증가는 개선 방향");
  });
});
