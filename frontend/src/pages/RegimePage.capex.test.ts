import { describe, expect, it } from "vitest";

import type { RegimeCurrent } from "@/types";
import { buildAiCapexChartData } from "./RegimePage";

type Company = RegimeCurrent["ai_capex"]["companies"][number];
type AggregatePoint = NonNullable<RegimeCurrent["ai_capex"]["aggregate"]>["history"][number];

const company = (
  id: string,
  observations: Array<[period: string, valueBillions: number]>,
): Company => ({
  id,
  name: id,
  latest_period: observations.at(-1)?.[0] || null,
  latest_capex: (observations.at(-1)?.[1] || 0) * 1e9,
  yoy: null,
  ttm: null,
  history: observations.map(([period, value]) => ({ period, value: value * 1e9 })),
  fetch_status: null,
});

const aggregate = (
  period: string,
  total: number | null,
  coverage: number,
): AggregatePoint => ({
  period,
  value: total == null ? null : total * 1e9,
  value_billion: total,
  coverage_count: coverage,
  expected_count: 4,
  complete: total != null,
  qoq: null,
  yoy: null,
  ttm: null,
  ttm_billion: null,
  ttm_yoy: null,
});

describe("AI CAPEX aggregate series", () => {
  it("uses the backend canonical aggregate instead of summing again", () => {
    const rows = buildAiCapexChartData([
      company("microsoft", [["2026-03-31", 30], ["2026-06-30", 40]]),
      company("alphabet", [["2026-03-31", 20], ["2026-06-30", 25]]),
      company("meta", [["2026-03-31", 10], ["2026-06-30", 15]]),
      company("amazon", [["2026-03-31", 40], ["2026-06-30", 50]]),
    ], [
      aggregate("2026-03-31", 100, 4),
      aggregate("2026-06-30", 130, 4),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({ period: "2026-03-31", coverage: 4, total: 100 }),
      expect.objectContaining({ period: "2026-06-30", coverage: 4, total: 130 }),
    ]);
  });

  it("preserves the backend gap for an incomplete reporting quarter", () => {
    const rows = buildAiCapexChartData([
      company("microsoft", [["2026-06-30", 40]]),
      company("alphabet", [["2026-06-30", 25]]),
      company("meta", [["2026-06-30", 15]]),
      company("amazon", []),
    ], [aggregate("2026-06-30", null, 3)]);

    expect(rows[0]).toEqual(expect.objectContaining({ coverage: 3, total: null }));
  });
});
