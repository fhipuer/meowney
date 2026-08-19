import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RegimeCurrent } from "@/types";
import { MacroQuadrant } from "./MacroQuadrant";

const quadrant = {
  as_of_date: "2026-08-08",
  environment_label: "성장 확장·물가 압력",
  environment_point: {
    growth: 13.5,
    inflation: 36.1,
    quadrant: "firm_growth_elevated_inflation",
    label: "성장 확장·물가 압력",
    semantics: "absolute_macro_level",
  },
  pressure_vector: {
    dx: -11.3,
    dy: -16.1,
    direction: "성장 둔화·물가 완화",
    strength: "보통",
    strength_score: 0.14,
    data_quality_score: 95,
    semantics: "relative_recent_pressure",
    is_displacement: false,
    trajectory_available: false,
  },
  growth_level: {
    score: 13.5,
    label: "완만한 확장",
    coverage: 1,
    contributors: [],
  },
  inflation_level: {
    score: 36.1,
    label: "높음",
    coverage: 1,
    contributors: [],
  },
  recession_confirmation: {
    status: "leading_only",
    label: "노동·실물·신용 3축의 악화 확인 없음 · 수익률곡선 선행 경고 관찰",
    as_of_date: "2026-08-08",
    coincident_risk_count: 0,
    methodology: "수익률곡선 선행위험과 노동·실질활동·신용 동행근거 교차확인",
    channels: [
      { id: "yield_curve", name: "수익률곡선", status: "watch", state: "선행위험 경계" },
      { id: "labor", name: "노동", status: "clear", state: "현재 노동시장 악화 근거 없음" },
      { id: "real_activity", name: "실질활동", status: "clear", state: "현재 실물경제 악화 근거 없음" },
      { id: "credit", name: "신용", status: "clear", state: "현재 신용여건 악화 근거 없음" },
    ],
  },
} as unknown as RegimeCurrent["macro_quadrant"];

describe("MacroQuadrant semantics", () => {
  it("renders absolute state separately from recent pressure", () => {
    const html = renderToStaticMarkup(<MacroQuadrant data={quadrant} />);

    expect(html).toContain('aria-label="거시경제 상태 차트 읽는 법"');
    expect(html).toContain("경기는 확장 중 · 물가 압력");
    expect(html).toContain("성장 둔화와 물가 둔화가 함께 나타남");
    expect(html).toContain("현재 수준");
    expect(html).toContain("최근 압력");
    expect(html).toContain("노동·실물·신용 3축의 악화 확인 없음 · 수익률곡선 선행 경고 관찰");
    expect(html).toContain("현재 경기악화 확인");
    expect(html).toContain("현재 악화 영역 0/3");
    expect(html).not.toContain("침체 확인 기준");
    expect(html).not.toContain("화살표는 실제 이동 경로나 전망치가 아닙니다");
    expect(html).not.toContain("디스인플레이션·침체 위험");
  });
});
