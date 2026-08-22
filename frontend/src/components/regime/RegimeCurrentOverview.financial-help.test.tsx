import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RegimeCurrent } from "@/types";
import {
  FINANCIAL_TRANSMISSION_HELP,
  FinancialTransmission,
} from "./RegimeCurrentOverview";

describe("FinancialTransmission help", () => {
  it("provides an accessible explanation for every transmission channel", () => {
    const data = {
      macro_quadrant: {
        financial_conditions: {
          policy: {
            label: "다소 제한적",
            fed_funds: 3.63,
            core_pce_yoy: 3.29,
            real_policy_rate: 0.34,
          },
          long_rates: {
            label: "제한적",
            nominal_10y: 4.63,
            real_10y: 2.39,
            breakeven_10y: 2.27,
            term_premium: 0.83,
            term_premium_label: "높은 편",
            term_premium_percentile: 82,
          },
          recent_shock: {
            label: "변화 제한적",
            direction: "안정",
            persistent: false,
            change_20d: {
              changes: { us10y: 0.06, tips10y: 0.04, bei10y: 0.03 },
            },
          },
          duration_stress: {
            label: "장기 구간 추가 충격 없음",
            recent_label: "장기 구간 추가 충격 없음",
            level_label: "장기채 부담 높음",
            driver: "장기금리 혼합",
            nominal_30y: 5.28,
            real_30y: 3.03,
            spread_30y10y: 0.57,
            as_of_date: "2026-08-18",
            confirmation_count_5d: 3,
            recent_confirmation_count_3d: 0,
            change_20d: {
              start_date: "2026-07-21",
              end_date: "2026-08-18",
              changes: { us10y: 0.08, us30y: 0.15, tips10y: 0.04, tips30y: 0.12 },
            },
          },
          yield_curve: {
            label: "선행위험 낮음",
            state: "정상 우상향",
            monthly_average_10y3m: 0.62,
            recession_probability_12m: 17.7,
            confirmation: "비역전",
            steepening: { state: "변화 제한적" },
          },
          credit: {
            label: "완화적",
            hy_oas: 2.71,
            ig_oas: 0.79,
            nfci: -0.55,
          },
        },
      },
      triggers: [],
      coverage: {
        domains: {
          rates: { status: "충분", coverage: 1 },
          liquidity: { status: "충분", coverage: 1 },
        },
      },
      rate_decomposition: {
        driver: "혼합",
        nominal_change: 0.06,
      },
      energy_shock: {
        state: "가격·변동성 경계",
        tone: "caution",
        as_of_date: "2026-08-18",
        components: {
          wti: { value: 86.48, change_20d: 2.5 },
          ovx: { value: 49.6 },
          inventory: { change_4w: 4.2, physical_tightening: false },
        },
      },
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(<FinancialTransmission data={data} />);

    expect(html).toContain('aria-label="정책 긴축 설명"');
    expect(html).toContain('aria-label="장기금리 전달 설명"');
    expect(html).toContain('aria-label="최근 금리 충격 설명"');
    expect(html).toContain('aria-label="30년물 현재 부담·추가 충격 설명"');
    expect(html).toContain('aria-label="수익률곡선 선행위험 설명"');
    expect(html).toContain('aria-label="신용·금융여건 설명"');
    expect(html).toContain('aria-label="에너지 가격·공급충격 설명"');
    expect(html).toContain("거시 전달경로");
    expect(html).toContain("공급 부족 확인 안 됨");
    expect(html).toContain("단기금리가 수요를 약하게 억제");
    expect(html).toContain("투자·차입에 뚜렷한 부담");
    expect(html).toContain("최근 추가 금리 충격 거의 없음");
    expect(html).toContain("장기채 부담 높음");
    expect(html).toContain("기준 2026-07-21→2026-08-18");
    expect(html).toContain("회사채·금융 자금조달 여건 양호");
    expect(FINANCIAL_TRANSMISSION_HELP["정책 긴축"]).toContain("실질 정책금리");
    expect(FINANCIAL_TRANSMISSION_HELP["장기금리 전달"]).toContain("기간 프리미엄");
    expect(FINANCIAL_TRANSMISSION_HELP["최근 금리 충격"]).toContain("공통 관측일");
    expect(FINANCIAL_TRANSMISSION_HELP["30년물 현재 부담·추가 충격"]).toContain("최근 3회 중 2회");
    expect(FINANCIAL_TRANSMISSION_HELP["수익률곡선 선행위험"]).toContain("10Y-3M");
    expect(FINANCIAL_TRANSMISSION_HELP["신용·금융여건"]).toContain("NFCI는 0이 장기 평균");
    expect(FINANCIAL_TRANSMISSION_HELP["에너지 가격·공급충격"]).toContain("공급충격");
  });
});
