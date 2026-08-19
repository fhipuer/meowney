import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RegimeCurrent } from "@/types";
import {
  MemoryCyclePanel,
  memoryHistoryMode,
  splitMemoryPriceSeries,
} from "./RegimePage";

const series = (
  series_id: string,
  market_type: "spot" | "nand_wafer_spot",
  product_name: string,
  values: number[],
) => ({
  series_id,
  market_type,
  product_name,
  observation_date: `2026-08-${String(values.length + 2).padStart(2, "0")}`,
  period_label: "Session",
  price_high: null,
  price_low: null,
  price_average: values.at(-1) || 0,
  change_percent: values.length > 1 ? 1 : null,
  currency: "USD",
  price_basis: "Average",
  is_stale: false,
  history: values.map((value, index) => ({
    observation_date: `2026-08-${String(index + 3).padStart(2, "0")}`,
    price_average: value,
    change_percent: null,
  })),
});

describe("memory price history presentation", () => {
  it("keeps DRAM and NAND in separate semantic groups", () => {
    const dram = series("dram_spot", "spot", "DDR5 Spot", [100, 101]);
    const nand = series("nand_spot", "nand_wafer_spot", "256Gb TLC", [10, 12]);

    const grouped = splitMemoryPriceSeries([nand, dram]);

    expect(grouped.dram.map((item) => item.series_id)).toEqual(["dram_spot"]);
    expect(grouped.nand.map((item) => item.series_id)).toEqual(["nand_spot"]);
  });

  it("defers a trend judgment until four observations exist", () => {
    expect(memoryHistoryMode(series("one", "spot", "One", [100]))).toBe("waiting");
    expect(memoryHistoryMode(series("two", "spot", "Two", [100, 101]))).toBe("sparse");
    expect(memoryHistoryMode(series("four", "spot", "Four", [100, 101, 102, 103]))).toBe("trend");
  });

  it("renders sparse products as dated changes instead of a normalized multi-series line", () => {
    const data = {
      state: "가격 상승",
      reason: "DRAM 가격이 상승했습니다.",
      nand_state: "관측가격 상승",
      nand_reason: "NAND 가격이 상승했습니다.",
      source: "TrendForce",
      source_url: "https://example.com/dram",
      nand_source_url: "https://example.com/nand",
      limitations: "공개 표본",
      fetch_status: null,
      series: [
        series("dram_spot", "spot", "DDR5 Spot", [100, 101]),
        series("nand_spot", "nand_wafer_spot", "256Gb TLC", [10, 12]),
      ],
    } as unknown as RegimeCurrent["memory_cycle"];

    const html = renderToStaticMarkup(<MemoryCyclePanel data={data} />);
    const dramStart = html.indexOf('data-memory-group="dram"');
    const nandStart = html.indexOf('data-memory-group="nand"');

    expect(html).toContain("관측 2회 · 추세 판단 유보");
    expect(html).toContain("08.03");
    expect(html).toContain("08.04");
    expect(html).not.toContain("각 표본의 첫 관측값=100");
    expect(dramStart).toBeGreaterThan(-1);
    expect(nandStart).toBeGreaterThan(dramStart);
    expect(html.slice(dramStart, nandStart)).toContain("DDR5 Spot");
    expect(html.slice(dramStart, nandStart)).not.toContain("256Gb TLC");
  });
});
