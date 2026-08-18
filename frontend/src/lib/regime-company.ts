import type { SemanticTone } from "./regime-tone";
import type { RegimeCurrent } from "@/types";

export type FilingCompany =
  RegimeCurrent["semiconductor_cycle"]["company_confirmation"]["companies"][number];
export type SupplierInventoryCompany =
  RegimeCurrent["semiconductor_cycle"]["hbm_server_proxy"]["components"]["supplier_inventory"]["companies"][number];

export type CompanyFilingVerdict = {
  label: string;
  tone: SemanticTone;
  explanation: string;
};

export type CompanyFilingMetric =
  | "revenue"
  | "operating_margin"
  | "inventory"
  | "capex";

export const formatSignedPercent = (
  value?: number | null,
  digits = 1,
  suffix = "%",
) => value == null ? "-" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;

export function priorInventoryRatio(
  inventory?: SupplierInventoryCompany,
): number | null {
  if (!inventory || inventory.inventory_to_revenue == null) return null;
  if (inventory.prior_inventory_to_revenue != null) {
    return inventory.prior_inventory_to_revenue;
  }
  if (inventory.ratio_change_pp == null) return null;
  return inventory.inventory_to_revenue - inventory.ratio_change_pp;
}

export function inventoryBurdenLabel(state?: string | null): string {
  if (state === "판정 불가" || state === "판정 제한") return "매출 대비 재고 비교자료 부족";
  if (state === "안정") return "매출 대비 재고 부담 변화 작음";
  if (state === "재고 소화 강함") return "매출 대비 재고 부담 크게 감소";
  if (state === "재고 효율 개선") return "매출 대비 재고 부담 감소";
  if (state === "재고 효율 악화") return "매출 대비 재고 부담 증가";
  if (state === "재고 부담 확대") return "매출 대비 재고 부담 크게 증가";
  if (state === "상대 재고부담 크게 완화") return "매출 대비 재고 부담 크게 감소";
  if (state === "상대 재고부담 완화") return "매출 대비 재고 부담 감소";
  if (state === "상대 재고부담 확대") return "매출 대비 재고 부담 증가";
  if (state === "상대 재고부담 크게 확대") return "매출 대비 재고 부담 크게 증가";
  return state || "비교자료 부족";
}

export function companyFilingVerdict(
  company: FilingCompany,
  inventory?: SupplierInventoryCompany,
): CompanyFilingVerdict {
  if (
    company.is_stale
    || company.revenue_yoy == null
    || company.operating_margin == null
  ) {
    return {
      label: "실적 판단자료 부족",
      tone: "neutral",
      explanation: "최신 매출과 영업이익 공시를 함께 확인하지 못했습니다.",
    };
  }

  const revenueYoy = company.revenue_yoy;
  const operatingMargin = company.operating_margin;
  const marginDrop = company.operating_margin_change_yoy_pp != null
    && company.operating_margin_change_yoy_pp <= -5;
  const weakening = revenueYoy < -5
    || operatingMargin < 0
    || marginDrop;
  const expanding = revenueYoy >= 10
    && operatingMargin > 0
    && !marginDrop;
  const burdenDelta = inventory?.ratio_change_pp;
  const burdenImproving = burdenDelta != null && burdenDelta <= -5;
  const burdenWorsening = burdenDelta != null && burdenDelta >= 5;

  if (weakening && burdenWorsening) {
    return {
      label: "실적 둔화·매출 대비 재고 부담 증가",
      tone: "negative",
      explanation: "실적 약화와 매출 대비 재고비율 상승이 함께 확인됩니다.",
    };
  }
  if (weakening) {
    return {
      label: "실적 둔화 확인",
      tone: "negative",
      explanation: "매출 감소·영업손실·이익률 급락 중 하나의 조건에 해당합니다.",
    };
  }
  if (expanding && burdenWorsening) {
    return {
      label: "실적 성장·매출 대비 재고 부담 증가",
      tone: "caution",
      explanation: "실적은 확장 방향이지만 매출 대비 재고비율은 높아졌습니다.",
    };
  }
  if (expanding && burdenImproving) {
    return {
      label: "실적 성장·매출 대비 재고 부담 감소",
      tone: "positive",
      explanation: company.inventory_yoy != null && company.inventory_yoy > 0
        ? "재고 절대액은 증가했지만 매출이 더 빠르게 늘어 상대 부담은 낮아졌습니다."
        : "매출이 증가하고 매출 대비 재고부담은 낮아졌습니다.",
    };
  }
  if (expanding) {
    return {
      label: "실적 성장 확인",
      tone: "positive",
      explanation: "매출 증가와 영업흑자가 확인됐습니다.",
    };
  }
  if (burdenImproving) {
    return {
      label: "매출 대비 재고 부담 감소",
      tone: "info",
      explanation: "매출 대비 재고비율은 낮아졌지만 뚜렷한 실적 성장 조건은 충족하지 않았습니다.",
    };
  }
  return {
    label: "매출·수익성·재고 방향 엇갈림",
    tone: "neutral",
    explanation: "매출·수익성·매출 대비 재고 부담이 한 방향으로 움직이지 않았습니다.",
  };
}

/**
 * Give color to a filing number only after the same contextual checks used by
 * the company verdict have passed. Inventory and supplier CAPEX deliberately
 * stay neutral because their signs have two-sided supply-cycle meanings.
 */
export function companyFilingMetricTone(
  metric: CompanyFilingMetric,
  company: FilingCompany,
): SemanticTone {
  if (company.is_stale) return "neutral";
  if (metric === "inventory" || metric === "capex") return "neutral";

  const revenue = company.revenue_yoy;
  const margin = company.operating_margin;
  const marginChange = company.operating_margin_change_yoy_pp;
  const marginDrop = marginChange != null && marginChange <= -5;

  if (metric === "revenue") {
    if (revenue == null) return "neutral";
    if (revenue < -5) return "negative";
    if (revenue >= 10 && margin != null && margin > 0 && !marginDrop) {
      return "positive";
    }
    return revenue < 0 ? "caution" : "neutral";
  }

  if (margin == null) return "neutral";
  if (margin < 0 || marginDrop) return "negative";
  if (
    revenue != null && revenue >= 10 && margin > 0 &&
    (marginChange == null || marginChange >= 0)
  ) return "positive";
  if (marginChange != null && marginChange < 0) return "caution";
  return "neutral";
}
