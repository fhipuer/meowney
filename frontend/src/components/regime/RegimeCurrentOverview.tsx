import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Database,
  Save,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/ui/info-tip";
import { formatRegimeEventSchedule } from "@/lib/regime-events";
import { inventoryBurdenLabel } from "@/lib/regime-company";
import {
  aiCapexStateLabel,
  companyConfirmationStateLabel,
  creditConditionLabel,
  dataQualityLabel,
  dramBottleneckStateLabel,
  durationStressDriverLabel,
  durationStressLabel,
  exportStructureStateLabel,
  hbmProxyStateLabel,
  longRatePressureLabel,
  macroEnvironmentLabel,
  memoryPriceStateLabel,
  momentumDirectionLabel,
  nandPriceStateLabel,
  observationStatusLabel,
  plainLanguageStateText,
  interconnectionAxisLabel,
  policyPressureLabel,
  powerDemandAxisLabel,
  powerOperationsAxisLabel,
  powerStateLabel,
  powerSupplyAxisLabel,
  rateDirectionLabel,
  recentRateShockLabel,
  regimeCandidateLabel,
  regimeLevelLabel,
  rdimmStateLabel,
  supplyStateLabel,
  termPremiumLabel,
  transmissionInvestmentAxisLabel,
  yieldCurveChangeLabel,
  yieldCurveConfirmationLabel,
  yieldCurveStateLabel,
} from "@/lib/regime-display";
import {
  TONE_STYLES,
  aiCapexDeltaTone,
  aiCapexTone,
  availabilityTone,
  dataQualityTone,
  financialConditionTone,
  memoryPriceTone,
  powerConstructionTone,
  powerDemandTone,
  powerInterconnectionTone,
  powerOperationsTone,
  powerTransmissionTone,
  regimeLevelTone,
  thesisSignalTone,
  type SemanticTone,
} from "@/lib/regime-tone";
import { MacroQuadrant } from "./MacroQuadrant";
import { CompanyFilingCard } from "./CompanyFilingCard";
import type { RegimeCurrent, RegimeLevel } from "@/types";

const LEVELS: RegimeLevel[] = ["유지", "경계", "약화", "전환"];
const FEED_DISPLAY_NAMES: Record<string, string> = {
  macro: "미국 거시지표",
  treasury: "미국 국채금리",
  ai_capex: "하이퍼스케일러 CAPEX",
  memory: "메모리 공개가격",
  kosis: "한국 산업지표",
  customs: "한국 수출입",
  opendart: "국내 기업 공시",
  eia: "미국 전력지표",
  lbnl_queue: "발전 공급 접속 대기",
  transmission_investment: "송전 투자",
  energy: "원유 가격·재고",
};
const FEED_STATUS_LABELS: Record<string, string> = {
  failed: "최근 갱신 실패",
  partial: "일부 항목 갱신 지연",
  configuration_required: "연결 설정 필요",
};
export const FINANCIAL_TRANSMISSION_HELP: Record<string, string> = {
  "정책 긴축":
    "기준금리에서 Core PCE 전년비를 뺀 실질 정책금리 대용치로 단기금리가 수요를 얼마나 누르는지 봅니다. 0%p 미만은 수요 억제력이 낮고, 0~1%p는 약한 억제, 1%p 이상은 뚜렷한 억제로 표시합니다. 이 값만으로 침체를 판정하지는 않습니다.",
  "장기금리 전달":
    "10년 명목금리를 실질금리(TIPS)와 기대인플레이션(BEI)으로 나눠 기업 투자·주택·성장주 할인율에 주는 부담을 봅니다. 판정은 TIPS 절대수준을 사용합니다. 기간 프리미엄(TP)은 금리 상승 원인을 설명하는 보조 추정치이며 점수에 중복 합산하지 않습니다.",
  "최근 금리 충격":
    "명목 10년·TIPS·BEI의 공통 관측일을 맞춘 뒤 최근 20관측일과 63관측일 변화를 비교합니다. ‘추가 금리 충격 거의 없음’은 최근 상승폭이 작다는 뜻이며, 현재 금리 수준 자체가 낮다는 의미는 아닙니다.",
  "30년물 현재 부담·추가 충격":
    "현재 절대수준과 최근 상승 충격을 분리합니다. 절대수준은 30년 실질금리 3.0% 이상과 30Y-10Y +0.50%p 이상이 최근 5회 중 3회 확인됐는지 봅니다. 최근 충격은 공통 관측일 기준 20관측일 상승폭을 계산하고 최근 3회 중 2회 확인해야 진입·유지합니다. 실질금리 상승에는 기대 실질단기금리와 실질 기간 프리미엄이 함께 들어가므로 이 화면이 둘을 직접 분리하지는 않습니다. 10년 실질금리와 같은 금리 부담이므로 별도 거시영역으로 중복 합산하지 않습니다.",
  "수익률곡선 선행위험":
    "10Y-3M 스프레드의 최근 21관측일 평균으로 향후 12개월 침체확률을 계산합니다. 10Y-2Y는 확인자료로만 사용합니다. 현재 역전이 끝났더라도 과거 역전 뒤 침체가 나타나는 시차를 고려해 최대 252관측일 동안 영향을 관찰합니다.",
  "신용·금융여건":
    "HY(하이일드)·IG(투자등급) OAS는 국채보다 회사채가 더 부담하는 금리이고, NFCI는 0이 장기 평균입니다. 스프레드가 넓어지거나 NFCI가 0 위로 오르면 기업 자금조달이 어려워집니다. ‘자금조달 여건 양호’는 신용시장만 설명하며 Fed 정책금리가 낮다는 뜻은 아닙니다.",
  "에너지 가격·공급충격":
    "WTI의 5·20·63·252관측일 변화, 원유 변동성 OVX, EIA 미국 상업용 원유재고의 4·52주 변화를 분리해 봅니다. 유가와 변동성만 높으면 경계로 표시하고, 재고 감소까지 함께 확인돼야 공급충격으로 판정합니다. 에너지 자산 추천이 아니라 성장·물가에 전달될 충격의 조기경보입니다.",
};
export type CurrentOverviewProps = {
  data: RegimeCurrent;
  judgment: RegimeLevel | "";
  note: string;
  snapshotPending: boolean;
  snapshotSavedAt?: string | null;
  onJudgment: (value: RegimeLevel | "") => void;
  onNote: (value: string) => void;
  onSnapshot: () => void;
};
const signed = (value: number | null | undefined, digits = 1) =>
  value == null ? "-" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
const billions = (value: number | null | undefined) =>
  value == null ? "-" : `$${value.toFixed(value >= 100 ? 1 : 2)}B`;

function eventDate(event: RegimeCurrent["upcoming_events"][number]) {
  return event.scheduled_date || event.scheduled_at?.slice(0, 10) || null;
}

function eventCountdown(dateValue: string | null) {
  if (!dateValue) return "일정 확인 필요";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return "일정 확인 필요";
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const days = Math.round((target - today) / 86_400_000);
  if (days < 0) return "발표 후 새로고침 필요";
  if (days === 0) return "오늘 발표 · 발표 후 새로고침";
  return `D-${days}`;
}

function aiThesisOverview(data: RegimeCurrent): {
  label: string;
  detail: string;
  tone: SemanticTone;
} {
  const semiconductor = data.semiconductor_cycle;
  const dram = semiconductor?.dram_bottleneck;
  const supplyWarning = ["재고 부담", "생산·출하 둔화"].includes(
    semiconductor?.supply.state || "",
  );
  if (!semiconductor || !dram || semiconductor.state === "판정 불가") {
    return {
      label: "AI 가설 판단자료 부족",
      detail: `${aiCapexStateLabel(data.ai_capex.state)} · DRAM 핵심자료 부족`,
      tone: "neutral",
    };
  }
  if (semiconductor.state === "경계") {
    return {
      label: "AI 가설 약화 가능성 관찰",
      detail: `${aiCapexStateLabel(data.ai_capex.state)} · ${dramBottleneckStateLabel(dram.state)}`,
      tone: "caution",
    };
  }
  if (semiconductor.state === "확장 확인" && data.ai_capex.state === "감속 관찰") {
    return {
      label: "메모리 병목은 지속·설비투자는 감속 관찰",
      detail: `${aiCapexStateLabel(data.ai_capex.state)} · ${dramBottleneckStateLabel(dram.state)}`,
      tone: "caution",
    };
  }
  if (
    semiconductor.state === "확장 확인"
    && ["혼조", "판정 불가", "판정 제한"].includes(data.ai_capex.state)
  ) {
    return {
      label: "메모리 강세·설비투자 추가 확인 필요",
      detail: `${aiCapexStateLabel(data.ai_capex.state)} · ${dramBottleneckStateLabel(dram.state)}`,
      tone: "caution",
    };
  }
  if (semiconductor.state === "확장 확인" && supplyWarning) {
    return {
      label: "확장 신호 우세·완제품 재고 관찰",
      detail: `${dramBottleneckStateLabel(dram.state)} · ${supplyStateLabel(semiconductor.supply.state)}`,
      tone: "caution",
    };
  }
  if (semiconductor.state === "확장 확인") {
    return {
      label: "AI 투자·메모리 확장 근거 유지",
      detail: `${aiCapexStateLabel(data.ai_capex.state)} · ${dramBottleneckStateLabel(dram.state)}`,
      tone: "positive",
    };
  }
  return {
    label: "AI 투자·메모리 신호 엇갈림",
    detail: `${aiCapexStateLabel(data.ai_capex.state)} · ${dramBottleneckStateLabel(dram.state)}`,
    tone: "neutral",
  };
}

export function DecisionHeader({ data }: { data: RegimeCurrent }) {
  const limited = data.data_quality.status !== "충분";
  const eventFeedAvailable = ["success", "partial"].includes(
    data.feed_health?.events?.status || "",
  );
  const title = data.needs_new_review
    ? "지금 다시 상세점검하세요"
    : data.review_urgency === "watch"
      ? eventFeedAvailable
        ? "다음 발표까지 관찰"
        : "관찰 유지"
      : "새 상세점검 사유 없음";
  const detail = data.needs_new_review
    ? plainLanguageStateText(data.review_reasons[0] || "즉시 점검 기준이 충족됐습니다.")
    : limited
      ? "새 위험 신호는 없지만 핵심자료 일부가 비어 있어 정상 상태로 확정할 수 없습니다."
      : "마지막 상태 기록 이후 새로 충족한 점검 기준이나 위험도 상승이 없습니다.";
  const calm =
    !data.needs_new_review && data.review_urgency === "not_needed" && !limited;
  const pressure =
    data.macro_quadrant.pressure_vector ?? data.macro_quadrant.momentum_vector;
  const legacyPoint = data.macro_quadrant.points.at(-1);
  const legacyDirection =
    legacyPoint?.growth.coordinate != null &&
    legacyPoint.inflation.coordinate != null
      ? `${legacyPoint.growth.coordinate <= -15 ? "성장 둔화" : legacyPoint.growth.coordinate >= 15 ? "성장 개선" : "성장 변화 미미"}·${legacyPoint.inflation.coordinate <= -15 ? "물가 완화" : legacyPoint.inflation.coordinate >= 15 ? "물가 재가속" : "물가 변화 미미"}`
      : "판정 불가";
  const rawEnvironment =
    data.macro_quadrant.environment_point?.label ||
    data.macro_quadrant.environment_label;
  const environment = `${macroEnvironmentLabel(rawEnvironment)} / ${momentumDirectionLabel(pressure?.direction || legacyDirection)}`;
  const macroCoverage = Object.values(data.coverage.domains).reduce(
    (result, item) => ({
      usable: result.usable + item.usable,
      total: result.total + item.total,
    }),
    { usable: 0, total: 0 },
  );
  const automaticTone = regimeLevelTone(data.automatic_regime);
  const candidateTone = regimeLevelTone(data.candidate_regime);
  const qualityTone = dataQualityTone(data.data_quality.status);
  const qualityDimensions = data.data_quality.dimensions;
  const thesis = aiThesisOverview(data);
  const aggregate = data.ai_capex.aggregate;
  const breadth = data.ai_capex.breadth;
  const upcomingEvents = data.upcoming_events || [];
  const firstEvent = upcomingEvents[0];
  const nearestDate = firstEvent ? eventDate(firstEvent) : null;
  const nearestEvents = nearestDate
    ? upcomingEvents.filter((event) => eventDate(event) === nearestDate)
    : [];
  const eventSchedule = firstEvent ? formatRegimeEventSchedule(firstEvent) : null;
  const showCandidate = data.candidate_regime !== data.automatic_regime;
  const delayedReferenceFeeds = Object.entries(data.feed_health || {})
    .filter(([name, feed]) =>
      name !== "events"
      && feed
      && ["failed", "partial", "configuration_required"].includes(feed.status),
    )
    .map(([name, feed]) =>
      `${FEED_DISPLAY_NAMES[name] || name} ${FEED_STATUS_LABELS[feed?.status || ""] || "상태 확인 필요"}`,
    );
  return (
    <Card className={data.needs_new_review ? "border-red-400/50" : ""}>
      <CardContent className="p-5 sm:p-7">
        <div className="grid overflow-hidden rounded-xl border border-border/80 bg-border/80 lg:grid-cols-[1.2fr_0.94fr_1fr]">
          <section className="bg-card p-5 sm:p-6" data-current-summary="action">
            <div className="flex gap-3 sm:gap-4">
              {calm ? (
                <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle
                  className={`mt-1 h-7 w-7 shrink-0 ${data.needs_new_review ? "text-red-400" : "text-amber-400"}`}
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <span>지금 할 일</span>
                  <InfoTip label="포트폴리오 상세점검 시점">
                    현재 활성 신호, 마지막 상태 기록 이후 변화와 가까운 공식 발표를
                    함께 보고 상세 포트폴리오 분석을 다시 실행할 시점을 알립니다.
                  </InfoTip>
                </div>
                <h2 className="mt-1 text-xl font-bold leading-7 sm:text-2xl">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-border/70 pt-4">
              {firstEvent && eventSchedule ? (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">가장 가까운 공식 발표</p>
                    <p className="mt-1 text-sm font-semibold leading-5">
                      {nearestEvents.map((event) => event.event_type).join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eventSchedule.primary} · {eventSchedule.secondary}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {eventCountdown(nearestDate)}
                  </Badge>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">예정된 공식 발표를 확인하는 중입니다.</p>
              )}
            </div>
          </section>

          <section className="border-t border-border/80 bg-card p-5 sm:p-6 lg:border-l lg:border-t-0" data-current-summary="macro">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>미국 거시 판단</span>
              <InfoTip label="미국 거시 판단의 범위">
                성장·물가·금리·유동성의 결정 입력으로 계산한 레짐과 현재 경제
                수준을 함께 보여줍니다. 최신 후보가 확정 레짐과 다를 때만 후보를 표시합니다.
              </InfoTip>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className={`text-2xl font-semibold ${TONE_STYLES[automaticTone].text}`}>
                {regimeLevelLabel(data.automatic_regime)}
              </p>
              {showCandidate && (
                <Badge variant={TONE_STYLES[candidateTone].badge}>
                  후보 {regimeCandidateLabel(data.candidate_regime)}
                </Badge>
              )}
            </div>
            <p className="mt-4 text-sm font-semibold">
              {macroEnvironmentLabel(rawEnvironment)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              최근 압력 · {momentumDirectionLabel(pressure?.direction || legacyDirection)}
            </p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{environment}</p>
            {data.energy_shock && (
              <div className="mt-4 rounded-lg border bg-muted/20 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">에너지 가격·공급충격</p>
                <p className={`mt-1 text-sm font-semibold ${TONE_STYLES[data.energy_shock.tone].text}`}>
                  {data.energy_shock.state}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  WTI 20관측일 {signed(data.energy_shock.components.wti.change_20d)}% · OVX {data.energy_shock.components.ovx.value?.toFixed(1) ?? "-"} · 재고 4주 {signed(data.energy_shock.components.inventory.change_4w)}%
                </p>
              </div>
            )}
          </section>

          <section className="border-t border-border/80 bg-card p-5 sm:p-6 lg:border-l lg:border-t-0" data-current-summary="ai">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>AI 인프라 가설</span>
              <InfoTip label="AI 인프라 가설 판단 범위">
                4사 전체 현금 CAPEX 프록시와 광의 DRAM 수급을 핵심축으로 보고,
                HBM은 서버 DRAM·수출·공시로 간접 확인합니다. 거시 레짐과는 별도입니다.
              </InfoTip>
            </div>
            <p className={`mt-3 text-lg font-semibold leading-7 ${TONE_STYLES[thesis.tone].text}`}>
              {thesis.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{thesis.detail}</p>
            <div className="mt-4 rounded-lg bg-muted/25 px-3 py-3">
              <p className="text-[11px] text-muted-foreground">4사 전체 현금 CAPEX 프록시</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {billions(aggregate?.latest_value_billion)} · YoY {signed(aggregate?.yoy)}%
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {breadth?.positive_count ?? 0}/{breadth?.expected_count ?? data.ai_capex.companies?.length ?? 0}개사 증가 · 기준 {data.ai_capex.decision_as_of || aggregate?.latest_period || "미수집"}
              </p>
              {data.ai_capex.sustainability?.ttm.complete && (
                <p className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  TTM CAPEX/영업현금흐름 {data.ai_capex.sustainability.ttm.capex_to_operating_cash_flow_pct?.toFixed(0) ?? "-"}% · 잉여현금흐름 대용치 {billions(data.ai_capex.sustainability.ttm.free_cash_flow_proxy != null ? data.ai_capex.sustainability.ttm.free_cash_flow_proxy / 1_000_000_000 : null)}
                </p>
              )}
            </div>
          </section>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
          <span>
            자료 <strong className={TONE_STYLES[qualityTone].text}>{dataQualityLabel(data.data_quality.status)}</strong>
          </span>
          <span>{qualityDimensions?.decision_inputs.label || `판정입력 ${macroCoverage.usable}/${macroCoverage.total}`}</span>
          {qualityDimensions?.freshness && <span>{qualityDimensions.freshness.label}</span>}
          <span>핵심 관측 최신 {data.data_quality.observation_range?.to || "-"}</span>
          <span>계산 {data.evaluated_at ? new Date(data.evaluated_at).toLocaleString("ko-KR") : "-"}</span>
          {data.data_quality.status === "충분" && delayedReferenceFeeds.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <span>자료원 상태 · {delayedReferenceFeeds.join(" · ")}</span>
              <InfoTip label="보조자료 갱신 상태">
                현재 판정에 필요한 핵심 입력과 정상 캐시는 확보됐습니다. 이 표시는
                일부 원본의 최신 수집 상태를 기록하기 위한 참고정보이며, 지금
                상세점검이 필요하다는 뜻은 아닙니다.
              </InfoTip>
            </span>
          )}
        </div>
        {data.review_acknowledged && (
          <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
            마지막 상태 기록에서 당시 점검 기준을 확인했습니다. 새 기준 충족 또는
            위험도 상승이 생기면 다시 알립니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ChangeInbox({ data }: { data: RegimeCurrent }) {
  const lifecycleLabel = (lifecycle?: RegimeCurrent["triggers"][number]["lifecycle"]) =>
    lifecycle === "new"
      ? "새로 활성"
      : lifecycle === "worsened"
        ? "심각도 상승"
        : lifecycle === "acknowledged"
          ? "상태 기록에서 확인"
          : "계속 활성";
  const items = [
    ...data.triggers.map((trigger) => ({
      key: trigger.rule_id,
      label:
        trigger.severity === "critical"
          ? "즉시 상세점검 사유"
          : data.review_urgency === "required" && trigger.severity === "high"
            ? "상세점검 사유"
            : trigger.severity === "high"
              ? "활성 위험 신호"
              : "관찰 신호",
      text: plainLanguageStateText(trigger.summary),
      meta: lifecycleLabel(trigger.lifecycle),
      tone:
        trigger.severity === "critical"
          ? ("destructive" as const)
          : trigger.severity === "high"
            ? ("warning" as const)
            : ("neutral" as const),
    })),
    ...(data.changes_since_snapshot || []).map((text, index) => ({
      key: `change-${index}`,
      label: "상태 변화",
      text: plainLanguageStateText(text),
      meta: "마지막 상태 기록 이후",
      tone: "info" as const,
    })),
    ...(data.thesis_changes_since_snapshot || []).map((text, index) => ({
      key: `thesis-change-${index}`,
      label: "AI 가설 변화",
      text: plainLanguageStateText(text),
      meta: "마지막 상태 기록 이후",
      tone: "info" as const,
    })),
    ...(data.data_quality.status !== "충분"
      ? data.data_quality.reasons.map((text, index) => ({
          key: `quality-${index}`,
          label: "핵심자료 부족",
          text,
          meta: "자동 판정 범위 제한",
          tone: "warning" as const,
        }))
      : []),
  ];
  const visible = items.slice(0, 5);
  const remaining = items.slice(5);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1">
          <CardTitle>현재 판단 근거</CardTitle>
          <InfoTip label="현재 판단 근거 구성">
            현재 활성화된 위험 신호와 마지막 공식 상태 기록 이후의 판정 변화를
            보여줍니다. 개별 신호 하나가 활성됐다고 곧바로 상세점검을 실행하는
            것은 아니며, 실제 행동은 페이지 최상단의 포트폴리오 점검 판단을
            따릅니다.
          </InfoTip>
        </div>
        <p className="text-sm text-muted-foreground">
          활성 위험 신호 · AI 가설 변화 · 마지막 기록 이후 변화
        </p>
      </CardHeader>
      <CardContent>
        {!data.previous_snapshot && (
          <p className="mb-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            비교할 이전 기록이 없습니다. 현재 상태를 처음 기록한 뒤부터 변화를 비교합니다.
          </p>
        )}
        {items.length ? (
          <ul className="divide-y">
            {visible.map((item) => (
              <li
                key={item.key}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Badge
                  className="max-w-[150px] shrink-0 whitespace-normal text-center leading-4"
                  variant={item.tone}
                >
                  {item.label}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm leading-5">{item.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                </div>
              </li>
            ))}
            {remaining.length > 0 && (
              <li className="pt-3">
                <details>
                  <summary className="cursor-pointer text-sm text-primary">
                    나머지 점검 항목 {remaining.length}개 보기
                  </summary>
                  <ul className="mt-3 divide-y border-t">
                    {remaining.map((item) => (
                      <li key={item.key} className="flex items-start gap-3 py-3">
                        <Badge
                          className="max-w-[150px] shrink-0 whitespace-normal text-center leading-4"
                          variant={item.tone}
                        >
                          {item.label}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm leading-5">{item.text}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            현재 활성 위험 신호나 마지막 상태 기록 이후의 주요 변화가 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function DataConnectionStatus({ data }: { data: RegimeCurrent }) {
  const staleReferences = data.data_quality.auxiliary_stale || [];
  if (!staleReferences.length) return null;
  return (
    <details className="group rounded-lg border bg-card/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-start gap-3">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <p className="text-sm font-medium">판정 미사용 참고자료</p>
              <InfoTip label="판정 미사용 참고자료의 범위">
                자동 레짐 계산에는 쓰지 않지만 상세 지표 화면에서 참고할 수 있는
                자료입니다. 오래됐다는 표시는 프로그램을 수정하라는 뜻이 아니며
                상단의 핵심자료 상태와도 구분됩니다.
              </InfoTip>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              자동 판정에 쓰지 않는 참고자료 {staleReferences.length}건의 기준일이 오래됐습니다.
            </p>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-5 py-4">
        <ul className="divide-y">
          {staleReferences.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <Badge variant="neutral">참고자료 오래됨</Badge>
                  <Badge variant="outline">자동 레짐 판정 미사용</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.source?.toUpperCase() || "출처 미확인"} · 최신 관측 {item.observation_date || "미확인"}
                </p>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {item.age_days != null ? `${item.age_days}일 경과` : "경과일 미확인"}
                {item.max_age_days != null ? ` · 표시 기준 ${item.max_age_days}일` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function UpcomingEvents({ data }: { data: RegimeCurrent }) {
  const domainName: Record<string, string> = {
    growth: "성장·고용",
    inflation: "물가",
    rates: "금리",
  };
  const feed = data.feed_health?.events;
  const firstDate = data.upcoming_events[0]?.scheduled_date || data.upcoming_events[0]?.scheduled_at?.slice(0, 10);
  const nearestEvents = data.upcoming_events.filter(
    (event) => (event.scheduled_date || event.scheduled_at?.slice(0, 10)) === firstDate,
  );
  const laterEvents = data.upcoming_events.filter(
    (event) => (event.scheduled_date || event.scheduled_at?.slice(0, 10)) !== firstDate,
  );
  const eventCard = (event: RegimeCurrent["upcoming_events"][number]) => {
    const schedule = formatRegimeEventSchedule(event);
    return (
      <a
        key={event.id}
        href={event.source_url}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg border bg-muted/20 p-4 transition-colors hover:border-primary/40"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium">{event.event_type}</p>
          <Badge variant="neutral">{event.source}</Badge>
        </div>
        <p className="mt-2 text-sm text-primary">{schedule.primary}</p>
        <p className="mt-1 text-xs text-muted-foreground">{schedule.secondary}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {event.affected_domains.map((item) => domainName[item] || item).join(" · ")}
        </p>
      </a>
    );
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <CardTitle>다음 미국 주요 발표</CardTitle>
          <InfoTip label="발표 일정 출처">
            CPI·고용·GDP·PCE 등은 FRED 발표일을, FOMC 금리결정은 연준의 공식
            회의 일정을 사용합니다. 원본이 시각을 제공하지 않으면 임의의 시간을
            붙이지 않으며 발표 직후 새로고침하면 관련 판정을 다시 계산합니다.
          </InfoTip>
          {data.upcoming_events.length > 0 && (
            <Badge variant="outline" className="ml-auto">향후 {data.upcoming_events.length}건</Badge>
          )}
        </div>
        {feed?.last_success_at && (
          <p className="mt-2 text-xs text-muted-foreground">
            일정 갱신 {new Date(feed.last_success_at).toLocaleString("ko-KR")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {data.upcoming_events.length ? (
          <>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                가장 가까운 발표일 · {nearestEvents.length}건
              </p>
              <div className="grid gap-3 md:grid-cols-2">{nearestEvents.map(eventCard)}</div>
            </div>
            {laterEvents.length > 0 && (
              <details className="group rounded-lg border bg-muted/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <span>이후 일정 {laterEvents.length}건 전체 보기</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-3 border-t p-4 md:grid-cols-2">
                  {laterEvents.map(eventCard)}
                </div>
              </details>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {feed?.status === "success"
              ? "현재 동기화된 향후 주요 발표 일정이 없습니다."
              : "발표 일정을 아직 동기화하지 않았습니다. 데이터 새로고침으로 불러올 수 있습니다."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DriverList({
  title,
  contributors,
  positive,
  negative,
  positiveClass,
  negativeClass,
}: {
  title: string;
  contributors: Array<{ id: string; name: string; weighted_z: number }>;
  positive: string;
  negative: string;
  positiveClass: string;
  negativeClass: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-3 space-y-3">
        {contributors.length ? (
          contributors.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span>{item.name}</span>
              <span
                className={
                  item.weighted_z > 0 ? positiveClass : negativeClass
                }
              >
                {item.weighted_z > 0 ? positive : negative} ·{" "}
                {signed(item.weighted_z, 2)}
              </span>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted-foreground">
            기여도를 계산할 자료가 부족합니다.
          </li>
        )}
      </ul>
    </div>
  );
}

function EvidencePanel({ data }: { data: RegimeCurrent }) {
  const current = data.macro_quadrant.points.at(-1);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-1">
          <CardTitle>최근 방향을 만든 주요 지표</CardTitle>
            <InfoTip label="좌표 기여도 설명">
              각 지표의 최근 변화율을 자체 과거 분포에서 표준화한 뒤 영역별
            가중치를 적용한 값입니다. 절대값이 클수록 현재 화살표 방향에 미친
            영향이 큽니다. 성장에서는 강세·약세, 물가에서는 상승압력·완화압력
            방향을 뜻합니다.
            </InfoTip>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
          <DriverList
            title="성장 모멘텀"
            contributors={current?.growth.contributors || []}
            positive="강세 기여"
            negative="약세 기여"
            positiveClass="text-emerald-300"
            negativeClass="text-amber-300"
          />
          <DriverList
            title="인플레이션 모멘텀"
            contributors={current?.inflation.contributors || []}
            positive="상승압력 기여"
            negative="완화압력 기여"
            positiveClass="text-amber-300"
            negativeClass="text-sky-300"
          />
        </CardContent>
      </Card>
      {data.data_quality.status !== "충분" && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <div className="flex gap-2">
            <Database className="mt-0.5 h-4 w-4 text-amber-300" />
            <div>
              <p className="text-sm font-medium">판단 범위 제한</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{data.data_quality.reasons.join(" · ")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinancialTransmission({ data }: { data: RegimeCurrent }) {
  const conditions = data.macro_quadrant.financial_conditions;
  const count = (domain: string) =>
    data.triggers.filter((item) => item.domain === domain).length;
  const countRateRules = (kind: "level" | "shock" | "duration" | "curve") =>
    data.triggers.filter(
      (item) =>
        item.domain === "rates" &&
        (kind === "level"
          ? item.rule_id === "tightening.restrictive_level"
          : kind === "duration"
            ? item.rule_id.startsWith("tightening.long_end_duration")
          : kind === "curve"
            ? item.evidence_cluster === "yield_curve"
            : item.evidence_cluster !== "yield_curve" &&
              item.rule_id !== "tightening.restrictive_level" &&
              !item.rule_id.startsWith("tightening.long_end_duration")),
    ).length;
  const shock20 = conditions?.recent_shock?.change_20d?.changes;
  const curve = conditions?.yield_curve;
  const duration = conditions?.duration_stress;
  const duration20 = duration?.change_20d?.changes;
  const energy = data.energy_shock;
  const durationLevelTone: SemanticTone =
    duration?.level_label === "장기채 부담 높음"
      ? "negative"
      : duration?.level_label === "장기채 부담 관찰"
        ? "caution"
        : duration?.level_label === "장기채 부담 낮음"
          ? "positive"
          : "neutral";
  const cards = [
    [
      "정책 긴축",
      policyPressureLabel(conditions?.policy.label),
      `Fed ${conditions?.policy.fed_funds?.toFixed(2) ?? "-"}% / Core PCE YoY ${conditions?.policy.core_pce_yoy?.toFixed(2) ?? "-"}% / 실질 정책금리 ${signed(conditions?.policy.real_policy_rate, 2)}%p`,
      `${dataQualityLabel(data.coverage.domains.rates.status)} · 사용 가능 자료 ${Math.round(data.coverage.domains.rates.coverage * 100)}%`,
      0,
      financialConditionTone(conditions?.policy.label),
    ],
    [
      "장기금리 전달",
      longRatePressureLabel(conditions?.long_rates.label),
      `10Y ${conditions?.long_rates.nominal_10y?.toFixed(2) ?? "-"}% = TIPS ${conditions?.long_rates.real_10y?.toFixed(2) ?? "-"}% + BEI ${conditions?.long_rates.breakeven_10y?.toFixed(2) ?? "-"}% · TP ${conditions?.long_rates.term_premium?.toFixed(2) ?? "-"}%`,
      conditions?.long_rates.term_premium != null
        ? `기간 프리미엄 ${termPremiumLabel(conditions.long_rates.term_premium_label)} · ${conditions.long_rates.term_premium.toFixed(2)}%${conditions.long_rates.term_premium_percentile != null ? ` · 10년 표본 ${conditions.long_rates.term_premium_percentile.toFixed(0)}백분위` : ""}`
        : "기간 프리미엄 자료 부족",
      countRateRules("level"),
      financialConditionTone(conditions?.long_rates.label),
    ],
    [
      "최근 금리 충격",
      recentRateShockLabel(conditions?.recent_shock?.label),
      shock20
        ? `20관측일: 명목 ${signed(shock20.us10y, 2)}%p / TIPS ${signed(shock20.tips10y, 2)}%p / BEI ${signed(shock20.bei10y, 2)}%p`
        : "공통 관측일 자료 부족",
      conditions?.recent_shock
        ? `${rateDirectionLabel(conditions.recent_shock.direction)} · ${conditions.recent_shock.persistent ? "상승 압력이 63관측일까지 지속" : "20·63관측일 동시 상승 없음"}`
        : "최근 금리 변화자료 부족",
      countRateRules("shock"),
      financialConditionTone(conditions?.recent_shock?.label),
    ],
    [
      "30년물 현재 부담·추가 충격",
      duration?.level_label || "판정 불가",
      duration
        ? `30Y 명목 ${duration.nominal_30y?.toFixed(2) ?? "-"}% / 실질 ${duration.real_30y?.toFixed(2) ?? "-"}% / 30Y-10Y ${signed(duration.spread_30y10y, 2)}%p`
        : "30년 명목·실질금리 자료 부족",
      duration20
        ? `최근 20관측일: ${durationStressLabel(duration?.recent_label || duration?.label)} · 명목 ${signed(duration20.us30y, 2)}%p / 실질 ${signed(duration20.tips30y, 2)}%p · 최근 3회 중 ${duration?.recent_confirmation_count_3d ?? 0}회 · ${durationStressDriverLabel(duration?.driver)} · 기준 ${duration?.change_20d?.start_date || "-"}→${duration?.as_of_date || duration?.change_20d?.end_date || "-"}`
        : "장기 구간 변화자료 부족",
      countRateRules("duration"),
      durationLevelTone,
    ],
    [
      "수익률곡선 선행위험",
      yieldCurveStateLabel(curve?.state),
      curve?.monthly_average_10y3m != null
        ? `10Y-3M 21관측일 평균 ${signed(curve.monthly_average_10y3m, 2)}%p · 12개월 침체확률 ${curve.recession_probability_12m?.toFixed(1) ?? "-"}%`
        : "10Y-3M 월평균 대용치 자료 부족",
      curve
        ? `10Y-2Y ${yieldCurveConfirmationLabel(curve.confirmation)} · ${yieldCurveChangeLabel(curve.steepening.state)}`
        : "수익률곡선 자료 부족",
      countRateRules("curve"),
      financialConditionTone(curve?.label),
    ],
    [
      "신용·금융여건",
      creditConditionLabel(conditions?.credit.label),
      `HY ${conditions?.credit.hy_oas?.toFixed(2) ?? "-"}%p / IG ${conditions?.credit.ig_oas?.toFixed(2) ?? "-"}%p / NFCI ${conditions?.credit.nfci?.toFixed(2) ?? "-"}`,
      `${dataQualityLabel(data.coverage.domains.liquidity.status)} · 사용 가능 자료 ${Math.round(data.coverage.domains.liquidity.coverage * 100)}%`,
      count("liquidity"),
      financialConditionTone(conditions?.credit.label),
    ],
    ...(energy ? [[
      "에너지 가격·공급충격",
      energy.state,
      `WTI $${energy.components.wti.value?.toFixed(2) ?? "-"} · 20관측일 ${signed(energy.components.wti.change_20d)}% / OVX ${energy.components.ovx.value?.toFixed(1) ?? "-"}`,
      `상업용 원유재고 4주 ${signed(energy.components.inventory.change_4w)}% · ${energy.components.inventory.physical_tightening ? "재고 감소 확인" : "공급 부족 확인 안 됨"} · 기준 ${energy.as_of_date || "-"}`,
      count("energy"),
      energy.tone,
    ] as [string, string, string, string, number, SemanticTone]] : []),
  ] as Array<[string, string, string, string, number, SemanticTone]>;
  const tonePriority: Record<SemanticTone, number> = {
    negative: 5,
    caution: 4,
    neutral: 2,
    info: 2,
    positive: 1,
  };
  const importantCards = cards
    .filter((card) => card[4] > 0 || ["negative", "caution"].includes(card[5]))
    .sort((left, right) => right[4] - left[4] || tonePriority[right[5]] - tonePriority[left[5]]);
  const primaryCards = importantCards.length ? importantCards : cards.slice(0, 3);
  const secondaryCards = cards.filter((card) => !primaryCards.includes(card));
  const renderCards = (items: typeof cards) => items.map((card) => (
    <div
      key={card[0]}
      className={`min-w-0 rounded-lg border bg-muted/15 p-5 ${TONE_STYLES[card[5]].panel}`}
      data-financial-card={card[0]}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-muted-foreground">{card[0]}</p>
            <InfoTip label={`${card[0]} 설명`} className="h-4 w-4">
              {FINANCIAL_TRANSMISSION_HELP[card[0]]}
            </InfoTip>
          </div>
          <p className={`mt-2 min-h-12 text-lg font-semibold leading-6 ${TONE_STYLES[card[5]].text}`}>{card[1]}</p>
        </div>
        {card[4] > 0 && <Badge className="max-w-[92px] shrink-0 whitespace-normal text-center leading-4" variant="danger">점검 {card[4]}</Badge>}
      </div>
      <p className="mt-4 text-sm leading-6">{card[2]}</p>
      <p className="mt-4 border-t pt-3 text-xs leading-5 text-muted-foreground">{card[3]}</p>
    </div>
  ));
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1">
          <CardTitle>거시 전달경로</CardTitle>
          <InfoTip label="거시 전달경로 모니터 설명">
            단기 정책금리, 장기 실질금리, 수익률곡선, 신용시장과 에너지
            공급충격이 성장·물가에 전달하는 부담을 구분해 보여줍니다. 에너지는
            별도 조기경보이며 미국 거시 4개 영역 점수에 기계적으로 중복 합산하지 않습니다.
          </InfoTip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {renderCards(primaryCards)}
        </div>
        {secondaryCards.length > 0 && (
          <details className="group rounded-lg border bg-muted/10">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>그 밖의 전달경로 {secondaryCards.length}개</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-4 border-t p-4 lg:grid-cols-2 xl:grid-cols-3">
              {renderCards(secondaryCards)}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function ThesisPipelineStep({
  step,
  title,
  role,
  state,
  detail,
  tone,
  asOf,
  id,
  active,
  panelId,
  onToggle,
}: {
  step: number;
  title: string;
  role: string;
  state: string;
  detail: string;
  tone: SemanticTone;
  asOf?: string | null;
  id: string;
  active: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        className={`flex h-full min-h-[132px] w-full min-w-0 flex-col rounded-xl border bg-muted/10 p-3 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[148px] sm:p-4 ${active ? "border-primary/55 bg-primary/5" : ""}`}
        data-thesis-stage={id}
        data-thesis-stage-order={step}
        aria-expanded={active}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
            {String(step).padStart(2, "0")} · {role}
          </p>
          <Badge
            className="max-w-full shrink-0 whitespace-normal text-right leading-4"
            variant={TONE_STYLES[tone].badge}
          >
            {state}
          </Badge>
        </div>
        <span className="mt-3 text-sm font-semibold">{title}</span>
        <p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        <span className="mt-3 flex w-full items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>기준 {asOf || "미수집"}</span>
          <span className="inline-flex items-center gap-1 text-primary">
            {active ? "상세 닫기" : "상세 보기"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${active ? "rotate-180" : ""}`} />
          </span>
        </span>
      </button>
      {step < 4 && (
        <ArrowRight
          aria-hidden="true"
          className="absolute -right-[18px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/70 xl:block"
        />
      )}
    </div>
  );
}

function ThesisEvidenceCard({
  id,
  title,
  role,
  state,
  tone,
  detail,
  asOf,
  help,
  className = "",
  children,
}: {
  id: string;
  title: string;
  role: string;
  state: string;
  tone: SemanticTone;
  detail: string;
  asOf?: string | null;
  help: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border bg-muted/10 p-4 sm:p-5 ${className}`}
      data-thesis-evidence={id}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{role}</p>
          <div className="mt-1 flex items-center gap-1">
            <h3 className="text-sm font-semibold leading-5">{title}</h3>
            <span className="-m-2 inline-flex h-9 w-9 items-center justify-center">
              <InfoTip label={`${title} 해석 방법`} className="h-5 w-5">
                {help}
              </InfoTip>
            </span>
          </div>
        </div>
        <Badge
          className="max-w-full shrink-0 whitespace-normal text-right leading-4"
          variant={TONE_STYLES[tone].badge}
        >
          {state}
        </Badge>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
      <div className="mt-4 border-t pt-4">{children}</div>
      <p className="mt-4 text-[10px] text-muted-foreground">기준 {asOf || "미수집"}</p>
    </section>
  );
}

function ThesisSignalRow({
  label,
  state,
  detail,
  tone,
}: {
  label: string;
  state: string;
  detail: string;
  tone: SemanticTone;
}) {
  return (
    <div className="rounded-lg bg-background/35 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Badge
          className="max-w-full whitespace-normal text-right leading-4"
          variant={TONE_STYLES[tone].badge}
        >
          {state}
        </Badge>
      </div>
      <p className="mt-2 text-sm font-medium leading-6">{detail}</p>
    </div>
  );
}

function ProxyMetricTile({
  label,
  value,
  detail,
  tone = "neutral",
  help,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: SemanticTone;
  help?: ReactNode;
}) {
  return (
    <div className="rounded-md bg-background/35 px-3 py-3">
      <div className="flex items-center gap-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {help && <InfoTip label={`${label} 설명`}>{help}</InfoTip>}
      </div>
      <p className={`mt-1 text-base font-semibold tabular-nums ${TONE_STYLES[tone].text}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

function PowerEvidenceAxis({
  step,
  title,
  state,
  value,
  detail,
  asOf,
  tone,
  sourceLabel,
  sourceUrl,
}: {
  step: number;
  title: string;
  state: string;
  value: string;
  detail: string;
  asOf?: string | null;
  tone: SemanticTone;
  sourceLabel: string;
  sourceUrl?: string | null;
}) {
  return (
    <div
      className="relative min-w-0"
      data-power-axis={step}
      data-semantic-tone={tone}
    >
      <div
        className="flex h-full min-h-[210px] min-w-0 flex-col rounded-xl border bg-background/35 p-4"
        data-power-axis-content={step}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground">
            {String(step).padStart(2, "0")}
          </p>
          <Badge
            className="max-w-full whitespace-normal text-right leading-4"
            variant={TONE_STYLES[tone].badge}
          >
            {state}
          </Badge>
        </div>
        <h4 className="mt-3 text-sm font-semibold leading-5">{title}</h4>
        <p className={`mt-3 text-lg font-semibold tabular-nums ${TONE_STYLES[tone].text}`}>
          {value}
        </p>
        <p className="mt-1 flex-1 text-[11px] leading-5 text-muted-foreground">{detail}</p>
        <div className="mt-3 border-t border-border/70 pt-3 text-[10px] leading-4 text-muted-foreground">
          <p>기준 {asOf || "미수집"}</p>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block break-words text-primary hover:underline"
            >
              {sourceLabel}
            </a>
          ) : (
            <p className="mt-1">{sourceLabel}</p>
          )}
        </div>
      </div>
      {step < 5 && (
        <ArrowRight
          aria-hidden="true"
          className="absolute -right-[18px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/70 xl:block"
        />
      )}
    </div>
  );
}

export function AiThesisMonitor({ data }: { data: RegimeCurrent }) {
  const [activeStage, setActiveStage] = useState<
    "capex" | "dram" | "confirmation" | "power" | null
  >(null);
  const ai = data.ai_capex;
  const aggregate = ai.aggregate;
  const breadth = ai.breadth;
  const memory = data.memory_cycle;
  const semiconductor = data.semiconductor_cycle;
  const power = data.power_cycle;
  const powerDemand = power.demand_axis;
  const powerOperations = power.operations_axis;
  const powerSupply = power.supply_axis;
  const powerInterconnection = power.interconnection_axis;
  const powerTransmission = power.transmission_investment_axis;
  const overview = aiThesisOverview(data);
  const dramTone = thesisSignalTone(semiconductor.dram_bottleneck.state);
  const supplyTone = thesisSignalTone(semiconductor.supply.state);
  const companyTone = thesisSignalTone(semiconductor.company_confirmation.state);
  const powerTone = powerDemandTone(power.state, !power.is_stale);
  const powerMetricTone = powerDemandTone(powerDemand?.state || power.state, !power.is_stale);
  const powerOperationsMetricTone = powerOperationsTone(
    powerOperations?.state,
    !powerOperations?.is_stale,
  );
  const powerConstructionMetricTone = powerConstructionTone(
    powerSupply?.state,
    !powerSupply?.is_stale,
  );
  const powerInterconnectionMetricTone = powerInterconnectionTone(
    powerInterconnection?.state,
    !powerInterconnection?.is_stale,
  );
  const powerTransmissionMetricTone = powerTransmissionTone(
    powerTransmission?.state,
    !powerTransmission?.is_stale,
  );
  const hbmProxy = semiconductor.hbm_server_proxy;
  const rdimm = hbmProxy.components.server_rdimm;
  const exportDecomposition = hbmProxy.components.export_decomposition;
  const supplierInventory = hbmProxy.components.supplier_inventory;
  const skHynixInventory = supplierInventory.companies.find(
    (item) => item.id === supplierInventory.primary_company,
  );
  const companyAsOf = semiconductor.company_confirmation.companies
    .map((company) => company.latest_period)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const memoryDates = memory.series
    .map((item) => item.observation_date)
    .filter(Boolean)
    .sort();
  const observationScopes = [
    { name: "하이퍼스케일러 총 CAPEX", status: aggregate?.complete && !aggregate.is_stale ? "연결" : "제한", role: "AI 투자강도" },
    { name: "공개 DRAM 가격 표본", status: memory.series.some((item) => item.market_type === "contract" && !item.is_stale) ? "연결" : "제한", role: "DRAM 주 판정 프록시" },
    { name: "한국 DRAM 수출", status: semiconductor.demand.state === "판정 불가" ? "제한" : "연결", role: "DRAM 수요 확인" },
    { name: "공개 NAND 가격 표본", status: memory.nand_state === "판정 불가" ? "제한" : "연결", role: "메모리 보조축" },
    { name: "한국 반도체 완제품 재고", status: semiconductor.supply.state === "판정 불가" ? "제한" : "연결", role: "광의 보조지표" },
    { name: "국내 2사 실적", status: semiconductor.company_confirmation.companies.some((item) => !item.is_stale) ? "연결" : "제한", role: "기업 보조축" },
    {
      name: "미국 전력 인프라 전달경로",
      status:
        powerDemand && powerOperations && powerSupply && powerInterconnection && powerTransmission
        && power.state !== "판정 제한"
        && !power.is_stale
        && !powerDemand.is_stale
        && !powerOperations.is_stale
        && !powerSupply.is_stale
        && !powerInterconnection.is_stale
        && !powerTransmission.is_stale
          ? "연결"
          : "제한",
      role: "수요·운영·건설·접속대기·송전투자",
    },
    {
      name: "HBM·서버 DRAM",
      status: hbmProxy.state === "판정 제한" || rdimm.is_stale ? "제한" : "간접 관측",
      role: "RDIMM·수출 구조 판정 + 공시 파생 맥락",
    },
  ];
  const connected = observationScopes.filter(
    (item) => item.status === "연결" || item.status === "간접 관측",
  ).length;
  const hasSupplyConflict = ["재고 부담", "생산·출하 둔화"].includes(
    semiconductor.supply.state,
  );
  const thesisConflicts = Array.from(
    new Set([
      ...semiconductor.dram_bottleneck.conflicts,
      ...hbmProxy.conflicts,
      ...(hasSupplyConflict
        ? [`한국 반도체 완제품 ${semiconductor.supply.state}`]
        : []),
    ]),
  );
  const displayedConflicts = thesisConflicts.map(plainLanguageStateText);
  const aiIncreasingCount = breadth?.positive_count ?? ai.companies.filter(
    (item) => !item.is_stale && item.yoy != null && item.yoy > 0,
  ).length;
  const aiExpectedCount = breadth?.expected_count ?? ai.companies.length;
  const confirmationAsOf = [
    companyAsOf,
    semiconductor.supply.metrics.inventory.observation_date,
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const confirmationTone: SemanticTone = thesisConflicts.length > 0
    ? "caution"
    : companyTone;
  const toggleStage = (stage: "capex" | "dram" | "confirmation" | "power") => {
    setActiveStage((current) => (current === stage ? null : stage));
  };

  return (
    <Card data-testid="ai-thesis-monitor">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>AI 인프라 투자 가설</CardTitle>
              <Badge variant={TONE_STYLES[overview.tone].badge}>{overview.label}</Badge>
              <InfoTip label="AI 투자 가설 모니터의 범위">
                하이퍼스케일러 CAPEX와 DRAM 수급을 핵심 관측축으로 두고, HBM·수출·기업
                공시·완제품 재고를 확인축으로 사용합니다. 전력 수요, 계통 운영, 발전·저장
                건설, 공급측 접속대기와 송전 투자는 후속 인프라 투자 근거이며 자동
                거시 레짐이나 포트폴리오 비중을 직접 바꾸지 않습니다.
              </InfoTip>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              AI 투자 지속성에서 메모리 병목, 확인·상충 증거, 후속 전력 투자 근거까지 한 흐름으로
              점검합니다.
            </p>
            <p className={`mt-2 text-sm font-medium ${TONE_STYLES[overview.tone].text}`}>
              현재 요약 · {overview.detail} · 전력 {powerStateLabel(power.state)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-labelledby="ai-thesis-flow-title">
          <div className="mb-3">
            <h3 id="ai-thesis-flow-title" className="text-sm font-semibold">
              가설 전달 단계
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              투자 확대가 메모리 병목과 실적 확인을 거쳐 전력 수요·설비 투자로 이어지는지를 단계별로 봅니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
            <ThesisPipelineStep
              id="capex"
              step={1}
              title="4사 전체 현금 CAPEX"
              role="AI 투자 프록시"
              state={aiCapexStateLabel(ai.state)}
              detail={aggregate?.complete
                ? `${billions(aggregate.latest_value_billion)} · YoY ${signed(aggregate.yoy)}% · ${aiIncreasingCount}/${aiExpectedCount}개사 증가`
                : ai.reason}
              tone={aiCapexTone(ai.state)}
              asOf={ai.decision_as_of || aggregate?.latest_period}
              active={activeStage === "capex"}
              panelId="ai-thesis-capex-panel"
              onToggle={() => toggleStage("capex")}
            />
            <ThesisPipelineStep
              id="dram"
              step={2}
              title="광의 DRAM 수급"
              role="메모리 수급"
              state={dramBottleneckStateLabel(semiconductor.dram_bottleneck.state)}
              detail={`${memoryPriceStateLabel(memory.state)} · ${hbmProxyStateLabel(hbmProxy.state)}(간접 확인)`}
              tone={dramTone}
              asOf={semiconductor.dram_bottleneck.decision_as_of_date || memory.decision_as_of || memoryDates.at(-1)}
              active={activeStage === "dram"}
              panelId="ai-thesis-dram-panel"
              onToggle={() => toggleStage("dram")}
            />
            <ThesisPipelineStep
              id="confirmation"
              step={3}
              title="실적·재고 확인"
              role="확인·상충"
              state={thesisConflicts.length > 0 ? `엇갈리는 근거 ${thesisConflicts.length}개` : "확장 근거 확인"}
              detail={`${companyConfirmationStateLabel(semiconductor.company_confirmation.state)} · ${supplyStateLabel(semiconductor.supply.state)}`}
              tone={confirmationTone}
              asOf={confirmationAsOf}
              active={activeStage === "confirmation"}
              panelId="ai-thesis-confirmation-panel"
              onToggle={() => toggleStage("confirmation")}
            />
            <ThesisPipelineStep
              id="power"
              step={4}
              title="전력 인프라"
              role="후속 인프라 투자 근거"
              state={powerStateLabel(power.state)}
              detail={powerDemand && powerTransmission
                ? `수요 ${signed(powerDemand.national_yoy_84d)}% · 송전투자 3년 ${signed(powerTransmission.metrics.like_for_like_three_year_cagr_pct?.value)}%`
                : `${signed(power.metrics.commercial_sales.yoy_3m_avg)}% · 상업용 3개월 평균 YoY`}
              tone={powerTone}
              asOf={powerDemand?.observation_date || power.decision_as_of_date || power.metrics.commercial_sales.observation_date}
              active={activeStage === "power"}
              panelId="ai-thesis-power-panel"
              onToggle={() => toggleStage("power")}
            />
          </div>
        </section>

        {thesisConflicts.length > 0 && (
          <div
            className="rounded-xl border border-warning/35 bg-warning/5 px-4 py-3 text-sm"
            role="status"
          >
            <span className="font-semibold text-warning">서로 엇갈리는 근거 {thesisConflicts.length}개</span>
            <span className="ml-2 leading-6 text-muted-foreground">
              {displayedConflicts.join(" · ")}
            </span>
          </div>
        )}

        <section
          id="ai-thesis-capex-panel"
          aria-labelledby="ai-thesis-capex-title"
          hidden={activeStage !== "capex"}
        >
          <div className="mb-3">
            <h3 id="ai-thesis-capex-title" className="text-sm font-semibold">AI 투자 상세</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              기업별 CAPEX 증감과 데이터 기준분기를 확인합니다.
            </p>
          </div>
          <ThesisEvidenceCard
            id="capex-detail"
            title="하이퍼스케일러 4사 전체 현금 CAPEX"
            role="핵심축 · 투자 강도"
            state={aiCapexStateLabel(ai.state)}
            tone={aiCapexTone(ai.state)}
            detail={ai.reason}
            asOf={ai.decision_as_of || aggregate?.latest_period}
            className="w-full"
            help={<>SEC 공시의 기업 전체 현금 CAPEX를 회사별 회계분기로 비교합니다. AI 전용 금액은 분리되지 않으므로 투자 강도의 프록시입니다. {ai.methodology}</>}
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <ProxyMetricTile
                label="동일 분기 합계"
                value={billions(aggregate?.latest_value_billion)}
                detail={`${aggregate?.coverage_count ?? 0}/${aggregate?.expected_count ?? aiExpectedCount}개사 완전 집계`}
                tone={aiCapexTone(ai.state)}
              />
              <ProxyMetricTile
                label="직전 분기 대비"
                value={`${signed(aggregate?.qoq)}%`}
                detail="같은 4사 합계 QoQ"
                tone={aiCapexDeltaTone(aggregate?.qoq, Boolean(aggregate?.complete && !aggregate?.is_stale))}
              />
              <ProxyMetricTile
                label="전년 동기 대비"
                value={`${signed(aggregate?.yoy)}%`}
                detail={`증가 기업 ${aiIncreasingCount}/${aiExpectedCount}`}
                tone={aiCapexDeltaTone(aggregate?.yoy, Boolean(aggregate?.complete && !aggregate?.is_stale))}
              />
              <ProxyMetricTile
                label="최근 4분기 합계"
                value={billions(aggregate?.ttm_billion)}
                detail={`TTM YoY ${signed(aggregate?.ttm_yoy)}%`}
                tone={aiCapexDeltaTone(aggregate?.ttm_yoy, Boolean(aggregate?.complete && !aggregate?.is_stale))}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {ai.companies.map((company) => (
                <div key={company.id} className="rounded-md bg-background/35 px-3 py-2 text-xs">
                  <span className="block text-muted-foreground">{company.name}</span>
                  <span className={`mt-1 block font-medium ${TONE_STYLES[aiCapexDeltaTone(company.yoy, !company.is_stale)].text}`}>
                    {company.yoy == null ? "-" : `${company.yoy > 0 ? "+" : ""}${company.yoy.toFixed(0)}% YoY`}
                  </span>
                </div>
              ))}
            </div>
          </ThesisEvidenceCard>
        </section>

        <section
          id="ai-thesis-dram-panel"
          aria-labelledby="ai-thesis-dram-title"
          hidden={activeStage !== "dram"}
        >
          <div className="mb-3">
            <h3 id="ai-thesis-dram-title" className="text-sm font-semibold">광의 DRAM 수급과 HBM 간접 확인</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              공개 DRAM 가격을 주축으로 보고, 직접 HBM 자료가 없어 서버 DRAM·수출·공시를 별도 확인축으로 사용합니다.
            </p>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-12">

          <ThesisEvidenceCard
            id="dram-core"
            title="DRAM 수급 핵심축"
            role="핵심축 · 반도체 주 판정"
            state={dramBottleneckStateLabel(semiconductor.dram_bottleneck.state)}
            tone={dramTone}
            detail={semiconductor.dram_bottleneck.reason}
            asOf={semiconductor.dram_bottleneck.decision_as_of_date || memory.decision_as_of || memoryDates.at(-1)}
            className="xl:col-span-5"
            help={<>{semiconductor.dram_bottleneck.methodology} 공개 가격은 DDR5 모듈 표본이며 HBM·Server DRAM을 직접 대표하지 않습니다. 수출액에는 가격과 물량 효과가 함께 포함됩니다.</>}
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(190px,0.55fr)]">
              <ThesisSignalRow
                label="주축 · 공개 DRAM 가격"
                state={memoryPriceStateLabel(memory.state)}
                detail={memory.reason}
                tone={memoryPriceTone(memory.state)}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background/35 px-3 py-3">
                  <p className="text-[11px] text-muted-foreground">주 판정 신호</p>
                  <p className="mt-2 text-sm font-semibold">
                    {semiconductor.dram_bottleneck.primary_signal}
                  </p>
                </div>
                <div className="rounded-lg bg-background/35 px-3 py-3">
                  <p className="text-[11px] text-muted-foreground">판정 신뢰도</p>
                  <p className="mt-2 text-sm font-semibold">
                    {semiconductor.dram_bottleneck.confidence}
                  </p>
                </div>
              </div>
            </div>
          </ThesisEvidenceCard>

          <ThesisEvidenceCard
            id="hbm"
            title="HBM·서버 DRAM 간접계측"
            role="확인축 · 직접 HBM 데이터 아님"
            state={hbmProxyStateLabel(hbmProxy.state)}
            tone={thesisSignalTone(hbmProxy.state)}
            detail={hbmProxy.reason}
            asOf={rdimm.observation_date}
            className="xl:col-span-7"
            help={<>{hbmProxy.methodology}. {hbmProxy.limitations}. HBM 직접가격이 아니라 여러 독립 프록시가 같은 방향인지 확인합니다.</>}
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <ProxyMetricTile
                label="서버 RDIMM"
                value={`${signed(rdimm.change_percent, 2)}%`}
                detail={`${rdimmStateLabel(rdimm.state)} · ${rdimm.observation_date || "미수집"}`}
                tone={memoryPriceTone(rdimm.state)}
                help="공개 DDR5 RDIMM 모듈 가격표의 최근 표기 변화율입니다. 서버 DRAM 계약가격이나 HBM 가격을 직접 뜻하지 않습니다."
              />
              <ProxyMetricTile
                label="DRAM 칩 수출"
                value={`${signed(semiconductor.demand.metrics.dram.yoy_3m_avg)}%`}
                detail={`3개월 평균 YoY · 최근 3M/직전 3M ${signed(semiconductor.demand.metrics.dram.sequential_3m)}%`}
                tone={thesisSignalTone(semiconductor.demand.state)}
                help="관세청 HS 8542321010 DRAM 칩 수출액입니다. 전년동월 비교와 최근 3개월 평균의 순차 변화를 구분해 봅니다."
              />
              <ProxyMetricTile
                label="MCP 수출"
                value={`${signed(semiconductor.demand.metrics.mcp.yoy_3m_avg)}%`}
                detail="복합구조칩 · 3개월 평균 YoY"
                tone={semiconductor.demand.metrics.mcp.yoy_3m_avg == null ? "neutral" : semiconductor.demand.metrics.mcp.yoy_3m_avg >= 15 ? "positive" : semiconductor.demand.metrics.mcp.yoy_3m_avg < 0 ? "negative" : "neutral"}
                help="관세청 HS 8542323000 복합구조칩 집적회로 수출액으로, HBM을 직접 분리하지 못하는 고집적 패키지 확인축입니다."
              />
              <ProxyMetricTile
                label="DRAM 모듈 수출"
                value={`${signed(semiconductor.demand.metrics.dram_module.yoy_3m_avg)}%`}
                detail="DRAM 모듈 · 3개월 평균 YoY"
                tone={semiconductor.demand.metrics.dram_module.yoy_3m_avg == null ? "neutral" : semiconductor.demand.metrics.dram_module.yoy_3m_avg >= 15 ? "positive" : semiconductor.demand.metrics.dram_module.yoy_3m_avg < 0 ? "negative" : "neutral"}
                help="관세청 HS 8473304060 DRAM 모듈 수출액으로, 칩과 다른 분류에서 서버·완제품 단계 수요를 확인합니다."
              />
              <ProxyMetricTile
                label="단가·제품믹스"
                value={`${signed(semiconductor.demand.metrics.dram_unit_value.yoy_3m_avg)}%`}
                detail="단위중량당 수출액 · 3개월 평균 YoY"
                tone={thesisSignalTone(exportDecomposition.state)}
                help="관세청 DRAM 수출액을 신고 중량으로 나눈 값입니다. 가격뿐 아니라 HBM 등 고부가 제품 비중 변화가 함께 반영됩니다."
              />
              <ProxyMetricTile
                label="SK하이닉스 재고/매출"
                value={skHynixInventory?.inventory_to_revenue == null
                  ? "-"
                  : `${skHynixInventory.inventory_to_revenue.toFixed(1)}%`}
                detail={`현재 비율은 참고값 · ${inventoryBurdenLabel(supplierInventory.state)}`}
                tone="neutral"
                help="분기말 재고를 같은 분기 매출로 나눈 값입니다. 전년동기 변화는 공시 파생 맥락이며 물리적 재고 소진량이 아닙니다."
              />
            </div>
            {hbmProxy.conflicts.length > 0 && (
              <p className="mt-3 text-[11px] leading-5 text-warning">
                엇갈리는 근거 · {hbmProxy.conflicts.map(plainLanguageStateText).join(" · ")}
              </p>
            )}
          </ThesisEvidenceCard>
          </div>
        </section>

        <section
          id="ai-thesis-confirmation-panel"
          aria-labelledby="ai-thesis-confirmation-title"
          hidden={activeStage !== "confirmation"}
          className="rounded-xl border bg-muted/5 p-4 sm:p-5"
        >
          <div className="mb-4">
            <h3 id="ai-thesis-confirmation-title" className="text-sm font-semibold">
              실적·재고 확인 상세
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              수출 구조, 기업 실적과 광의 재고가 메모리 병목 판정을 지지하거나 반박하는지 확인합니다.
            </p>
          </div>
          <div className="grid items-start gap-3 lg:grid-cols-3">
            <ThesisEvidenceCard
              id="exports"
              title="DRAM 수출 구조"
              role="확인축 · DRAM 칩과 후공정 수요"
              state={exportStructureStateLabel(exportDecomposition.state)}
              tone={thesisSignalTone(exportDecomposition.state)}
              detail={exportDecomposition.reason}
              asOf={semiconductor.demand.metrics.dram.observation_date}
              help="DRAM 칩 수출액을 주축으로 MCP와 DRAM 모듈 수출을 확인합니다. 신고중량은 bit 출하량이 아니어서 감소만으로 약화 판정을 내리지 않고, 단위중량당 수출액도 가격·제품믹스 맥락으로만 사용합니다."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <ProxyMetricTile
                  label="DRAM 칩 수출액"
                  value={`${signed(semiconductor.demand.metrics.dram.yoy_3m_avg)}%`}
                  detail={`3개월 평균 YoY · 최근 3M ${signed(semiconductor.demand.metrics.dram.sequential_3m)}%`}
                  tone={thesisSignalTone(semiconductor.demand.state)}
                />
                <ProxyMetricTile
                  label="MCP 수출액"
                  value={`${signed(semiconductor.demand.metrics.mcp.yoy_3m_avg)}%`}
                  detail="복합구조칩 · 3개월 평균 YoY"
                  tone={semiconductor.demand.metrics.mcp.yoy_3m_avg == null ? "neutral" : semiconductor.demand.metrics.mcp.yoy_3m_avg >= 15 ? "positive" : semiconductor.demand.metrics.mcp.yoy_3m_avg < 0 ? "negative" : "neutral"}
                />
                <ProxyMetricTile
                  label="DRAM 모듈 수출액"
                  value={`${signed(semiconductor.demand.metrics.dram_module.yoy_3m_avg)}%`}
                  detail="DRAM 모듈 · 3개월 평균 YoY"
                  tone={semiconductor.demand.metrics.dram_module.yoy_3m_avg == null ? "neutral" : semiconductor.demand.metrics.dram_module.yoy_3m_avg >= 15 ? "positive" : semiconductor.demand.metrics.dram_module.yoy_3m_avg < 0 ? "negative" : "neutral"}
                />
                <ProxyMetricTile
                  label="신고중량(참고)"
                  value={`${signed(semiconductor.demand.metrics.dram_weight.yoy_3m_avg)}%`}
                  detail="패키징 포함 순중량 · bit 출하량 아님"
                  tone="neutral"
                />
              </div>
            </ThesisEvidenceCard>

          <ThesisEvidenceCard
            id="companies"
            title="국내 2사 실적 확인"
            role="확인축 · 공시 실적"
            state={companyConfirmationStateLabel(semiconductor.company_confirmation.state)}
            tone={companyTone}
            detail={semiconductor.company_confirmation.reason}
            asOf={companyAsOf}
            className="lg:col-span-2"
            help={<>OpenDART 연결재무제표의 매출·영업이익·재고를 기업 보조축으로 확인합니다. CAPEX는 미래 공급 확대와 현금흐름 부담의 양면성이 있어 판정에 합산하지 않습니다.</>}
          >
            <p className="mb-3 text-xs leading-5 text-muted-foreground">
              삼성전자는 전사 수치로 메모리 부문 단독 실적이 아닙니다.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {semiconductor.company_confirmation.companies.map((company) => {
                const inventory = supplierInventory.companies.find(
                  (item) => item.id === company.id,
                );
                return (
                  <CompanyFilingCard
                    key={company.id}
                    company={company}
                    inventory={inventory}
                    compact
                  />
                );
              })}
            </div>
          </ThesisEvidenceCard>

          <ThesisEvidenceCard
            id="inventory"
            title="한국 반도체 완제품 재고"
            role="상충축 · 광의 반도체 재고"
            state={supplyStateLabel(semiconductor.supply.state)}
            tone={supplyTone}
            detail={semiconductor.supply.reason}
            asOf={semiconductor.supply.metrics.inventory.observation_date}
            className="lg:col-span-3"
            help={<>KOSIS C261 반도체 제조업의 완제품 생산·출하·재고입니다. DRAM·HBM 제품별 재고가 아니며, 역사적 재고 수준과 재고/출하 비율이 높고 누적이 2개월 이상 지속될 때만 재고 부담으로 판정합니다.</>}
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["생산", semiconductor.supply.metrics.production.yoy],
                ["출하", semiconductor.supply.metrics.shipments.yoy],
                ["재고", semiconductor.supply.metrics.inventory.yoy],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-md bg-background/35 px-2 py-3">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {signed(value as number | null)}%
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border/70 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">재고 수준</p>
                <p className="mt-1 text-xs font-medium tabular-nums">
                  {semiconductor.supply.context.inventory_percentile == null
                    ? "-"
                    : `${semiconductor.supply.context.inventory_percentile.toFixed(0)}백분위`}
                </p>
              </div>
              <div className="rounded-md border border-border/70 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">재고/출하</p>
                <p className="mt-1 text-xs font-medium tabular-nums">
                  {semiconductor.supply.context.inventory_shipments_ratio_percentile == null
                    ? "-"
                    : `${semiconductor.supply.context.inventory_shipments_ratio_percentile.toFixed(0)}백분위`}
                </p>
              </div>
              <div className="rounded-md border border-border/70 px-2 py-2">
                <p className="text-[10px] text-muted-foreground">재고 3개월</p>
                <p className="mt-1 text-xs font-medium tabular-nums">
                  {signed(semiconductor.supply.context.inventory_change_3m)}%
                </p>
              </div>
            </div>
          </ThesisEvidenceCard>
          </div>
        </section>

        <section
          id="ai-thesis-power-panel"
          aria-labelledby="ai-thesis-power-title"
          hidden={activeStage !== "power"}
        >
          <div className="mb-3">
            <div className="flex items-center gap-1">
              <h3 id="ai-thesis-power-title" className="scroll-mt-20 text-sm font-semibold">후속 전력 인프라 근거</h3>
              <InfoTip label="전력 인프라 전달경로 해석">
                다섯 축은 관찰 순서대로 배치했지만 서로 다른 원자료와 판정식을 사용합니다.
                화살표는 인과관계나 병목 확정을 뜻하지 않으며, 수요 확대가 실제 계통 부담과
                투자 실행으로 이어지는지를 단계별로 확인하기 위한 읽기 순서입니다.
              </InfoTip>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              수요 확대가 계통 운영 압력, 발전·저장 건설, 공급측 접속 대기와 송전 투자에서
              각각 확인되는지 봅니다. AI·DRAM 핵심판정을 대체하지 않습니다.
            </p>
          </div>
          <ThesisEvidenceCard
            id="power-detail"
            title="미국 전력 인프라 전달경로"
            role="후속 인프라 투자 근거"
            state={powerStateLabel(power.state)}
            tone={powerTone}
            detail={power.reason}
            asOf={power.decision_as_of_date || powerDemand?.observation_date || power.metrics.commercial_sales.observation_date}
            className="w-full"
            help={<>{power.methodology} {power.limitations}</>}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 xl:gap-4">
              <PowerEvidenceAxis
                step={1}
                title="전력 수요 압력"
                state={powerDemandAxisLabel(powerDemand?.state)}
                value={`${signed(powerDemand?.national_yoy_84d ?? power.metrics.total_sales.yoy_3m_avg)}%`}
                detail={`미국 전체 84일 YoY · AI 관찰지역 ${signed(powerDemand?.ai_regions_yoy_84d)}%`}
                asOf={powerDemand?.observation_date}
                tone={powerMetricTone}
                sourceLabel="EIA-930 실제수요"
                sourceUrl={powerDemand?.source_url || power.source_url}
              />
              <PowerEvidenceAxis
                step={2}
                title="계통 운영 압력"
                state={powerOperationsAxisLabel(powerOperations?.state)}
                value={`${signed(powerOperations?.forecast_surprise_pct)}%`}
                detail={`실제수요-하루전 예측 · 부담 관찰지역 ${powerOperations?.pressure_region_count ?? "-"}/${powerOperations?.expected_region_count ?? "-"}`}
                asOf={powerOperations?.observation_date}
                tone={powerOperationsMetricTone}
                sourceLabel="EIA-930 운영 프록시"
                sourceUrl={powerOperations?.source_url || power.source_url}
              />
              <PowerEvidenceAxis
                step={3}
                title="발전·저장 건설"
                state={powerSupplyAxisLabel(powerSupply?.state)}
                value={`${signed(powerSupply?.net_additions_24m_gw)} GW`}
                detail={`24개월 건설 중 추가-예정 은퇴 · 운영설비 대비 ${signed(powerSupply?.net_pipeline_ratio_24m_pct)}%`}
                asOf={powerSupply?.observation_date}
                tone={powerConstructionMetricTone}
                sourceLabel="EIA-860M 공사단계"
                sourceUrl={powerSupply?.source_url || power.source_url}
              />
              <PowerEvidenceAxis
                step={4}
                title="발전 공급 접속 대기"
                state={interconnectionAxisLabel(powerInterconnection?.state)}
                value={powerInterconnection?.metrics.active_queue_gw
                  ? `${powerInterconnection.metrics.active_queue_gw.value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} GW`
                  : "-"}
                detail={`공급측 발전·저장 접속 신청 · 연결계약 체결 비중 ${powerInterconnection?.metrics.ia_executed_share_pct ? `${powerInterconnection.metrics.ia_executed_share_pct.value.toFixed(1)}%` : "-"}`}
                asOf={powerInterconnection?.observation_date}
                tone={powerInterconnectionMetricTone}
                sourceLabel="LBNL Queued Up · 공급측 접속대기"
                sourceUrl={powerInterconnection?.provenance.source_url}
              />
              <PowerEvidenceAxis
                step={5}
                title="송전 투자 실행"
                state={transmissionInvestmentAxisLabel(powerTransmission?.state)}
                value={powerTransmission?.metrics.like_for_like_three_year_cagr_pct
                  ? `${signed(powerTransmission.metrics.like_for_like_three_year_cagr_pct.value)}%`
                  : "-"}
                detail={`동일 보고자 3년 연평균 · 최근 연간 추가액 ${powerTransmission?.metrics.annual_additions_usd ? billions(powerTransmission.metrics.annual_additions_usd.value / 1_000_000_000) : "-"}`}
                asOf={powerTransmission?.observation_date}
                tone={powerTransmissionMetricTone}
                sourceLabel="PUDL 처리 FERC Form 1 · 송전 투자"
                sourceUrl={powerTransmission?.provenance.source_url}
              />
            </div>
          </ThesisEvidenceCard>
        </section>

        <details
          className="group rounded-xl border bg-muted/10"
          data-thesis-evidence="auxiliary"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-sm font-medium">보조 지표·원자료</p>
              <p className="mt-1 text-xs text-muted-foreground">
                NAND 보조축 · 관측 데이터 {connected}/{observationScopes.length} · 원본 출처
              </p>
            </div>
            <ChevronDown
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="space-y-5 border-t p-4 sm:p-5">
            <ThesisSignalRow
              label="보조 · 공개 NAND 가격"
              state={nandPriceStateLabel(memory.nand_state)}
              detail={memory.nand_reason}
              tone={memoryPriceTone(memory.nand_state)}
            />

            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                관측 데이터 범위
              </p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {observationScopes.map((item) => {
                const tone = availabilityTone(item.status);
                return (
                  <div key={item.name} className="rounded-lg bg-background/35 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-xs font-medium leading-5">{item.name}</p>
                      <Badge className="shrink-0" variant={TONE_STYLES[tone].badge}>{observationStatusLabel(item.status)}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{item.role}</p>
                  </div>
                );
              })}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
              <span>원본 데이터</span>
              <a href={memory.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">DRAM 가격</a>
              <a href={memory.nand_source_url || memory.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">NAND 가격</a>
              {semiconductor.demand.source_url && <a href={semiconductor.demand.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">관세청 수출</a>}
              <a href={semiconductor.supply.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">KOSIS 생산·재고</a>
              <a href={semiconductor.company_confirmation.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">OpenDART 공시</a>
              <a href={power.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">EIA 전력 수요·운영·설비</a>
              {powerInterconnection?.provenance.source_url && <a href={powerInterconnection.provenance.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">LBNL 공급측 접속대기</a>}
              {powerTransmission?.provenance.source_url && <a href={powerTransmission.provenance.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">PUDL 처리 FERC Form 1</a>}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function SnapshotPanel(props: CurrentOverviewProps) {
  const data = props.data;
  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer list-none p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1">
              <p className="font-semibold">현재 상태 기록</p>
              <InfoTip label="상태 기록 기준">
                버튼을 누른 시각의 판정, 전체 계산 입력 이력과 관측일, 규칙
                버전, 수집원 상태 및 점검 신호를 함께 저장합니다. 저장하면 현재
                충족된 점검 기준도 확인한 것으로 처리되며, 같은 기준은 새 변화가
                생길 때 다시 알립니다.
              </InfoTip>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 판정과 계산 입력을 기록합니다.
            </p>
          </div>
          <span className={props.snapshotSavedAt ? "text-sm text-success" : "text-sm text-primary"}>
            {props.snapshotSavedAt ? "기록 완료" : "기록 열기"}
          </span>
        </div>
      </summary>
      <div className="border-t p-6">
        <div className="grid gap-3 rounded-lg bg-muted/40 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground">평가 시각</p>
            <p className="mt-1">
              {new Date(data.evaluated_at).toLocaleString("ko-KR")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">가장 최근 관측일</p>
            <p className="mt-1">{data.macro_quadrant.as_of_date || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">관측일 범위</p>
            <p className="mt-1">
              {data.data_quality.observation_range.from || "-"} ~{" "}
              {data.data_quality.observation_range.to || "-"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">마지막 데이터 수집시각</p>
            <p className="mt-1">
              {data.data_quality.last_fetched_at
                ? new Date(data.data_quality.last_fetched_at).toLocaleString(
                    "ko-KR",
                  )
                : "-"}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          저장하면 현재 활성 신호를 확인 처리하며, 같은 신호는 변화가 생길 때 다시 알립니다.
          {props.snapshotSavedAt
            ? ` · 최근 저장 ${new Date(props.snapshotSavedAt).toLocaleString("ko-KR")}`
            : ""}
        </p>
        <div className="mt-5 grid gap-3 lg:grid-cols-[260px_1fr_auto]">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={props.judgment}
            onChange={(event) =>
              props.onJudgment(event.target.value as RegimeLevel | "")
            }
          >
            <option value="">내 판정 (선택)</option>
            {LEVELS.map((item) => (
              <option key={item} value={item}>{regimeLevelLabel(item)}</option>
            ))}
          </select>
          <Textarea
            value={props.note}
            onChange={(event) => props.onNote(event.target.value)}
            placeholder="판단 메모 (선택)"
          />
          <Button onClick={props.onSnapshot} disabled={props.snapshotPending}>
            <Save className="mr-2 h-4 w-4" />현재 상태 기록
          </Button>
        </div>
      </div>
    </details>
  );
}

export function RegimeCurrentOverview(props: CurrentOverviewProps) {
  return (
    <div className="space-y-8">
      <DecisionHeader data={props.data} />
      <ChangeInbox data={props.data} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <MacroQuadrant data={props.data.macro_quadrant} />
        <EvidencePanel data={props.data} />
      </div>
      <FinancialTransmission data={props.data} />
      <AiThesisMonitor data={props.data} />
      <UpcomingEvents data={props.data} />
      <SnapshotPanel {...props} />
      <DataConnectionStatus data={props.data} />
    </div>
  );
}
