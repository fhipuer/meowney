import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RegimeCurrent, RegimeSignal } from "@/types";
import { RateModelOverview, signalRuleHelp } from "./RegimePage";

describe("rate regime presentation", () => {
  it("explains the distinct decision roles of rate indicators", () => {
    const help = (id: string) => signalRuleHelp({ id } as RegimeSignal);
    expect(help("curve10y3m")).toContain("핵심 침체 선행축");
    expect(help("curve10y3m")).toContain("21관측일 평균");
    expect(help("curve2s10s")).toContain("확인축");
    expect(help("curve2s10s")).toContain("중복 합산하지 않습니다");
    expect(help("term_premium")).toContain("자동 점수에 더하지 않습니다");
    expect(help("tips10y")).toContain("절대수준");
  });

  it("shows level, shock and curve as separate model layers", () => {
    const data = {
      macro_quadrant: {
        financial_conditions: {
          rates: {
            score: 53.4,
            label: "제한적",
            driver: "현재 제약 수준",
            coverage: 1,
            version: "2026-08-rates-v2",
          },
          policy: {
            label: "다소 제한적",
            real_policy_rate: 0.34,
          },
          long_rates: {
            label: "제한적",
            real_10y: 2.39,
          },
          recent_shock: {
            label: "변화 제한적",
            persistent: false,
            change_20d: {
              changes: { us10y: 0.06, tips10y: 0.04, bei10y: 0.03 },
            },
          },
          yield_curve: {
            label: "선행위험 낮음",
            state: "정상 우상향",
            recession_probability_12m: 17.6,
            monthly_average_10y3m: 0.63,
            steepening: { state: "단기금리 하락 주도" },
          },
        },
      },
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(
      <RateModelOverview data={data} signals={[]} />,
    );

    expect(html).toContain("1 · 현재 제약 수준");
    expect(html).toContain("2 · 최근 금리 충격");
    expect(html).toContain("3 · 침체 선행위험");
    expect(html).toContain("17.6%");
    expect(html).toContain("10Y-3M은 주축");
  });
});
