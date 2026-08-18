import { describe, expect, it } from "vitest";
import type { FilingCompany, SupplierInventoryCompany } from "./regime-company";
import {
  companyFilingMetricTone,
  companyFilingVerdict,
  formatSignedPercent,
  inventoryBurdenLabel,
  priorInventoryRatio,
} from "./regime-company";

const company = (overrides: Partial<FilingCompany> = {}) => ({
  id: "sk_hynix",
  name: "SK하이닉스",
  ticker: "000660",
  latest_period: "2026-06-30",
  age_days: 48,
  is_stale: false,
  latest_capex: 10,
  capex_period: "2026-06-30",
  capex_yoy: 200,
  revenue_yoy: 100,
  inventory_yoy: 20,
  operating_margin: 40,
  operating_margin_prior: 20,
  operating_margin_change_yoy_pp: 20,
  histories: { capex: [], revenue: [], operating_income: [], inventory: [] },
  ...overrides,
}) as FilingCompany;

const inventory = (overrides: Partial<SupplierInventoryCompany> = {}) => ({
  id: "sk_hynix",
  name: "SK하이닉스",
  state: "상대 재고부담 크게 완화",
  period: "2026-06-30",
  inventory_to_revenue: 22.7,
  prior_inventory_to_revenue: 60.3,
  ratio_change_yoy: -62.4,
  ratio_change_pp: -37.6,
  revenue_yoy: 100,
  inventory_yoy: 20,
  is_stale: false,
  history: [],
  ...overrides,
}) as SupplierInventoryCompany;

describe("company filing interpretation", () => {
  it("explains that absolute inventory can rise while relative burden falls", () => {
    const result = companyFilingVerdict(company({ inventory_yoy: 34.1 }), inventory());

    expect(result.tone).toBe("positive");
    expect(result.label).toContain("매출 대비 재고 부담 감소");
    expect(result.explanation).toContain("재고 절대액은 증가했지만");
    expect(priorInventoryRatio(inventory())).toBeCloseTo(60.3);
  });

  it("uses one contextual warning when relative inventory burden rises", () => {
    const result = companyFilingVerdict(
      company(),
      inventory({
        state: "상대 재고부담 확대",
        inventory_to_revenue: 70,
        prior_inventory_to_revenue: 60,
        ratio_change_pp: 10,
      }),
    );

    expect(result).toMatchObject({
      label: "실적 성장·매출 대비 재고 부담 증가",
      tone: "caution",
    });
  });

  it("does not let CAPEX override flat operating performance", () => {
    const result = companyFilingVerdict(
      company({ revenue_yoy: 0, capex_yoy: 500 }),
      inventory({ ratio_change_pp: 0 }),
    );

    expect(result.tone).toBe("neutral");
    expect(result.label).toBe("매출·수익성·재고 방향 엇갈림");
  });

  it("treats a sharp margin decline as weakening despite positive margin", () => {
    const result = companyFilingVerdict(company({
      operating_margin: 0.1,
      operating_margin_prior: 20,
      operating_margin_change_yoy_pp: -19.9,
    }), inventory());

    expect(result.tone).toBe("negative");
    expect(result.label).toBe("실적 둔화 확인");
  });

  it("colors confirmed earnings contributions without coloring ambiguous inventory or capex", () => {
    const expanding = company({
      revenue_yoy: 20,
      operating_margin: 30,
      operating_margin_change_yoy_pp: 8,
      inventory_yoy: 40,
      capex_yoy: 200,
    });

    expect(companyFilingMetricTone("revenue", expanding)).toBe("positive");
    expect(companyFilingMetricTone("operating_margin", expanding)).toBe("positive");
    expect(companyFilingMetricTone("inventory", expanding)).toBe("neutral");
    expect(companyFilingMetricTone("capex", expanding)).toBe("neutral");
    expect(companyFilingMetricTone("revenue", company({ revenue_yoy: -8 }))).toBe("negative");
    expect(companyFilingMetricTone("operating_margin", company({
      operating_margin: 12,
      operating_margin_change_yoy_pp: -6,
    }))).toBe("negative");
    expect(companyFilingMetricTone("revenue", company({ is_stale: true }))).toBe("neutral");
  });

  it("formats missing values without producing a dangling percent sign", () => {
    expect(formatSignedPercent(null)).toBe("-");
    expect(formatSignedPercent(3.2)).toBe("+3.2%");
    expect(inventoryBurdenLabel("상대 재고부담 크게 완화")).toContain("크게 감소");
    expect(inventoryBurdenLabel("안정")).toBe("매출 대비 재고 부담 변화 작음");
    expect(inventoryBurdenLabel("판정 불가")).toBe("매출 대비 재고 비교자료 부족");
  });
});
