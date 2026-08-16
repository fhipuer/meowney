import { AlertTriangle, CalendarClock, CheckCircle2, Database, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/ui/info-tip";
import { MacroQuadrant } from "./MacroQuadrant";
import type { RegimeCurrent, RegimeLevel } from "@/types";

const LEVELS: RegimeLevel[] = ["유지", "경계", "약화", "전환"];
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

function DecisionHeader({ data }: { data: RegimeCurrent }) {
  const limited = data.data_quality.status !== "충분";
  const title = data.needs_new_review
    ? "지금 다시 상세점검하세요"
    : data.review_urgency === "watch"
      ? "다음 발표까지 관찰하세요"
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
  return (
    <Card className={data.needs_new_review ? "border-red-400/50" : ""}>
      <CardContent className="p-7">
        <div className="grid gap-4 lg:grid-cols-[minmax(390px,1.8fr)_repeat(3,minmax(135px,1fr))]">
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
            <p className="text-xs text-muted-foreground">확정 거시 상태</p>
            <p className="mt-2 text-xl font-semibold">
              {data.automatic_regime}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              현재 후보 {data.candidate_regime} · 미국 거시 전용
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
            <p className="mt-2 text-xl font-semibold">
              {data.data_quality.status}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              핵심지표 사용 가능 {data.signals.filter((item) => item.status !== "unavailable").length}/{data.signals.length}
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
          : ("secondary" as const),
    })),
    ...(data.changes_since_snapshot || []).map((text, index) => ({
      key: `change-${index}`,
      label: "상태 변화",
      text,
      tone: "outline" as const,
    })),
    ...(data.data_quality.status !== "충분"
      ? data.data_quality.reasons.map((text, index) => ({
          key: `quality-${index}`,
          label: "데이터",
          text,
          tone: "outline" as const,
        }))
      : []),
  ].slice(0, 3);
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
          활성 임계신호 · 마지막 기록 이후 영역 변화 · 데이터 공백
        </p>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Badge variant={item.tone}>{item.label}</Badge>
                <p className="text-sm leading-5">{item.text}</p>
              </li>
            ))}
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

function UpcomingEvents({ data }: { data: RegimeCurrent }) {
  const domainName: Record<string, string> = {
    growth: "성장·고용",
    inflation: "물가",
    rates: "금리",
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <CardTitle>다음 미국 BLS 발표</CardTitle>
          <InfoTip label="발표 일정 출처">
            미국 노동통계국(BLS)의 공식 발표 캘린더를 한국시간으로 변환합니다.
            발표 직후 새로고침하면 관련 지표와 판정을 다시 계산합니다.
          </InfoTip>
        </div>
      </CardHeader>
      <CardContent>
        {data.upcoming_events.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.upcoming_events.slice(0, 2).map((event) => (
              <a
                key={event.id}
                href={event.source_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border bg-muted/20 p-4 transition-colors hover:border-primary/40"
              >
                <p className="font-medium">{event.event_type}</p>
                <p className="mt-2 text-sm text-primary">
                  {new Date(event.scheduled_at).toLocaleString("ko-KR", {
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {event.affected_domains.map((item) => domainName[item] || item).join(" · ")}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            발표 일정을 아직 동기화하지 않았습니다. 데이터 새로고침으로 불러올 수 있습니다.
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
}: {
  title: string;
  contributors: Array<{ id: string; name: string; weighted_z: number }>;
  positive: string;
  negative: string;
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
                  item.weighted_z > 0 ? "text-amber-300" : "text-sky-300"
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
          />
          <DriverList
            title="인플레이션 모멘텀"
            contributors={current?.inflation.contributors || []}
            positive="상승압력 기여"
            negative="완화압력 기여"
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

function FinancialTransmission({ data }: { data: RegimeCurrent }) {
  const conditions = data.macro_quadrant.financial_conditions;
  const count = (domain: string) =>
    data.triggers.filter((item) => item.domain === domain).length;
  const countRateRules = (includeRestrictive: boolean) =>
    data.triggers.filter(
      (item) =>
        item.domain === "rates" &&
        (includeRestrictive
          ? item.rule_id === "tightening.restrictive_level"
          : item.rule_id !== "tightening.restrictive_level"),
    ).length;
  const cards = [
    [
      "정책 긴축",
      conditions?.policy.label || "판정 불가",
      `Fed ${conditions?.policy.fed_funds?.toFixed(2) ?? "-"}% / Core PCE YoY ${conditions?.policy.core_pce_yoy?.toFixed(2) ?? "-"}% / 실질 정책금리 ${signed(conditions?.policy.real_policy_rate, 2)}%p`,
      `${data.coverage.domains.rates.status} ${Math.round(data.coverage.domains.rates.coverage * 100)}%`,
      countRateRules(true),
    ],
    [
      "장기금리 전달",
      conditions?.long_rates.label || "판정 불가",
      `10Y ${conditions?.long_rates.nominal_10y?.toFixed(2) ?? "-"}% = TIPS ${conditions?.long_rates.real_10y?.toFixed(2) ?? "-"}% + BEI ${conditions?.long_rates.breakeven_10y?.toFixed(2) ?? "-"}% · TP ${conditions?.long_rates.term_premium?.toFixed(2) ?? "-"}%`,
      data.rate_decomposition
        ? `20일 ${data.rate_decomposition.driver} · 명목 ${signed(data.rate_decomposition.nominal_change, 2)}%p`
        : "변화 분해 자료 부족",
      countRateRules(false),
    ],
    [
      "신용·금융여건",
      conditions?.credit.label || "판정 불가",
      `HY ${conditions?.credit.hy_oas?.toFixed(2) ?? "-"}%p / IG ${conditions?.credit.ig_oas?.toFixed(2) ?? "-"}%p / NFCI ${conditions?.credit.nfci?.toFixed(2) ?? "-"}`,
      `${data.coverage.domains.liquidity.status} ${Math.round(data.coverage.domains.liquidity.coverage * 100)}%`,
      count("liquidity"),
    ],
  ] as Array<[string, string, string, string, number]>;
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
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
          {cards.map((card) => (
            <div key={card[0]} className="rounded-lg border bg-muted/15 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{card[0]}</p>
                  <p className="mt-2 text-lg font-semibold">{card[1]}</p>
                </div>
                {card[4] > 0 && <Badge variant="destructive">활성 {card[4]}</Badge>}
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

function ThesisPanel({ data }: { data: RegimeCurrent }) {
  const ai = data.ai_capex;
  const memory = data.memory_cycle;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>AI 인프라 관측범위</CardTitle>
          <Badge variant="outline">부분 관측</Badge>
          <InfoTip label="AI 인프라 관측범위 설명">
            연결된 자동 데이터와 아직 연결되지 않은 핵심 병목을 함께 표시합니다.
            공시 CAPEX는 기업 전체 투자액이므로 AI 전용 금액과 동일하지 않습니다.
          </InfoTip>
        </div>
        <p className="text-sm text-muted-foreground">
          자동화된 보조지표와 아직 판단에 사용하지 않는 데이터 공백을 구분합니다.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))]">
          {[
            ["하이퍼스케일러 총 CAPEX", "연결", "AI 투자강도 보조"],
            ["공개 DRAM 가격 표본", memory.state === "판정 불가" ? "제한" : "연결", "가격 방향 보조"],
            ["공개 NAND 가격 표본", memory.nand_state === "판정 불가" ? "제한" : "연결", "가격 방향 보조"],
            ["Server DRAM", "미연결", "종합판정 미사용"],
            ["HBM", "미연결", "종합판정 미사용"],
          ].map((item) => (
            <div key={item[0]} className="rounded-lg bg-muted/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-medium leading-5">{item[0]}</p>
                <Badge className="shrink-0 whitespace-nowrap" variant={item[1] === "연결" ? "secondary" : "outline"}>{item[1]}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{item[2]}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
          <div className="rounded-lg border bg-muted/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">공시 총 CAPEX</p>
              <Badge variant={ai.coverage >= 0.75 ? "secondary" : "outline"}>{ai.state}</Badge>
            </div>
            <p className="mt-3 text-xl font-semibold">{ai.coverage ? `증가 기업 ${ai.companies.filter((item) => (item.yoy || 0) > 0).length}/${ai.companies.length}` : "데이터 미연결"}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{ai.reason}</p>
            <div className="mt-4 grid gap-2 text-xs [grid-template-columns:repeat(auto-fit,minmax(125px,1fr))]">
              {ai.companies.map((company) => (
                <div key={company.id} className="rounded-md bg-muted/30 px-3 py-2">
                  <span className="block text-muted-foreground">{company.name}</span>
                  <span className="mt-1 block font-medium text-foreground">
                    {company.yoy == null ? "-" : `${company.yoy > 0 ? "+" : ""}${company.yoy.toFixed(0)}% YoY`}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">공개 DRAM 가격 표본</p>
              <Badge variant={memory.state === "판정 불가" ? "outline" : "secondary"}>{memory.state === "가격 상승" ? "상승" : memory.state}</Badge>
            </div>
            <p className="mt-3 text-sm font-medium leading-5">{memory.reason}</p>
            <a href={memory.source_url} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-primary hover:underline">
              TrendForce 공개 DRAM 가격표
            </a>
          </div>
          <div className="rounded-lg border bg-muted/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">공개 NAND 가격 표본</p>
              <Badge variant={memory.nand_state === "판정 불가" ? "outline" : "secondary"}>{memory.nand_state}</Badge>
            </div>
            <p className="mt-3 text-sm font-medium leading-5">{memory.nand_reason}</p>
            <a href={memory.nand_source_url || memory.source_url} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-primary hover:underline">
              TrendForce 공개 NAND 가격표
            </a>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
          <span>자동 판정: 총 CAPEX·공개 DRAM·공개 NAND 표본</span>
          <InfoTip label="자동 판정 방법">
            {ai.methodology} DRAM과 NAND는 공개 가격표의 동일 상품 변화 방향을
            별도로 계산합니다.
          </InfoTip>
        </div>
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
                버튼을 누른 시각의 판정, 지표별 표시값과 관측일, 규칙 버전 및
                점검 신호를 저장합니다. 저장하면 당시 활성 경보도 확인한 것으로
                처리되며, 같은 경보는 새 변화가 생길 때 다시 알립니다.
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
      <FinancialTransmission data={props.data} />
      <ThesisPanel data={props.data} />
      <UpcomingEvents data={props.data} />
      <SnapshotPanel {...props} />
    </div>
  );
}
