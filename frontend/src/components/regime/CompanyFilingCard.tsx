import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import {
  companyFilingMetricTone,
  companyFilingVerdict,
  formatSignedPercent,
  inventoryBurdenLabel,
  priorInventoryRatio,
  type FilingCompany,
  type SupplierInventoryCompany,
} from "@/lib/regime-company";
import { TONE_STYLES, thesisSignalTone } from "@/lib/regime-tone";

export function CompanyFilingCard({
  company,
  inventory,
  compact = false,
}: {
  company: FilingCompany;
  inventory?: SupplierInventoryCompany;
  compact?: boolean;
}) {
  const verdict = companyFilingVerdict(company, inventory);
  const priorRatio = priorInventoryRatio(inventory);
  const currentRatio = inventory?.inventory_to_revenue;
  const burdenState = inventoryBurdenLabel(inventory?.state);
  const compactVerdictLabel = verdict.label
    .replace("실적 확장", "확장")
    .replace("상대 재고부담", "상대부담")
    .replace("상대 재고", "상대재고");

  const metrics = [
    {
      label: "매출 YoY",
      value: formatSignedPercent(company.revenue_yoy),
      detail: "판정 핵심 · 전사 명목매출",
      tone: companyFilingMetricTone("revenue", company),
      detailTone: "neutral" as const,
      help: "전년동기 대비 전사 매출 변화입니다. 가격·물량·제품믹스·환율이 함께 반영되며 HBM 출하량을 직접 뜻하지 않습니다.",
    },
    {
      label: "영업이익률",
      value: formatSignedPercent(company.operating_margin),
      detail: company.operating_margin_change_yoy_pp == null
        ? "전년동기 변화 미확인"
        : `전년동기 ${formatSignedPercent(company.operating_margin_change_yoy_pp, 1, "%p")}`,
      tone: companyFilingMetricTone("operating_margin", company),
      detailTone: companyFilingMetricTone("operating_margin", company),
      help: "현재 분기 전사 영업이익률입니다. 양수라는 사실만으로 수익성 개선을 뜻하지 않아 전년동기 변화폭을 함께 봅니다.",
    },
    {
      label: "재고자산 YoY · 절대액",
      value: formatSignedPercent(company.inventory_yoy),
      detail: "원재료·재공품·완제품 합계",
      tone: companyFilingMetricTone("inventory", company),
      detailTone: "neutral" as const,
      help: "분기말 총재고 장부금액의 전년동기 변화입니다. 증가는 재고가 늘었다는 뜻이지만, 악성 완제품 재고가 쌓였다는 뜻은 아닙니다. 제품 구성과 매출 대비 부담을 함께 봅니다.",
    },
    {
      label: compact ? "CAPEX YoY · 판정 미사용" : "공급사 CAPEX YoY",
      value: formatSignedPercent(company.capex_yoy),
      detail: `${company.capex_period || "기간 미확인"} · 판정 미사용`,
      tone: companyFilingMetricTone("capex", company),
      detailTone: "neutral" as const,
      help: "현금흐름표상 유형자산 취득의 전년동기 변화입니다. 투자 의지와 미래 공급 확대를 함께 뜻할 수 있어 현재 실적·수급 판정에는 기계적으로 합산하지 않습니다.",
    },
  ];

  return (
    <article className={`rounded-lg border bg-muted/10 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{company.name}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            실적 기준 {company.latest_period || "미수집"}
          </p>
        </div>
        <Badge variant={TONE_STYLES[verdict.tone].badge}>
          {compact ? compactVerdictLabel : verdict.label}
        </Badge>
      </div>

      <div className={`mt-3 grid grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
        {metrics.map((metric) => (
          <div key={metric.label} className={`min-w-0 rounded-md bg-background/35 ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
            <div className="flex items-center gap-1">
              <p className="text-[11px] leading-4 text-muted-foreground">{metric.label}</p>
              <InfoTip label={`${metric.label} 설명`} className="h-4 w-4">
                {metric.help}
              </InfoTip>
            </div>
            <p
              className={`mt-1 font-semibold tabular-nums ${TONE_STYLES[metric.tone].text}`}
              data-metric-label={metric.label}
              data-semantic-tone={metric.tone}
            >
              {metric.value}
            </p>
            {!compact && (
              <p className={`mt-1 text-[10px] leading-4 ${
                metric.detailTone === "neutral"
                  ? "text-muted-foreground"
                  : TONE_STYLES[metric.detailTone].text
              }`}>
                {metric.detail}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className={`mt-3 rounded-md border bg-background/20 px-3 ${compact ? "py-2" : "py-3"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <p className="text-[11px] text-muted-foreground">매출 대비 재고부담 · 파생 맥락</p>
            <InfoTip label="매출 대비 재고부담 설명" className="h-4 w-4">
              분기말 재고를 같은 분기 매출로 나눈 값의 회사 내 전년동기 변화입니다.
              재고일수나 물리적 재고 소진량은 아니며, 매출 가격·제품믹스 상승만으로도
              낮아질 수 있어 독립 판정축으로 중복 합산하지 않습니다.
            </InfoTip>
          </div>
          {!compact && <span className="text-[11px] text-muted-foreground">{burdenState}</span>}
        </div>
        <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
          {priorRatio == null || currentRatio == null ? (
            "비교 불가"
          ) : (
            <>
              {priorRatio.toFixed(1)}% → {currentRatio.toFixed(1)}%{" "}
              <span
                className={TONE_STYLES[thesisSignalTone(inventory?.state)].text}
                data-semantic-tone={thesisSignalTone(inventory?.state)}
              >
                ({formatSignedPercent(inventory?.ratio_change_pp, 1, "%p")})
              </span>
            </>
          )}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{verdict.explanation}</p>
      </div>
    </article>
  );
}
