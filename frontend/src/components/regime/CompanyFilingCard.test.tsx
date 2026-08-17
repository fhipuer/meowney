import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CompanyFilingCard } from "./CompanyFilingCard";
import type {
  FilingCompany,
  SupplierInventoryCompany,
} from "@/lib/regime-company";

const company = {
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
} as FilingCompany;

const inventory = {
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
} as SupplierInventoryCompany;

describe("CompanyFilingCard semantic evidence colors", () => {
  it("highlights confirmed earnings and relative inventory relief, but not raw inventory or capex", () => {
    const html = renderToStaticMarkup(
      <CompanyFilingCard company={company} inventory={inventory} />,
    );

    expect(html).toContain("매출 YoY");
    expect(html).toContain("영업이익률");
    expect(html.match(/data-semantic-tone="positive"/g)?.length).toBe(3);
    expect(html.match(/data-semantic-tone="neutral"/g)?.length).toBe(2);
    expect(html).toContain("+100.0%");
    expect(html).toContain("(-37.6%p)");
  });
});
