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
    expect(help("us30y")).toContain("장기 듀레이션 경보");
    expect(help("tips30y")).toContain("중복 합산하지 않습니다");
  });

  it("shows level, shock, long-end stress and curve as separate model layers", () => {
    const data = {
      macro_quadrant: {
        financial_conditions: {
          rates: {
            score: 53.4,
            label: "제한적",
            driver: "현재 제약 수준",
            coverage: 1,
            version: "2026-08-rates-v4",
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
          duration_stress: {
            score: 35,
            bounded_shock_floor: 35,
            label: "장기 듀레이션 부담 경계",
            recent_label: "장기 듀레이션 부담 경계",
            level_label: "장기채 부담 높음",
            driver: "30Y 실질금리 주도",
            nominal_10y: 4.72,
            nominal_30y: 5.31,
            real_30y: 3.06,
            spread_30y10y: 0.59,
            change_20d: null,
            change_63d: null,
            confirmation_count_5d: 5,
            recent_confirmation_count_3d: 3,
            as_of_date: "2026-08-18",
            confirmed: true,
            persistent: false,
            role: "bounded_confirmation",
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

    expect(html).toContain("1 · 현재 금리 부담");
    expect(html).toContain("2 · 최근 추가 금리 충격");
    expect(html).toContain("3 · 30년물 현재 부담과 최근 충격");
    expect(html).toContain("장기채 부담 높음");
    expect(html).toContain("4 · 수익률곡선의 침체 선행 신호");
    expect(html).toContain("30년 실질금리 상승이 주도");
    expect(html).toContain("단기금리가 수요를 약하게 억제");
    expect(html).toContain("투자·차입에 뚜렷한 부담");
    expect(html).toContain("17.6%");
    expect(html).toContain("10Y-3M은 주축");
  });
});
