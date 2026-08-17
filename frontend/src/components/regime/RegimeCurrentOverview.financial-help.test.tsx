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
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(<FinancialTransmission data={data} />);

    expect(html).toContain('aria-label="정책 긴축 설명"');
    expect(html).toContain('aria-label="장기금리 전달 설명"');
    expect(html).toContain('aria-label="최근 금리 충격 설명"');
    expect(html).toContain('aria-label="수익률곡선 선행위험 설명"');
    expect(html).toContain('aria-label="신용·금융여건 설명"');
    expect(FINANCIAL_TRANSMISSION_HELP["정책 긴축"]).toContain("실질 정책금리");
    expect(FINANCIAL_TRANSMISSION_HELP["장기금리 전달"]).toContain("기간 프리미엄");
    expect(FINANCIAL_TRANSMISSION_HELP["최근 금리 충격"]).toContain("공통 관측일");
    expect(FINANCIAL_TRANSMISSION_HELP["수익률곡선 선행위험"]).toContain("10Y-3M");
    expect(FINANCIAL_TRANSMISSION_HELP["신용·금융여건"]).toContain("NFCI는 0이 장기 평균");
  });
});
