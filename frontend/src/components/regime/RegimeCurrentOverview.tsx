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
  TONE_STYLES,
  aiCapexDeltaTone,
  aiCapexTone,
  availabilityTone,
  dataQualityTone,
  financialConditionTone,
  memoryPriceTone,
  powerDemandTone,
  regimeLevelTone,
  thesisSignalTone,
  type SemanticTone,
} from "@/lib/regime-tone";
import { MacroQuadrant } from "./MacroQuadrant";
import { CompanyFilingCard } from "./CompanyFilingCard";
import type { RegimeCurrent, RegimeLevel } from "@/types";

const LEVELS: RegimeLevel[] = ["유지", "경계", "약화", "전환"];
export const FINANCIAL_TRANSMISSION_HELP: Record<string, string> = {
  "정책 긴축":
    "기준금리에서 Core PCE 전년비를 뺀 실질 정책금리로 단기 정책의 제약 강도를 봅니다. 실질 정책금리가 0%p 이상이면 다소 제한적, 1%p 이상이면 제한적으로 분류합니다. 높은 값은 수요와 차입 부담을 누르는 힘을 뜻하지만 침체 판정 자체는 아닙니다.",
  "장기금리 전달":
    "10년 명목금리를 실질금리(TIPS)와 기대인플레이션(BEI)으로 나눠 장기 할인율 부담을 봅니다. 상태 점수는 TIPS 절대수준으로 계산합니다. 기간 프리미엄(TP)은 금리 상승 원인을 해석하는 보조 추정치이며 TIPS에 다시 더하지 않습니다.",
  "최근 금리 충격":
    "명목 10년·TIPS·BEI의 공통 관측일을 맞춘 뒤 20관측일과 63관측일 변화를 비교합니다. TIPS 급등은 실질 할인율 충격, 명목금리와 BEI의 동반 급등은 인플레이션 기대 충격으로 읽습니다. 변화가 작으면 절대 금리수준이 낮다는 뜻은 아닙니다.",
  "수익률곡선 선행위험":
    "10Y-3M 스프레드의 최근 21관측일 평균을 뉴욕 연은 공개 probit 식에 넣어 향후 12개월 침체확률을 계산합니다. 10Y-2Y는 같은 신호의 확인축이며 별도 경보로 중복 합산하지 않습니다. 역전 해소 직후에도 최대 252관측일 동안 선행위험을 단계적으로 유지합니다.",
  "신용·금융여건":
    "HY(하이일드)·IG(투자등급) OAS는 국채 대비 회사채 추가금리이고, NFCI는 0이 장기 평균입니다. 스프레드가 넓어지거나 NFCI가 0 위로 올라가면 자금조달 여건이 긴축되는 방향입니다. 완화적이라는 표시는 신용시장의 제약이 낮다는 뜻이지 통화정책 자체가 완화적이라는 뜻은 아닙니다.",
};
export type CurrentOverviewProps = {
  data: RegimeCurrent;
  judgment: RegimeLevel | "";
  note: string;
  snapshotPending: boolean;
  onJudgment: (value: RegimeLevel | "") => void;
  onNote: (value: string) => void;
  onSnapshot: () => void;
};
const signed = (value: number | null | undefined, digits = 1) =>
  value == null ? "-" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;

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
      label: "판정 불가",
      detail: `투자 ${data.ai_capex.state} · DRAM 주축 미확인`,
      tone: "neutral",
    };
  }
  if (semiconductor.state === "경계") {
    return {
      label: "가설 경계",
      detail: `투자 ${data.ai_capex.state} · DRAM ${dram.state}`,
      tone: "caution",
    };
  }
  if (semiconductor.state === "확장 확인" && data.ai_capex.state === "감속 관찰") {
    return {
      label: "병목 지속 · 투자 감속",
      detail: `투자 ${data.ai_capex.state} · DRAM ${dram.state}`,
      tone: "caution",
    };
  }
  if (
    semiconductor.state === "확장 확인"
    && ["혼조", "판정 불가", "판정 제한"].includes(data.ai_capex.state)
  ) {
    return {
      label: "반도체 강세 · 투자 판정 대기",
      detail: `투자 ${data.ai_capex.state} · DRAM ${dram.state}`,
      tone: "caution",
    };
  }
  if (semiconductor.state === "확장 확인" && supplyWarning) {
    return {
      label: "확장 우세 · 재고 경계",
      detail: `DRAM ${dram.state} · 완제품 ${semiconductor.supply.state}`,
      tone: "caution",
    };
  }
  if (semiconductor.state === "확장 확인") {
    return {
      label: "확장 확인",
      detail: `투자 ${data.ai_capex.state} · DRAM ${dram.state}`,
      tone: "positive",
    };
  }
  return {
    label: "신호 혼조",
    detail: `투자 ${data.ai_capex.state} · DRAM ${dram.state}`,
    tone: "neutral",
  };
}

function DecisionHeader({ data }: { data: RegimeCurrent }) {
  const limited = data.data_quality.status !== "충분";
  const eventFeedAvailable = ["success", "partial"].includes(
    data.feed_health?.events?.status || "",
  );
  const title = data.needs_new_review
    ? "지금 다시 상세점검하세요"
    : data.review_urgency === "watch"
      ? eventFeedAvailable
        ? "다음 발표까지 관찰하세요"
        : "관찰을 유지하세요"
      : "새 상세점검 사유 없음";
  const detail = data.needs_new_review
    ? data.review_reasons[0] || "중요 임계조건이 충족됐습니다."
    : limited
      ? "경보는 없지만 데이터 공백 때문에 정상 확정은 제한됩니다."
      : "마지막 상태 기록 이후 새 임계신호나 심각도 상승이 없습니다.";
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
  const environment = `${data.macro_quadrant.growth_level?.label || "성장 판정 불가"} · 물가 ${data.macro_quadrant.inflation_level?.label || "판정 불가"} / 최근 압력 ${pressure?.direction || legacyDirection}`;
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
  const thesis = aiThesisOverview(data);
  return (
    <Card className={data.needs_new_review ? "border-red-400/50" : ""}>
      <CardContent className="p-7">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(330px,1.65fr)_repeat(4,minmax(130px,1fr))]">
          <div className="flex gap-4">
            {calm ? (
              <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle
                className={`mt-1 h-7 w-7 shrink-0 ${data.needs_new_review ? "text-red-400" : "text-amber-400"}`}
              />
            )}
            <div>
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <span>포트폴리오 점검</span>
                <InfoTip label="상세점검 판단의 범위">
                  상세 포트폴리오 분석을 다시 실행할 시점을 알립니다. 이 판단이
                  포트폴리오 비중을 자동으로 변경하지는 않습니다.
                </InfoTip>
              </div>
              <h2 className="mt-1 text-2xl font-bold">{title}</h2>
              <p className="mt-2 text-sm font-medium">{environment}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {detail}
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-muted/25 p-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>AI 투자 가설</span>
              <InfoTip label="AI 투자 가설 상태의 범위">
                하이퍼스케일러 투자, 메모리 가격·수요, 국내 수급과 기업
                확인을 분리해 요약합니다. 거시 자동 레짐에는 합산하지 않습니다.
              </InfoTip>
            </div>
            <p className={`mt-2 text-lg font-semibold ${TONE_STYLES[thesis.tone].text}`}>
              {thesis.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {thesis.detail}
            </p>
          </div>
          <div className="rounded-lg bg-muted/25 p-4">
            <p className="text-xs text-muted-foreground">확정 점검 레짐</p>
            <p className={`mt-2 text-xl font-semibold ${TONE_STYLES[automaticTone].text}`}>
              {data.automatic_regime}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              현재 후보{" "}
              <span className={TONE_STYLES[candidateTone].text}>
                {data.candidate_regime}
              </span>{" "}
              · 자동 매매 아님
            </p>
          </div>
          <div className="rounded-lg bg-muted/25 p-4">
            <p className="text-xs text-muted-foreground">현재 경제상태</p>
            <p className="mt-2 text-xl font-semibold">
              {data.macro_quadrant.environment_point?.label ||
                data.macro_quadrant.environment_label ||
                (data.macro_quadrant.growth_level &&
                data.macro_quadrant.inflation_level
                  ? `${data.macro_quadrant.growth_level.label}·물가 ${data.macro_quadrant.inflation_level.label}`
                  : "판정 불가")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              점=현재 수준 · 화살표=최근 상대 방향
            </p>
          </div>
          <div className="rounded-lg bg-muted/25 p-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>자료 상태</span>
              <InfoTip label="핵심지표 사용 가능 비율">
                등록된 핵심지표 중 현재 계산에 사용할 수 있고 허용된 최신성
                범위 안에 있는 비율입니다. 예측 정확도나 빈티지 완결도는 아닙니다.
              </InfoTip>
            </div>
            <p className={`mt-2 text-xl font-semibold ${TONE_STYLES[qualityTone].text}`}>
              {data.data_quality.status}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              미국 판정입력 {macroCoverage.usable}/{macroCoverage.total}
            </p>
          </div>
        </div>
        {data.review_acknowledged && (
          <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
            마지막 상태 기록에서 당시 경보를 확인했습니다. 새 경보 또는 심각도
            상승이 생기면 다시 알립니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeInbox({ data }: { data: RegimeCurrent }) {
  const items = [
    ...data.triggers.map((trigger) => ({
      key: trigger.rule_id,
      label: trigger.severity === "critical" ? "긴급 임계" : "활성 임계",
      text: trigger.summary,
      tone:
        trigger.severity === "critical"
          ? ("destructive" as const)
          : ("warning" as const),
    })),
    ...(data.changes_since_snapshot || []).map((text, index) => ({
      key: `change-${index}`,
      label: "상태 변화",
      text,
      tone: "info" as const,
    })),
    ...(data.thesis_changes_since_snapshot || []).map((text, index) => ({
      key: `thesis-change-${index}`,
      label: "AI 가설 변화",
      text,
      tone: "info" as const,
    })),
    ...(data.data_quality.status !== "충분"
      ? data.data_quality.reasons.map((text, index) => ({
          key: `quality-${index}`,
          label: "데이터",
          text,
          tone: "warning" as const,
        }))
      : []),
    ...(data.data_quality.auxiliary_stale || []).map((item) => ({
      key: `aux-stale-${item.id}`,
      label: "보조자료 오래됨",
      text: `${item.name}: 최신 관측 ${item.observation_date || "미확인"}`,
      tone: "warning" as const,
    })),
  ];
  const visible = items.slice(0, 5);
  const remaining = items.slice(5);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1">
          <CardTitle>현재 점검 항목</CardTitle>
          <InfoTip label="현재 점검 항목 구성">
            현재 활성화된 임계신호, 마지막 공식 상태 기록 이후 영역 판정 변화,
            현재 데이터 공백을 함께 표시합니다. 활성 임계신호는 상태 기록 이후
            새로 생긴 것만을 뜻하지 않습니다.
          </InfoTip>
        </div>
        <p className="text-sm text-muted-foreground">
          거시 임계신호 · AI 가설 변화 · 마지막 기록 이후 데이터 공백
        </p>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="divide-y">
            {visible.map((item) => (
              <li
                key={item.key}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Badge variant={item.tone}>{item.label}</Badge>
                <p className="text-sm leading-5">{item.text}</p>
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
                        <Badge variant={item.tone}>{item.label}</Badge>
                        <p className="text-sm leading-5">{item.text}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            현재 활성 임계신호, 영역 변화 또는 주요 데이터 공백이 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function UpcomingEvents({ data }: { data: RegimeCurrent }) {
  const domainName: Record<string, string> = {
    growth: "성장·고용",
    inflation: "물가",
    rates: "금리",
  };
  const feed = data.feed_health?.events;
  const degraded =
    feed && ["failed", "partial", "configuration_required"].includes(feed.status);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <CardTitle>다음 미국 주요 발표</CardTitle>
          <InfoTip label="발표 일정 출처">
            세인트루이스 연은 FRED가 제공하는 미래 발표일을 사용합니다. API가
            시각을 제공하지 않은 일정에는 임의의 시간을 붙이지 않습니다. 발표
            직후 새로고침하면 관련 지표와 판정을 다시 계산합니다.
          </InfoTip>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {degraded && (
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-4">
            <p className="text-sm font-medium text-amber-200">
              {feed.status === "partial" ? "일부 일정만 갱신됨" : "발표 일정 갱신 지연"}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {feed.status === "partial"
                ? "확인된 일정과 마지막 정상 캐시를 함께 표시합니다."
                : "마지막으로 정상 수집한 일정이 있으면 계속 표시합니다."}
            </p>
          </div>
        )}
        {data.upcoming_events.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.upcoming_events.slice(0, 2).map((event) => {
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {schedule.secondary}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {event.affected_domains.map((item) => domainName[item] || item).join(" · ")}
                  </p>
                </a>
              );
            })}
          </div>
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
  const countRateRules = (kind: "level" | "shock" | "curve") =>
    data.triggers.filter(
      (item) =>
        item.domain === "rates" &&
        (kind === "level"
          ? item.rule_id === "tightening.restrictive_level"
          : kind === "curve"
            ? item.evidence_cluster === "yield_curve"
            : item.evidence_cluster !== "yield_curve" &&
              item.rule_id !== "tightening.restrictive_level"),
    ).length;
  const shock20 = conditions?.recent_shock?.change_20d?.changes;
  const curve = conditions?.yield_curve;
  const cards = [
    [
      "정책 긴축",
      conditions?.policy.label || "판정 불가",
      `Fed ${conditions?.policy.fed_funds?.toFixed(2) ?? "-"}% / Core PCE YoY ${conditions?.policy.core_pce_yoy?.toFixed(2) ?? "-"}% / 실질 정책금리 ${signed(conditions?.policy.real_policy_rate, 2)}%p`,
      `${data.coverage.domains.rates.status} ${Math.round(data.coverage.domains.rates.coverage * 100)}%`,
      0,
      financialConditionTone(conditions?.policy.label),
    ],
    [
      "장기금리 전달",
      conditions?.long_rates.label || "판정 불가",
      `10Y ${conditions?.long_rates.nominal_10y?.toFixed(2) ?? "-"}% = TIPS ${conditions?.long_rates.real_10y?.toFixed(2) ?? "-"}% + BEI ${conditions?.long_rates.breakeven_10y?.toFixed(2) ?? "-"}% · TP ${conditions?.long_rates.term_premium?.toFixed(2) ?? "-"}%`,
      conditions?.long_rates.term_premium != null
        ? `TP ${conditions.long_rates.term_premium_label || "맥락"} · ${conditions.long_rates.term_premium.toFixed(2)}%${conditions.long_rates.term_premium_percentile != null ? ` · 10년 표본 ${conditions.long_rates.term_premium_percentile.toFixed(0)}백분위` : ""}`
        : "기간 프리미엄 자료 부족",
      countRateRules("level"),
      financialConditionTone(conditions?.long_rates.label),
    ],
    [
      "최근 금리 충격",
      conditions?.recent_shock?.label || "판정 불가",
      shock20
        ? `20관측일: 명목 ${signed(shock20.us10y, 2)}%p / TIPS ${signed(shock20.tips10y, 2)}%p / BEI ${signed(shock20.bei10y, 2)}%p`
        : "공통 관측일 자료 부족",
      conditions?.recent_shock
        ? `${conditions.recent_shock.direction} 방향 · ${conditions.recent_shock.persistent ? "63관측일에도 지속" : "지속성 미확인"}`
        : "변화 판정 불가",
      countRateRules("shock"),
      financialConditionTone(conditions?.recent_shock?.label),
    ],
    [
      "수익률곡선 선행위험",
      curve?.state || "판정 불가",
      curve?.monthly_average_10y3m != null
        ? `10Y-3M 21관측일 평균 ${signed(curve.monthly_average_10y3m, 2)}%p · 12개월 침체확률 ${curve.recession_probability_12m?.toFixed(1) ?? "-"}%`
        : "10Y-3M 월평균 대용치 자료 부족",
      curve
        ? `10Y-2Y ${curve.confirmation || "미확인"} · ${curve.steepening.state}`
        : "선행위험 판정 불가",
      countRateRules("curve"),
      financialConditionTone(curve?.label),
    ],
    [
      "신용·금융여건",
      conditions?.credit.label || "판정 불가",
      `HY ${conditions?.credit.hy_oas?.toFixed(2) ?? "-"}%p / IG ${conditions?.credit.ig_oas?.toFixed(2) ?? "-"}%p / NFCI ${conditions?.credit.nfci?.toFixed(2) ?? "-"}`,
      `${data.coverage.domains.liquidity.status} ${Math.round(data.coverage.domains.liquidity.coverage * 100)}%`,
      count("liquidity"),
      financialConditionTone(conditions?.credit.label),
    ],
  ] as Array<[string, string, string, string, number, SemanticTone]>;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1">
          <CardTitle>금융 전달경로</CardTitle>
          <InfoTip label="거시 전달경로 모니터 설명">
            정책금리, 장기금리와 신용여건의 현재 절대수준 및 최근 변화를
            함께 확인합니다.
          </InfoTip>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card[0]} className={`rounded-lg border bg-muted/15 p-5 ${TONE_STYLES[card[5]].panel}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-muted-foreground">{card[0]}</p>
                    <InfoTip label={`${card[0]} 설명`} className="h-4 w-4">
                      {FINANCIAL_TRANSMISSION_HELP[card[0]]}
                    </InfoTip>
                  </div>
                  <p className={`mt-2 text-lg font-semibold ${TONE_STYLES[card[5]].text}`}>{card[1]}</p>
                </div>
                {card[4] > 0 && <Badge variant="danger">활성 {card[4]}</Badge>}
              </div>
              <p className="mt-4 text-sm leading-6">{card[2]}</p>
              <p className="mt-4 border-t pt-3 text-xs leading-5 text-muted-foreground">{card[3]}</p>
            </div>
          ))}
        </div>
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
          <Badge className="shrink-0" variant={TONE_STYLES[tone].badge}>
            {state}
          </Badge>
        </div>
        <span className="mt-3 text-sm font-semibold">{title}</span>
        <p className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        <p className="mt-3 text-[10px] text-muted-foreground">기준 {asOf || "미수집"}</p>
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
        <Badge className="shrink-0" variant={TONE_STYLES[tone].badge}>{state}</Badge>
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
        <Badge variant={TONE_STYLES[tone].badge}>{state}</Badge>
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

export function AiThesisMonitor({ data }: { data: RegimeCurrent }) {
  const [activeStage, setActiveStage] = useState<
    "capex" | "dram" | "confirmation" | "power" | null
  >(null);
  const ai = data.ai_capex;
  const memory = data.memory_cycle;
  const semiconductor = data.semiconductor_cycle;
  const power = data.power_cycle;
  const overview = aiThesisOverview(data);
  const dramTone = thesisSignalTone(semiconductor.dram_bottleneck.state);
  const supplyTone = thesisSignalTone(semiconductor.supply.state);
  const companyTone = thesisSignalTone(semiconductor.company_confirmation.state);
  const powerTone = thesisSignalTone(power.state);
  const powerMetricTone = powerDemandTone(power.state, !power.is_stale);
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
    { name: "하이퍼스케일러 총 CAPEX", status: ai.coverage ? "연결" : "제한", role: "AI 투자강도" },
    { name: "공개 DRAM 가격 표본", status: memory.state === "판정 불가" ? "제한" : "연결", role: "DRAM 주 판정 프록시" },
    { name: "한국 DRAM 수출", status: semiconductor.demand.state === "판정 불가" ? "제한" : "연결", role: "DRAM 수요 확인" },
    { name: "공개 NAND 가격 표본", status: memory.nand_state === "판정 불가" ? "제한" : "연결", role: "메모리 보조축" },
    { name: "한국 반도체 완제품 재고", status: semiconductor.supply.state === "판정 불가" ? "제한" : "연결", role: "광의 보조지표" },
    { name: "국내 2사 실적", status: semiconductor.company_confirmation.state === "판정 불가" ? "제한" : "연결", role: "기업 보조축" },
    { name: "미국 전력 수요", status: power.state === "판정 불가" ? "제한" : "연결", role: "후속 인프라 맥락" },
    {
      name: "HBM·서버 DRAM",
      status: hbmProxy.state === "판정 제한" ? "제한" : "간접 관측",
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
  const aiIncreasingCount = ai.companies.filter(
    (item) => (item.yoy || 0) > 0,
  ).length;
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
                공시·완제품 재고를 확인축으로 사용합니다. 전력 수요는 후속 맥락이며 자동
                거시 레짐이나 포트폴리오 비중을 직접 바꾸지 않습니다.
              </InfoTip>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              AI 투자 지속성에서 메모리 병목, 확인·상충 증거, 후속 전력 수요까지 한 흐름으로
              점검합니다.
            </p>
            <p className={`mt-2 text-sm font-medium ${TONE_STYLES[overview.tone].text}`}>
              현재 요약 · {overview.detail}
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
              투자 확대가 메모리 병목과 실적 확인을 거쳐 전력 수요로 이어지는지를 단계별로 봅니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
            <ThesisPipelineStep
              id="capex"
              step={1}
              title="하이퍼스케일러 투자"
              role="AI 투자"
              state={ai.state}
              detail={`전년 대비 CAPEX 증가 기업 ${aiIncreasingCount}/${ai.companies.length}`}
              tone={aiCapexTone(ai.state)}
              asOf={ai.as_of_range?.to}
              active={activeStage === "capex"}
              panelId="ai-thesis-capex-panel"
              onToggle={() => toggleStage("capex")}
            />
            <ThesisPipelineStep
              id="dram"
              step={2}
              title="DRAM·HBM 병목"
              role="메모리 수급"
              state={semiconductor.dram_bottleneck.state}
              detail={`공개 DRAM ${memory.state} · HBM 간접계측 ${hbmProxy.state}`}
              tone={dramTone}
              asOf={semiconductor.demand.metrics.dram.observation_date || memoryDates.at(-1)}
              active={activeStage === "dram"}
              panelId="ai-thesis-dram-panel"
              onToggle={() => toggleStage("dram")}
            />
            <ThesisPipelineStep
              id="confirmation"
              step={3}
              title="실적·재고 확인"
              role="확인·상충"
              state={thesisConflicts.length > 0 ? `상충 ${thesisConflicts.length}` : "확인"}
              detail={`${semiconductor.company_confirmation.state} · 완제품 ${semiconductor.supply.state}`}
              tone={confirmationTone}
              asOf={confirmationAsOf}
              active={activeStage === "confirmation"}
              panelId="ai-thesis-confirmation-panel"
              onToggle={() => toggleStage("confirmation")}
            />
            <ThesisPipelineStep
              id="power"
              step={4}
              title="전력 후속 수요"
              role="후속 인프라"
              state={power.state}
              detail={`상업용 판매 ${signed(power.metrics.commercial_sales.yoy_3m_avg)}% · 3개월 평균 YoY`}
              tone={powerTone}
              asOf={power.metrics.total_sales.observation_date}
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
            <span className="font-semibold text-warning">상충 신호 {thesisConflicts.length}</span>
            <span className="ml-2 leading-6 text-muted-foreground">
              {thesisConflicts.join(" · ")}
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
            title="하이퍼스케일러 CAPEX"
            role="핵심축 · 투자 강도"
            state={ai.state}
            tone={aiCapexTone(ai.state)}
            detail={ai.reason}
            asOf={ai.as_of_range?.to}
            className="w-full"
            help={<>SEC 공시의 기업 전체 현금 CAPEX를 회사별 회계분기로 비교합니다. AI 전용 금액은 분리되지 않으므로 투자 강도의 프록시입니다. {ai.methodology}</>}
          >
            <p className="text-lg font-semibold">
              증가 기업 {aiIncreasingCount}/{ai.companies.length}
            </p>
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
            <h3 id="ai-thesis-dram-title" className="text-sm font-semibold">메모리 병목 상세</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              공개 DRAM 가격과 HBM·서버 DRAM 간접계측을 함께 확인합니다.
            </p>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-12">

          <ThesisEvidenceCard
            id="dram-core"
            title="DRAM 수급 핵심축"
            role="핵심축 · 반도체 주 판정"
            state={semiconductor.dram_bottleneck.state}
            tone={dramTone}
            detail={semiconductor.dram_bottleneck.reason}
            asOf={semiconductor.demand.metrics.dram.observation_date || memoryDates.at(-1)}
            className="xl:col-span-5"
            help={<>{semiconductor.dram_bottleneck.methodology} 공개 가격은 DDR5 모듈 표본이며 HBM·Server DRAM을 직접 대표하지 않습니다. 수출액에는 가격과 물량 효과가 함께 포함됩니다.</>}
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(190px,0.55fr)]">
              <ThesisSignalRow
                label="주축 · 공개 DRAM 가격"
                state={memory.state === "가격 상승" ? "상승" : memory.state}
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
            state={hbmProxy.state}
            tone={thesisSignalTone(hbmProxy.state)}
            detail={hbmProxy.reason}
            asOf={rdimm.observation_date}
            className="xl:col-span-7"
            help={<>{hbmProxy.methodology}. {hbmProxy.limitations}. HBM 직접가격이 아니라 여러 독립 프록시가 같은 방향인지 확인합니다.</>}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <ProxyMetricTile
                label="서버 RDIMM"
                value={`${signed(rdimm.change_percent, 2)}%`}
                detail={`${rdimm.state} · ${rdimm.observation_date || "미수집"}`}
                tone={memoryPriceTone(rdimm.state)}
                help="공개 DDR5 RDIMM 모듈 가격표의 최근 표기 변화율입니다. 서버 DRAM 계약가격이나 HBM 가격을 직접 뜻하지 않습니다."
              />
              <ProxyMetricTile
                label="수출 단가·믹스"
                value={`${signed(semiconductor.demand.metrics.dram_unit_value.yoy_3m_avg)}%`}
                detail="단위중량당 수출액 · 3개월 평균 YoY"
                tone={thesisSignalTone(exportDecomposition.state)}
                help="관세청 DRAM 수출액을 신고 중량으로 나눈 값입니다. 가격뿐 아니라 HBM 등 고부가 제품 비중 변화가 함께 반영됩니다."
              />
              <ProxyMetricTile
                label="수출중량"
                value={`${signed(semiconductor.demand.metrics.dram_weight.yoy_3m_avg)}%`}
                detail="신고 중량 · 3개월 평균 YoY"
                tone="neutral"
                help="관세청 신고 중량으로 bit 출하량과 동일하지 않습니다. 패키징과 제품 믹스 영향을 받아 수요 확인용 보조값으로만 사용합니다."
              />
              <ProxyMetricTile
                label="SK하이닉스 재고/매출"
                value={skHynixInventory?.inventory_to_revenue == null
                  ? "-"
                  : `${skHynixInventory.inventory_to_revenue.toFixed(1)}%`}
                detail={`수준은 중립 · ${inventoryBurdenLabel(supplierInventory.state)}`}
                tone="neutral"
                help="분기말 재고를 같은 분기 매출로 나눈 값입니다. 전년동기 변화는 공시 파생 맥락이며 물리적 재고 소진량이 아닙니다."
              />
            </div>
            {hbmProxy.conflicts.length > 0 && (
              <p className="mt-3 text-[11px] leading-5 text-warning">
                상충 확인 · {hbmProxy.conflicts.join(" · ")}
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
              role="확인축 · 가격과 제품 믹스"
              state={exportDecomposition.state}
              tone={thesisSignalTone(exportDecomposition.state)}
              detail={exportDecomposition.reason}
              asOf={semiconductor.demand.metrics.dram.observation_date}
              help="관세청 신고 수출액·중량과 단위중량당 수출액을 함께 봅니다. 신고 중량은 bit 출하량과 같지 않으므로 구조 확인용 보조값입니다."
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <ProxyMetricTile
                  label="DRAM 수출액"
                  value={`${signed(semiconductor.demand.metrics.dram.yoy_3m_avg)}%`}
                  detail="3개월 평균 YoY"
                  tone={thesisSignalTone(semiconductor.demand.state)}
                />
                <ProxyMetricTile
                  label="수출중량"
                  value={`${signed(semiconductor.demand.metrics.dram_weight.yoy_3m_avg)}%`}
                  detail="신고 중량 · 3개월 평균 YoY"
                  tone="neutral"
                />
                <ProxyMetricTile
                  label="수출 단가·믹스"
                  value={`${signed(semiconductor.demand.metrics.dram_unit_value.yoy_3m_avg)}%`}
                  detail="단위중량당 수출액 · 3개월 평균 YoY"
                  tone={thesisSignalTone(exportDecomposition.state)}
                />
              </div>
            </ThesisEvidenceCard>

          <ThesisEvidenceCard
            id="companies"
            title="국내 2사 실적 확인"
            role="확인축 · 공시 실적"
            state={semiconductor.company_confirmation.state}
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
            state={semiconductor.supply.state}
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
            <h3 id="ai-thesis-power-title" className="text-sm font-semibold">후속 인프라</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              전력 수요는 AI·DRAM 판정에 합산하지 않고 병목이 후속 산업으로 확장되는지 봅니다.
            </p>
          </div>
          <ThesisEvidenceCard
            id="power-detail"
            title="미국 전력 수요"
            role="후속 인프라 맥락"
            state={power.state}
            tone={powerTone}
            detail={power.reason}
            asOf={power.metrics.total_sales.observation_date}
            className="w-full"
            help={<>{power.methodology} {power.limitations} 전력 수요는 AI 투자와 별개의 맥락 지표이며 데이터센터 계통 병목을 직접 판정하지 않습니다.</>}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-background/35 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">총 전력판매</p>
                <p
                  className={`mt-1 text-lg font-semibold tabular-nums ${TONE_STYLES[powerMetricTone].text}`}
                  data-metric-label="총 전력판매"
                  data-semantic-tone={powerMetricTone}
                >
                  {signed(power.metrics.total_sales.yoy_3m_avg)}%
                </p>
                <p className="text-[10px] text-muted-foreground">3개월 평균 YoY</p>
              </div>
              <div className="rounded-md bg-background/35 px-3 py-3">
                <p className="text-[11px] text-muted-foreground">상업용 판매</p>
                <p
                  className={`mt-1 text-lg font-semibold tabular-nums ${TONE_STYLES[powerMetricTone].text}`}
                  data-metric-label="상업용 판매"
                  data-semantic-tone={powerMetricTone}
                >
                  {signed(power.metrics.commercial_sales.yoy_3m_avg)}%
                </p>
                <p className="text-[10px] text-muted-foreground">3개월 평균 YoY</p>
              </div>
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
              state={memory.nand_state}
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
                      <Badge className="shrink-0" variant={TONE_STYLES[tone].badge}>{item.status}</Badge>
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
              <a href={power.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">EIA 전력</a>
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
                버전, 수집원 상태 및 점검 신호를 함께 저장합니다. 저장하면 당시
                활성 경보도 확인한 것으로 처리되며, 같은 경보는 새 변화가 생길
                때 다시 알립니다.
              </InfoTip>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 판정과 계산 입력을 기록합니다.
            </p>
          </div>
          <span className="text-sm text-primary">기록 열기</span>
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
        <div className="mt-5 grid gap-3 lg:grid-cols-[180px_1fr_auto]">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={props.judgment}
            onChange={(event) =>
              props.onJudgment(event.target.value as RegimeLevel | "")
            }
          >
            <option value="">내 판정 (선택)</option>
            {LEVELS.map((item) => (
              <option key={item}>{item}</option>
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
      <AiThesisMonitor data={props.data} />
      <FinancialTransmission data={props.data} />
      <UpcomingEvents data={props.data} />
      <SnapshotPanel {...props} />
    </div>
  );
}
