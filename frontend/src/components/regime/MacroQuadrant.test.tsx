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
} as unknown as RegimeCurrent["macro_quadrant"];

describe("MacroQuadrant semantics", () => {
  it("renders absolute state separately from recent pressure", () => {
    const html = renderToStaticMarkup(<MacroQuadrant data={quadrant} />);

    expect(html).toContain("점은 현재 절대수준");
    expect(html).toContain("성장 확장·물가 압력");
    expect(html).toContain("성장 둔화·물가 완화");
    expect(html).toContain("실제 이동 경로나 전망치가 아닙니다");
    expect(html).not.toContain("디스인플레이션·침체 위험");
  });
});
