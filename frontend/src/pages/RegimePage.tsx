import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, HelpCircle, Database, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MarketIndicators } from "@/components/dashboard/MarketIndicators";
import { RegimeCurrentOverview } from "@/components/regime/RegimeCurrentOverview";
import { CompanyFilingCard } from "@/components/regime/CompanyFilingCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/ui/info-tip";
import { regimeApi } from "@/lib/api";
import { inventoryBurdenLabel, priorInventoryRatio } from "@/lib/regime-company";
import {
  aiCapexStateLabel,
  companyConfirmationStateLabel,
  domainStateLabel,
  dramBottleneckStateLabel,
  durationStressDriverLabel,
  durationStressLabel,
  exportDemandStateLabel,
  exportStructureStateLabel,
  hbmProxyStateLabel,
  longRatePressureLabel,
  macroEnvironmentLabel,
  memoryPriceStateLabel,
  momentumDirectionLabel,
  nandPriceStateLabel,
  plainLanguageStateText,
  policyPressureLabel,
  powerDemandAxisLabel,
  powerOperationsAxisLabel,
  powerStateLabel,
  powerSupplyAxisLabel,
  interconnectionAxisLabel,
  transmissionInvestmentAxisLabel,
  rateDriverLabel,
  ratePressureLabel,
  recentRateShockLabel,
  rdimmStateLabel,
  regimeLevelLabel,
  reviewUrgencyLabel,
  semiconductorStateLabel,
  signalStatusLabel,
  supplyStateLabel,
  yieldCurveChangeLabel,
  yieldCurveRiskLabel,
  yieldCurveStateLabel,
} from "@/lib/regime-display";
import {
  REGIME_SERIES_COLORS,
  TONE_STYLES,
  aiCapexDeltaTone,
  aiCapexTone,
  financialConditionTone,
  memoryPriceTone,
  memorySupplierPriceDeltaTone,
  powerConstructionTone,
  powerDemandTone,
  powerInterconnectionTone,
  powerOperationsTone,
  powerTransmissionTone,
  regimeLevelTone,
  signalMetricTone,
  signalStatusTone,
  thesisSignalTone,
  type SemanticTone,
} from "@/lib/regime-tone";
import type {
  RegimeCurrent,
  RegimeLevel,
  RegimeSignal,
  RegimeSnapshot,
} from "@/types";

const LEVELS: RegimeLevel[] = ["유지", "경계", "약화", "전환"];
const DOMAIN_TABS = [
  { id: "market", label: "시장" },
  { id: "growth", label: "성장·고용" },
  { id: "inflation", label: "물가" },
  { id: "rates", label: "금리" },
  { id: "liquidity", label: "유동성·신용" },
  { id: "ai", label: "AI 투자" },
  { id: "semiconductor", label: "메모리·반도체" },
  { id: "power", label: "전력 인프라" },
];
const MACRO_DOMAIN_TABS = DOMAIN_TABS.slice(0, 5);
const THESIS_DOMAIN_TABS = DOMAIN_TABS.slice(5);
const RATE_SIGNAL_ORDER = [
  "fedfunds",
  "us3m",
  "us2y",
  "us10y",
  "us30y",
  "tips10y",
  "tips30y",
  "bei10y",
  "curve10y3m",
  "curve2s10s",
  "term_premium",
];
const RATE_SIGNAL_GROUPS = [
  {
    id: "policy",
    title: "정책금리와 단기금리",
    description: "Fed 정책 수준과 3개월·2년 구간에 반영된 단기 자금조달 부담",
    ids: ["fedfunds", "us3m", "us2y"],
  },
  {
    id: "nominal-long",
    title: "명목 장기금리",
    description: "경제 전반의 할인율을 보여주는 10년물과 장기 듀레이션 부담을 보여주는 30년물",
    ids: ["us10y", "us30y"],
  },
  {
    id: "real-inflation",
    title: "실질금리와 기대인플레이션",
    description: "10년·30년 실질 할인율과 명목 10년 금리의 기대인플레이션 성분",
    ids: ["tips10y", "tips30y", "bei10y"],
  },
  {
    id: "curve-context",
    title: "수익률곡선과 기간 프리미엄",
    description: "침체 선행 신호인 장단기 금리차와 장기금리 상승 원인을 설명하는 보조 추정치",
    ids: ["curve10y3m", "curve2s10s", "term_premium"],
  },
];
const signed = (value: number | null | undefined, digits = 1) =>
  value == null ? "-" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;

export function signalRuleHelp(signal: RegimeSignal) {
  if (signal.id === "us_unemployment")
    return "최근 3개월 실업률 변화로 판정합니다. 실업률 상승은 악화 방향, 하락은 개선 방향입니다.";
  if (signal.id === "us_claims")
    return "미국 신규실업수당의 4주 평균입니다. 성장·고용 영역은 최근 13주 변화율을 사용하고, 조기경보는 전년 대비 52주 변화가 +15% 이상인지 별도로 확인합니다. 상승은 악화 방향입니다.";
  if (
    ["cpi", "core_cpi", "pce", "core_pce", "ppi", "wages"].includes(signal.id)
  )
    return "최근 3개월 연율을 사용합니다. 물가·임금 상승세 재가속은 악화 방향, 목표 수준을 향한 둔화는 개선 방향입니다.";
  if (signal.id === "fedfunds")
    return "Fed 기준금리에서 Core PCE 전년비를 뺀 실질 정책금리 대용치로 단기금리가 수요를 얼마나 누르는지 봅니다. 0~1%p는 약한 수요 억제, 1%p 이상은 뚜렷한 수요 억제로 표시합니다.";
  if (signal.id === "tips10y")
    return "10년 실질금리의 높은 절대수준으로 장기 할인율 부담을 계산하고, 공통 관측일 기준 20·63관측일 상승폭으로 최근 실질금리 충격을 별도 판정합니다.";
  if (["us30y", "tips30y"].includes(signal.id))
    return "미 재무부의 30년 명목·실질금리입니다. 30년 실질금리 수준, 최근 20·63관측일 변화와 30Y-10Y 금리차가 함께 높아질 때 장기 듀레이션 경보에 사용하며, 10년 실질금리와 별도 거시영역으로 중복 합산하지 않습니다.";
  if (signal.id === "term_premium")
    return "Kim-Wright 현재 10년 제로쿠폰 기간 프리미엄 추정치입니다. 장기금리 상승 원인을 해석하는 맥락 지표이며 TIPS와 중복해 자동 점수에 더하지 않습니다.";
  if (signal.id === "curve10y3m")
    return "핵심 침체 선행축입니다. 최근 21관측일 평균을 뉴욕 연은 공개 probit 식에 넣어 향후 12개월 침체확률을 계산하며, 역전 해소 뒤에도 위험 기억을 단계적으로 유지합니다.";
  if (signal.id === "curve2s10s")
    return "10Y-3M 침체 선행신호의 확인축입니다. 동반 역전 여부만 보조하며 같은 수익률곡선 근거를 별도 경보로 중복 합산하지 않습니다.";
  if (signal.id === "us3m")
    return "FRED 미국 3개월 국채금리(DGS3MO)입니다. SGOV가 보유한 0~3개월 단기국채의 금리환경을 참고하는 값이며 SGOV ETF 자체의 분배수익률·SEC yield·총수익률은 아닙니다. 금리곡선 해석에만 사용하고 단독 레짐 점수로 쓰지 않습니다.";
  if (["us10y", "bei10y"].includes(signal.id))
    return "TIPS와 공통 관측일을 맞춘 20·63관측일 변화로 최근 금리 충격의 원인을 분해합니다. 명목금리와 BEI의 동반 급등은 인플레이션 기대 충격으로 판정합니다.";
  if (["us3m", "us2y"].includes(signal.id))
    return "금리곡선의 현재 모양과 재가팔라짐 원인을 해석하는 맥락 지표입니다. 단기금리 하락 주도와 장기금리 상승 주도를 구분하며 단독 레짐 점수로 쓰지 않습니다.";
  if (["hy_oas", "ig_oas", "nfci"].includes(signal.id))
    return "현재 절대수준을 중심으로 판정합니다. 신용스프레드·NFCI 상승은 악화 방향이며, 장단기금리차는 역전 폭 확대가 악화 방향입니다.";
  if (
    [
      "us_gdp",
      "us_payrolls",
      "us_retail",
      "us_indpro",
      "fed_assets",
      "bank_reserves",
    ].includes(signal.id)
  )
    return "주로 12개월 변화율을 사용합니다. 성장·고용·생산·유동성 증가는 개선 방향, 감소는 악화 방향입니다.";
  return "판정 기간과 개선·악화 방향은 지표별 규칙을 따릅니다. 아래 판정 근거에서 이번 계산에 사용된 기간과 값을 확인할 수 있습니다.";
}

const formatDate = (value: string) => value.slice(2, 7).replace("-", ".");
const formatNumber = (value: number) =>
  Math.abs(value) >= 1000
    ? value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })
    : value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

function ChangeMetric({
  label,
  value,
  unit = "%",
  tone = "neutral",
}: {
  label: string;
  value?: number | null;
  unit?: string;
  tone?: SemanticTone;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-sm font-medium tabular-nums ${TONE_STYLES[tone].text}`}
        data-metric-label={label}
        data-semantic-tone={tone}
      >
        {value == null
          ? "-"
          : `${value > 0 ? "↑ " : value < 0 ? "↓ " : ""}${value > 0 ? "+" : ""}${value.toFixed(1)}${unit}`}
      </p>
    </div>
  );
}

function SignalCard({ signal }: { signal: RegimeSignal }) {
  const history = signal.history || [];
  const metrics = signal.display_metrics || [];
  const decisionChart = signal.decision_chart;
  const chartData = decisionChart?.points || history;
  const chartSeries = decisionChart?.series || [
    { key: "value", label: signal.name },
  ];
  const chartColors = [
    REGIME_SERIES_COLORS.blue,
    REGIME_SERIES_COLORS.violet,
    REGIME_SERIES_COLORS.cyan,
  ];
  const role =
    signal.usage === "regime"
      ? "자동 판정에 사용"
      : signal.usage === "trigger"
        ? "점검 기준에만 사용"
        : "참고자료";
  const roleSentence =
    signal.usage === "regime"
      ? "자동 판정에 사용합니다."
      : signal.usage === "trigger"
        ? "상세점검 기준에만 사용합니다."
        : "현재 환경을 설명하는 참고자료입니다.";
  const status =
    signal.is_stale
      ? `판정 제외 · ${signal.age_days ?? "-"}일 경과`
      : signal.usage === "display" && signal.status !== "unavailable"
      ? "자동 판정에 사용하지 않음"
      : signalStatusLabel(signal);
  const tone = signalStatusTone(
    signal.status,
    signal.is_stale || signal.usage === "display",
  );
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{signal.name}</CardTitle>
              <Badge variant="outline" className="whitespace-normal text-center text-[10px] font-normal leading-4">
                {role}
              </Badge>
              {signal.proxy_for && (
                <Badge variant="neutral" className="whitespace-normal text-center text-[10px] font-normal leading-4">
                  SGOV 금리환경 참고
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {signal.source.toUpperCase()} · 관측{" "}
              {signal.observation_date || "미수집"} · {signal.display_period}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge
              className="max-w-[180px] whitespace-normal text-right leading-4"
              variant={TONE_STYLES[tone].badge}
            >
              {status}
            </Badge>
            <InfoTip label={`${signal.name} ${signal.usage === "display" ? "사용 범위" : "판정 기준"}`}>
              {signal.usage === "display"
                ? "현재 환경을 해석하는 참고자료입니다. 자동 레짐이나 상세점검 기준 계산에는 사용하지 않으며, 최신 저장값만 보여줍니다."
                : `${signalRuleHelp(signal)} 현재 판정 근거: ${plainLanguageStateText(signal.reason)}. 현재 카드는 최신 저장값을 표시하며 초기 발표값과 수정 이력은 시점기준 이력으로 별도 보관합니다.`}
              {signal.is_stale
                ? ` 최신 관측이 허용기간 ${signal.max_age_days ?? "-"}일을 넘어 현재 자동 판정에서 제외됐습니다.`
                : ""}
            </InfoTip>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold">
            {signal.value == null ? "-" : formatNumber(signal.value)}
          </span>
          <span className="text-xs text-muted-foreground">{signal.unit}</span>
        </div>
        <div
          className={`grid gap-2 ${metrics.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}
        >
          {metrics.map((metric) => (
            <ChangeMetric
              key={`${metric.label}-${metric.unit}`}
              label={metric.label}
              value={metric.value}
              unit={metric.unit}
              tone={signalMetricTone(
                signal.id,
                metric.kind,
                metric.value,
                !signal.is_stale,
              )}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <details className="group rounded-lg border bg-muted/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
            <span className="font-medium">
              {decisionChart ? "판정에 사용한 차트" : "원자료 추이"}
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              {decisionChart?.title || signal.display_period} · 펼쳐보기
            </span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">
              접기
            </span>
          </summary>
          <div className="border-t p-3">
            {decisionChart?.title && (
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                {decisionChart.title} · 단위 {decisionChart.unit}
              </p>
            )}
            {chartData.length > 1 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 12, bottom: 8, left: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      opacity={0.2}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      minTickGap={34}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      width={58}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatNumber}
                    />
                    <Tooltip
                      labelFormatter={(label) => `관측일 ${label}`}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    {decisionChart?.reference_lines.map((reference) => (
                      <ReferenceLine
                        key={`${reference.label}-${reference.value}`}
                        y={reference.value}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                        label={{ value: reference.label, fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      />
                    ))}
                    {chartSeries.map((series, index) => (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        name={series.label}
                        stroke={chartColors[index % chartColors.length]}
                        dot={false}
                        activeDot={{ r: 4 }}
                        strokeWidth={2}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}
                    {chartSeries.length > 1 && <Legend />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                차트를 그릴 관측값이 부족합니다.
              </div>
            )}
          </div>
        </details>
        <div className="mt-3 flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {plainLanguageStateText(signal.reason)} · {roleSentence}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RateComparison({ signals }: { signals: RegimeSignal[] }) {
  const requiredIds = ["us10y", "tips10y", "bei10y"];
  const selected = signals.filter((signal) =>
    requiredIds.includes(signal.id),
  );
  const byDate = new Map<string, Record<string, string | number>>();
  selected.forEach((signal) =>
    signal.history?.forEach((point) => {
      byDate.set(point.date, {
        ...(byDate.get(point.date) || { date: point.date }),
        [signal.id]: point.value,
      });
    }),
  );
  const chartData = [...byDate.values()]
    .filter((point) => requiredIds.every((id) => typeof point[id] === "number"))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!chartData.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1">
          <CardTitle>미국 10년 금리의 수준 구성</CardTitle>
          <InfoTip label="10년 금리 구성 읽는 법">
            명목 10년 금리는 실질금리(TIPS)와 기대인플레이션(BEI)의 합으로
            나눠 봅니다. 기간 프리미엄은 별도 추정치이며 최근 금리 변화의
            원인은 거시 전달경로에서 확인합니다.
          </InfoTip>
        </div>
        <p className="text-sm text-muted-foreground">
          명목 10Y ≈ 실질 10Y(TIPS) + 기대인플레이션(BEI) · 동일 관측일만 비교
        </p>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 20, bottom: 8, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                minTickGap={38}
                tick={{ fontSize: 11 }}
              />
              <YAxis width={52} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                labelFormatter={(label) => `관측일 ${label}`}
                contentStyle={{
                  background: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="us10y"
                name="10Y 명목"
                stroke={REGIME_SERIES_COLORS.blue}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="tips10y"
                name="10Y 실질"
                stroke={REGIME_SERIES_COLORS.violet}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="bei10y"
                name="10Y BEI"
                stroke={REGIME_SERIES_COLORS.cyan}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function LongEndComparison({ signals }: { signals: RegimeSignal[] }) {
  const requiredIds = ["us10y", "us30y", "tips10y", "tips30y"];
  const selected = signals.filter((signal) => requiredIds.includes(signal.id));
  const byDate = new Map<string, Record<string, string | number>>();
  selected.forEach((signal) =>
    signal.history?.forEach((point) => {
      byDate.set(point.date, {
        ...(byDate.get(point.date) || { date: point.date }),
        [signal.id]: point.value,
      });
    }),
  );
  const chartData = [...byDate.values()]
    .filter((point) => requiredIds.every((id) => typeof point[id] === "number"))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!chartData.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1">
          <CardTitle>미국 장기금리 10Y·30Y</CardTitle>
          <InfoTip label="장기금리 비교 읽는 법">
            10년물은 경제 전반의 장기 할인율, 30년물은 듀레이션·재정·국채 공급
            부담이 더 강하게 반영되는 구간입니다. 실질 30년물 상승과 30Y-10Y
            확대가 함께 나타나는지를 별도 경보로 확인합니다.
          </InfoTip>
        </div>
        <p className="text-sm text-muted-foreground">
          실선은 명목금리 · 점선은 실질금리 · 미 재무부 공통 관측일
        </p>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 20, bottom: 8, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={38} tick={{ fontSize: 11 }} />
              <YAxis width={52} tick={{ fontSize: 11 }} unit="%" domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={(label) => `관측일 ${label}`}
                contentStyle={{
                  background: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="us10y" name="10Y 명목" stroke={REGIME_SERIES_COLORS.blue} dot={false} strokeWidth={1.8} isAnimationActive={false} />
              <Line type="monotone" dataKey="us30y" name="30Y 명목" stroke={REGIME_SERIES_COLORS.cyan} dot={false} strokeWidth={2.2} isAnimationActive={false} />
              <Line type="monotone" dataKey="tips10y" name="10Y 실질" stroke={REGIME_SERIES_COLORS.violet} strokeDasharray="5 4" dot={false} strokeWidth={1.6} isAnimationActive={false} />
              <Line type="monotone" dataKey="tips30y" name="30Y 실질" stroke="#f59e0b" strokeDasharray="5 4" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function RateSignalGroups({ signals }: { signals: RegimeSignal[] }) {
  const byId = new Map(signals.map((signal) => [signal.id, signal]));
  return (
    <div className="space-y-10">
      {RATE_SIGNAL_GROUPS.map((group) => {
        const items = group.ids
          .map((id) => byId.get(id))
          .filter((signal): signal is RegimeSignal => Boolean(signal));
        if (!items.length) return null;
        const columns = items.length === 2
          ? "md:grid-cols-2"
          : items.length >= 3
            ? "md:grid-cols-2 xl:grid-cols-3"
            : "grid-cols-1";
        return (
          <section key={group.id} data-rate-group={group.id}>
            <div className="mb-4 border-l-2 border-primary/60 pl-3">
              <div className="flex items-center gap-1">
                <h3 className="font-semibold">{group.title}</h3>
                <InfoTip label={`${group.title} 증감값 읽는 법`}>
                  원시 금리의 상승·하락만으로 투자환경의 긍정·부정을 정하지
                  않습니다. 숫자는 방향 그대로 중립색으로 표시하고, 현재 제약
                  수준·최근 충격·수익률곡선처럼 경제적 맥락이 계산된 판정에만
                  의미 색상을 사용합니다.
                </InfoTip>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
            </div>
            <div className={`grid gap-5 ${columns}`}>
              {items.map((signal) => <SignalCard key={signal.id} signal={signal} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function RateModelOverview({
  data,
  signals,
}: {
  data: RegimeCurrent;
  signals: RegimeSignal[];
}) {
  const conditions = data.macro_quadrant.financial_conditions;
  const rates = conditions?.rates;
  const policy = conditions?.policy;
  const longRates = conditions?.long_rates;
  const shock = conditions?.recent_shock;
  const duration = conditions?.duration_stress;
  const curve = conditions?.yield_curve;
  const curveSignals = signals.filter((signal) =>
    ["curve10y3m", "curve2s10s"].includes(signal.id),
  );
  const byDate = new Map<string, Record<string, string | number>>();
  curveSignals.forEach((signal) =>
    signal.history?.forEach((point) => {
      byDate.set(point.date, {
        ...(byDate.get(point.date) || { date: point.date }),
        [signal.id]: point.value,
      });
    }),
  );
  const curveChartData = [...byDate.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  const shock20 = shock?.change_20d?.changes;
  const tone = financialConditionTone(rates?.label);
  const durationLevelTone: SemanticTone =
    duration?.level_label === "장기채 부담 높음"
      ? "negative"
      : duration?.level_label === "장기채 부담 관찰"
        ? "caution"
        : duration?.level_label === "장기채 부담 낮음"
          ? "positive"
          : "neutral";
  const durationRecentTone = financialConditionTone(
    duration?.recent_label || duration?.label,
  );

  return (
    <Card className={`mb-6 ${TONE_STYLES[tone].panel}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1">
              <CardTitle>금리 환경 판단</CardTitle>
              <InfoTip label="금리 환경 판단 방법">
                현재 금리 수준이 수요와 차입을 얼마나 누르는지, 최근 금리가 추가로
                얼마나 움직였는지, 과거 장단기 금리 역전의 침체 선행 신호가 남아
                있는지와 30년물의 현재 수준·최근 추가 충격을 따로 계산합니다. 네 결과 중 투자환경에 가장 큰 부담을
                금리 영역 판정에 반영하며 같은 경제적 근거는 중복 합산하지 않습니다.
              </InfoTip>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 금리 부담 · 최근 추가 충격 · 30년물 수준과 방향 · 수익률곡선 선행 신호를 분리해 매일 재계산
            </p>
          </div>
          <div className="text-right">
            <Badge variant={TONE_STYLES[tone].badge}>
              {ratePressureLabel(rates?.label)}
            </Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              가장 큰 부담: {rateDriverLabel(rates?.driver)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
        <div className="grid gap-3">
          <div className="rounded-lg border bg-muted/10 p-4">
            <p className="text-xs font-medium text-muted-foreground">1 · 현재 금리 부담</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <strong className="min-w-0 leading-6">{policyPressureLabel(policy?.label)}</strong>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                실질 정책 {signed(policy?.real_policy_rate, 2)}%p
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              장기 실질금리 {longRates?.real_10y?.toFixed(2) ?? "-"}% · {longRatePressureLabel(longRates?.label)}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/10 p-4">
            <p className="text-xs font-medium text-muted-foreground">2 · 최근 추가 금리 충격</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <strong className="min-w-0 leading-6">{recentRateShockLabel(shock?.label)}</strong>
              <span className="shrink-0 text-xs text-muted-foreground">
                {shock?.persistent ? "20·63관측일 지속" : "단기 지속성 미확인"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {shock20
                ? `명목 ${signed(shock20.us10y, 2)} · TIPS ${signed(shock20.tips10y, 2)} · BEI ${signed(shock20.bei10y, 2)}%p`
                : "공통 관측일 자료 부족"}
            </p>
          </div>
          <div className={`rounded-lg border bg-muted/10 p-4 ${TONE_STYLES[durationLevelTone].panel}`}>
            <p className="text-xs font-medium text-muted-foreground">3 · 30년물 현재 부담과 최근 충격</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <strong className={`min-w-0 leading-6 ${TONE_STYLES[durationLevelTone].text}`}>
                {duration?.level_label || "판정 불가"}
              </strong>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                기준 {duration?.as_of_date || conditions?.as_of_date || "-"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              명목 30Y {duration?.nominal_30y?.toFixed(2) ?? "-"}% · 실질 30Y {duration?.real_30y?.toFixed(2) ?? "-"}% · 30Y-10Y {signed(duration?.spread_30y10y, 2)}%p
            </p>
            <div className="mt-3 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">최근 20관측일 추가 충격</span>
                <strong className={`text-sm ${TONE_STYLES[durationRecentTone].text}`}>
                  {durationStressLabel(duration?.recent_label || duration?.label)}
                </strong>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                명목 {signed(duration?.change_20d?.changes.us30y, 2)}%p · 실질 {signed(duration?.change_20d?.changes.tips30y, 2)}%p · 최근 3회 중 {duration?.recent_confirmation_count_3d ?? 0}회 · {durationStressDriverLabel(duration?.driver)}
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/10 p-4">
            <p className="text-xs font-medium text-muted-foreground">4 · 수익률곡선의 침체 선행 신호</p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <strong className="min-w-0 leading-6">{yieldCurveStateLabel(curve?.state)}</strong>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {curve?.recession_probability_12m?.toFixed(1) ?? "-"}%
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              10Y-3M 21관측일 평균 {signed(curve?.monthly_average_10y3m, 2)}%p · {yieldCurveChangeLabel(curve?.steepening.state)}
            </p>
          </div>
          <p className="px-1 text-[11px] leading-5 text-muted-foreground">
            계산 규칙 {rates?.version || "-"} · 사용 가능 자료 {rates ? Math.round(rates.coverage * 100) : 0}%
          </p>
        </div>
        <div className="min-w-0 rounded-lg border bg-muted/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">수익률곡선 최근 1년</p>
              <p className="mt-1 text-xs text-muted-foreground">
                10Y-3M은 주축, 10Y-2Y는 확인축 · 0%p 아래는 역전
              </p>
            </div>
            <Badge variant={TONE_STYLES[financialConditionTone(curve?.label)].badge}>
              {yieldCurveRiskLabel(curve?.label)}
            </Badge>
          </div>
          {curveChartData.length > 1 ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveChartData} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={40} tick={{ fontSize: 11 }} />
                  <YAxis width={52} tick={{ fontSize: 11 }} unit="%p" />
                  <Tooltip
                    labelFormatter={(label) => `관측일 ${label}`}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <ReferenceLine y={0} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: "역전 기준", fill: "#f59e0b", fontSize: 10 }} />
                  <Legend />
                  <Line type="monotone" dataKey="curve10y3m" name="10Y-3M 주축" stroke={REGIME_SERIES_COLORS.blue} strokeWidth={2.2} dot={false} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="curve2s10s" name="10Y-2Y 확인축" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              수익률곡선 이력이 아직 부족합니다.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type AiCapexCompany = RegimeCurrent["ai_capex"]["companies"][number];

export type AiCapexChartPoint = {
  period: string;
  total: number | null;
  coverage: number;
  [key: string]: string | number | null;
};

export function buildAiCapexChartData(
  companies: AiCapexCompany[],
  aggregateHistory: NonNullable<RegimeCurrent["ai_capex"]["aggregate"]>["history"] = [],
  limit = 8,
): AiCapexChartPoint[] {
  const periods = Array.from(
    new Set([
      ...aggregateHistory.map((point) => point.period),
      ...companies.flatMap((company) => company.history.map((point) => point.period)),
    ]),
  ).sort();
  const aggregateByPeriod = new Map(
    aggregateHistory.map((point) => [point.period, point]),
  );

  return periods.slice(-limit).map((period) => {
    const companyValues = Object.fromEntries(
      companies.map((company) => {
        const point = company.history.find((item) => item.period === period);
        return [company.id, point?.value == null ? null : point.value / 1e9];
      }),
    ) as Record<string, number | null>;
    const aggregate = aggregateByPeriod.get(period);
    return {
      period,
      ...companyValues,
      coverage: aggregate?.coverage_count ?? 0,
      total: aggregate?.value_billion ?? null,
    };
  });
}

export function AiCapexDashboard({
  data,
}: {
  data: NonNullable<RegimeCurrent["ai_capex"]>;
}) {
  const aggregate = data.aggregate;
  const chartData = buildAiCapexChartData(data.companies, aggregate?.history);
  const aggregateQoq = aggregate?.qoq;
  const aggregateYoy = aggregate?.yoy;
  const completeCoverage = Boolean(aggregate?.complete && !aggregate.is_stale);
  const colors: Record<string, string> = {
    microsoft: REGIME_SERIES_COLORS.blue,
    alphabet: REGIME_SERIES_COLORS.violet,
    meta: REGIME_SERIES_COLORS.cyan,
    amazon: REGIME_SERIES_COLORS.pink,
  };
  const stateTone = aiCapexTone(data.state);
  return (
    <div className="space-y-6">
      <div className="px-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">하이퍼스케일러 설비투자 프록시</h2>
          <Badge className="max-w-full whitespace-normal text-right leading-4" variant={TONE_STYLES[stateTone].badge}>
            {aiCapexStateLabel(data.state)}
          </Badge>
          <InfoTip label="설비투자 프록시의 범위">
            SEC 공시의 기업 전체 현금 CAPEX입니다. AI 인프라 투자도 포함하지만
            AI 전용 금액은 분리되지 않으므로 투자 강도의 보조지표로 사용합니다.
          </InfoTip>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{data.reason}</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>하이퍼스케일러 분기 CAPEX 추이</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                4사 합산 투자 강도와 기업별 투자금액을 분리해 표시 · 십억 달러
              </p>
            </div>
            {aggregate?.latest_period && (
              <Badge variant="outline">
                최신 합계 {aggregate.coverage_count}/{aggregate.expected_count}개사
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {chartData.length ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border bg-muted/10 p-4">
                  <p className="text-xs text-muted-foreground">최신 4사 합산</p>
                  <p className="mt-2 text-2xl font-semibold text-primary">
                    {aggregate?.latest_value_billion == null ? "-" : `$${aggregate.latest_value_billion.toFixed(1)}B`}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {aggregate?.latest_period
                      ? `판정 기준 ${aggregate.latest_period} · ${aggregate.coverage_count}/${aggregate.expected_count}개사`
                      : "완전 집계 분기 없음"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/10 p-4">
                  <p className="text-xs text-muted-foreground">직전 분기 대비</p>
                  <p className={`mt-2 text-2xl font-semibold ${TONE_STYLES[aiCapexDeltaTone(aggregateQoq, completeCoverage)].text}`}>
                    {aggregateQoq == null ? "-" : `${signed(aggregateQoq, 1)}%`}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    합산 투자 속도의 단기 변화
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/10 p-4">
                  <p className="text-xs text-muted-foreground">전년 동기 대비</p>
                  <p className={`mt-2 text-2xl font-semibold ${TONE_STYLES[aiCapexDeltaTone(aggregateYoy, completeCoverage)].text}`}>
                    {aggregateYoy == null ? "-" : `${signed(aggregateYoy, 1)}%`}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    합산 투자의 구조적 확장 속도
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/10 p-4">
                  <p className="text-xs text-muted-foreground">최근 4분기 합계</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {aggregate?.ttm_billion == null ? "-" : `$${aggregate.ttm_billion.toFixed(1)}B`}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    TTM YoY {aggregate?.ttm_yoy == null ? "-" : `${signed(aggregate.ttm_yoy, 1)}%`}
                  </p>
                </div>
              </div>

              <section aria-labelledby="aggregate-capex-title">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 id="aggregate-capex-title" className="text-sm font-semibold">4사 합산 CAPEX</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      정확히 같은 분기말에 4개사 자료가 모두 있을 때만 합계를 연결합니다.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">선의 기울기 = 합산 투자 속도 변화</span>
                </div>
                <div className="h-56 rounded-lg border bg-muted/[0.04] p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      syncId="ai-capex-quarter"
                      margin={{ top: 12, right: 18, bottom: 4, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                      <YAxis width={52} tick={{ fontSize: 11 }} unit="B" domain={[0, "auto"]} />
                      <Tooltip
                        formatter={(value: number) => [`$${Number(value).toFixed(1)}B`, "4사 합산"]}
                        labelFormatter={(label) => `회계기간 종료 ${label}`}
                        contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                      />
                      <Line
                        type="linear"
                        dataKey="total"
                        name="4사 합산"
                        stroke={REGIME_SERIES_COLORS.cyan}
                        strokeWidth={3}
                        dot={{ r: 3, fill: REGIME_SERIES_COLORS.cyan }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="border-t pt-6" aria-labelledby="company-capex-title">
                <div className="mb-3">
                  <h3 id="company-capex-title" className="text-sm font-semibold">기업별 분기 CAPEX</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    같은 분기의 기업별 절대 투자금액을 비교합니다.
                  </p>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      syncId="ai-capex-quarter"
                      barCategoryGap="18%"
                      barGap={2}
                      margin={{ top: 12, right: 12, bottom: 8, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                      <YAxis width={48} tick={{ fontSize: 11 }} unit="B" />
                      <Tooltip
                        formatter={(value: number, name: string) => [`$${Number(value).toFixed(1)}B`, data.companies.find((item) => item.id === name)?.name || name]}
                        labelFormatter={(label) => `회계기간 종료 ${label}`}
                        contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                      />
                      <Legend formatter={(value) => data.companies.find((item) => item.id === value)?.name || value} />
                      {data.companies.map((company) => (
                        <Bar key={company.id} dataKey={company.id} fill={colors[company.id]} maxBarSize={24} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          ) : (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              데이터 새로고침으로 SEC 공시를 수집해주세요.
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.companies.map((company) => (
          <Card key={company.id}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{company.name}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{company.latest_capex == null ? "-" : `$${(company.latest_capex / 1e9).toFixed(1)}B`}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                YoY{" "}
                <span className={TONE_STYLES[aiCapexDeltaTone(company.yoy, !company.is_stale)].text}>
                  {company.yoy == null ? "-" : `${company.yoy > 0 ? "+" : ""}${company.yoy.toFixed(1)}%`}
                </span>{" "}
                · TTM {company.ttm == null ? "-" : `$${(company.ttm / 1e9).toFixed(1)}B`}
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                기준 {company.latest_period || "미수집"}
                {company.is_stale && <Badge variant="outline" className="text-[10px]">오래됨</Badge>}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
        <span>
          산출 방식 · 동일 분기말 4개사 완전 집계
          {data.as_of_range?.from && data.as_of_range?.to
            ? ` · 최신 분기 범위 ${data.as_of_range.from}~${data.as_of_range.to}`
            : ""}
        </span>
        <InfoTip label="CAPEX 산출 방식">{data.methodology}</InfoTip>
      </div>
    </div>
  );
}

type MemoryPriceSeries = RegimeCurrent["memory_cycle"]["series"][number];

export function splitMemoryPriceSeries(series: MemoryPriceSeries[]) {
  return {
    dram: series.filter((item) => !item.market_type.startsWith("nand_")),
    nand: series.filter((item) => item.market_type.startsWith("nand_")),
  };
}

export function memoryHistoryMode(item: MemoryPriceSeries) {
  if (item.history.length >= 4) return "trend" as const;
  if (item.history.length >= 2) return "sparse" as const;
  return "waiting" as const;
}

export function MemoryCyclePanel({ data }: { data: RegimeCurrent["memory_cycle"] }) {
  const seriesPriority: Record<string, number> = {
    dram_contract_ddr5_sodimm_8gb: 0,
    dram_spot_ddr5_16gb: 1,
    dram_module_spot_ddr5_rdimm_32gb: 2,
    dram_spot_ddr5_16gb_ett: 3,
    dram_contract_ddr4_16gb: 4,
    dram_spot_ddr4_16gb: 5,
    nand_wafer_spot_512gb_tlc: 10,
    nand_wafer_spot_256gb_tlc: 11,
    nand_client_ssd_contract_1tb: 12,
    nand_client_ssd_contract_512gb: 13,
  };
  const ordered = [...data.series].sort((a, b) => {
    return (seriesPriority[a.series_id] ?? 99) - (seriesPriority[b.series_id] ?? 99);
  });
  const grouped = splitMemoryPriceSeries(ordered);
  const dramSeries = grouped.dram;
  const nandSeries = grouped.nand;
  const priceCard = (item: (typeof ordered)[number]) => {
    const role = item.market_type === "contract"
      ? "direct"
      : item.market_type === "module_spot"
        ? "proxy"
        : item.market_type === "nand_wafer_spot"
          ? "nand"
          : item.market_type === "nand_client_ssd_contract"
            ? "context"
            : "spot";
    const aggregateState = item.market_type.startsWith("nand_")
      ? data.nand_state
      : data.state;
    const tone = memorySupplierPriceDeltaTone(
      item.change_percent,
      !item.is_stale,
      role,
      aggregateState,
    );
    const history = [...item.history].sort((a, b) =>
      a.observation_date.localeCompare(b.observation_date),
    );
    const first = history.at(0);
    const latest = history.at(-1);
    const observedChange = first && latest && first.price_average
      ? (latest.price_average / first.price_average - 1) * 100
      : null;
    const historyMode = memoryHistoryMode(item);
    const historyData = history.map((point) => ({
      ...point,
      timestamp: Date.parse(`${point.observation_date}T00:00:00Z`),
    }));
    return (
      <div
        key={item.series_id}
        className="rounded-lg border bg-muted/20 p-4"
        data-memory-series={item.series_id}
        data-memory-history-mode={historyMode}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-5">{item.product_name}</p>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {item.is_stale ? "오래됨" : item.market_type === "contract" ? "월간 Contract"
              : item.market_type === "module_spot" ? "Module Spot"
                : item.market_type === "nand_wafer_spot" ? "TLC Wafer Spot"
                  : item.market_type === "nand_client_ssd_contract" ? "Client SSD Contract" : "Spot"}
          </Badge>
        </div>
        <p className="mt-4 text-2xl font-semibold">
          {item.currency === "USD" ? "$" : ""}
          {item.price_average.toLocaleString("en-US", { maximumFractionDigits: 3 })}
        </p>
        <p className={`mt-1 text-sm tabular-nums ${TONE_STYLES[tone].text}`}>
          {item.change_percent == null
            ? "변화율 미제공"
            : `${item.change_percent > 0 ? "↑ +" : item.change_percent < 0 ? "↓ " : ""}${item.change_percent.toFixed(2)}%`}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          기준 {item.observation_date}{item.period_label ? ` · ${item.period_label}` : ""}
          {item.price_basis ? ` · ${item.price_basis}` : ""}
        </p>
        {historyMode === "trend" ? (
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>수집 가격 이력</span>
              <span>관측 {history.length}회</span>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData} margin={{ top: 4, right: 6, bottom: 2, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.16} vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value) => new Date(Number(value)).toISOString().slice(5, 10).replace("-", ".")}
                    minTickGap={28}
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    width={42}
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  />
                  <Tooltip
                    labelFormatter={(value) => `관측일 ${new Date(Number(value)).toISOString().slice(0, 10)}`}
                    formatter={(value: number) => [Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 }), item.product_name]}
                    contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Line
                    type="linear"
                    dataKey="price_average"
                    stroke={item.market_type.startsWith("nand_") ? REGIME_SERIES_COLORS.violet : REGIME_SERIES_COLORS.blue}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : historyMode === "sparse" && first && latest ? (
          <div className="mt-4 border-t pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">수집 첫값 → 최신값</p>
              <Badge variant="outline" className="text-[10px]">관측 {history.length}회 · 추세 판단 유보</Badge>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm tabular-nums">
              <div>
                <p className="font-medium">{first.price_average.toLocaleString("en-US", { maximumFractionDigits: 3 })}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{first.observation_date.slice(5).replace("-", ".")}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <p className="font-medium">{latest.price_average.toLocaleString("en-US", { maximumFractionDigits: 3 })}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{latest.observation_date.slice(5).replace("-", ".")}</p>
              </div>
            </div>
            <p className="mt-2 text-right text-xs text-muted-foreground">
              수집 이력 변화 {observedChange == null ? "-" : `${observedChange > 0 ? "+" : ""}${observedChange.toFixed(2)}%`}
            </p>
          </div>
        ) : (
          <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            이력 1회 · 다음 관측 후 변화 비교
          </div>
        )}
      </div>
    );
  };
  const dramTone = memoryPriceTone(data.state);
  const nandTone = memoryPriceTone(data.nand_state);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>DRAM 가격 원자료</CardTitle>
          <Badge className="max-w-full whitespace-normal text-right leading-4" variant={TONE_STYLES[dramTone].badge}>
            {memoryPriceStateLabel(data.state)}
          </Badge>
          <InfoTip label="공개 DRAM 표본의 범위">
            공개된 DDR5 SO-DIMM Contract와 일부 Spot 가격을 봅니다. 이 계약가격은
            DRAM 수급 핵심축의 직접 가격 프록시로 사용하지만 Server DRAM·HBM
            전체를 대표하지는 않습니다.
          </InfoTip>
        </div>
        <p className="text-sm text-muted-foreground">{data.reason}</p>
      </CardHeader>
      <CardContent>
        {dramSeries.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-memory-group="dram">
            {dramSeries.map(priceCard)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">공개 가격표를 아직 수집하지 않았습니다.</p>
        )}
        <div className="mt-7 border-t pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">공개 NAND 가격 표본</h3>
            <Badge className="max-w-full whitespace-normal text-right leading-4" variant={TONE_STYLES[nandTone].badge}>
              {nandPriceStateLabel(data.nand_state)}
            </Badge>
            <InfoTip label="공개 NAND 표본의 범위">
              512Gb TLC wafer spot을 주 방향 신호로 사용하고 PC Client SSD
              계약가격을 함께 표시합니다. Enterprise SSD 계약가격·재고·출하량을
              직접 측정하는 지표는 아닙니다.
            </InfoTip>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{data.nand_reason}</p>
          {nandSeries.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-memory-group="nand">{nandSeries.map(priceCard)}</div>
          ) : (
            <p className="text-sm text-muted-foreground">NAND 공개 가격표를 아직 수집하지 않았습니다.</p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
          <span>{data.limitations} · 가격 이력은 수집 시작일부터 축적됩니다.</span>
          <span className="flex gap-3">
            <a href={data.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">DRAM 원본</a>
            <a href={data.nand_source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">NAND 원본</a>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SemiconductorDashboard({
  data,
  memory,
}: {
  data: RegimeCurrent["semiconductor_cycle"];
  memory: RegimeCurrent["memory_cycle"];
}) {
  const hbmProxy = data.hbm_server_proxy;
  const rdimmProxy = hbmProxy.components.server_rdimm;
  const exportDecomposition = hbmProxy.components.export_decomposition;
  const supplierInventory = hbmProxy.components.supplier_inventory;
  const skHynixInventory = supplierInventory.companies.find(
    (company) => company.id === supplierInventory.primary_company,
  );
  const exportDates = new Set(
    Object.values(data.demand.metrics).flatMap((metric) => metric.history.map((point) => point.date)),
  );
  const exportData = [...exportDates].sort().slice(-36).map((date) => ({
    date,
    memory: data.demand.metrics.memory.history.find((point) => point.date === date)?.value == null ? null : (data.demand.metrics.memory.history.find((point) => point.date === date)?.value as number) / 1e9,
    dram: data.demand.metrics.dram.history.find((point) => point.date === date)?.value == null ? null : (data.demand.metrics.dram.history.find((point) => point.date === date)?.value as number) / 1e9,
    flash: data.demand.metrics.flash.history.find((point) => point.date === date)?.value == null ? null : (data.demand.metrics.flash.history.find((point) => point.date === date)?.value as number) / 1e9,
  }));
  const structureMetrics = {
    exportValue: data.demand.metrics.dram,
    exportWeight: data.demand.metrics.dram_weight,
    unitValue: data.demand.metrics.dram_unit_value,
  };
  const structureDates = data.demand.metrics.dram.history
    .map((point) => point.date)
    .filter((date) => Object.values(structureMetrics).every((metric) =>
      metric.history.some((point) => point.date === date && point.value !== 0),
    ))
    .sort()
    .slice(-36);
  const structureBaseDate = structureDates.at(0) || null;
  const structureBases = Object.fromEntries(
    Object.entries(structureMetrics).map(([key, metric]) => [
      key,
      metric.history.find((point) => point.date === structureBaseDate)?.value || null,
    ]),
  ) as Record<keyof typeof structureMetrics, number | null>;
  const exportStructureData = structureDates.map((date) => ({
    date,
    ...Object.fromEntries(
      Object.entries(structureMetrics).map(([key, metric]) => {
        const value = metric.history.find((point) => point.date === date)?.value;
        const base = structureBases[key as keyof typeof structureMetrics];
        return [key, value == null || !base ? null : value / base * 100];
      }),
    ),
  }));
  const supplyDates = new Set(
    Object.values(data.supply.metrics).flatMap((metric) => metric.history.map((point) => point.date)),
  );
  const supplyData = [...supplyDates].sort().slice(-36).map((date) => ({
    date,
    production: data.supply.metrics.production.history.find((point) => point.date === date)?.value,
    shipments: data.supply.metrics.shipments.history.find((point) => point.date === date)?.value,
    inventory: data.supply.metrics.inventory.history.find((point) => point.date === date)?.value,
  }));
  const capexPeriods = new Set(
    data.company_confirmation.companies.flatMap((company) =>
      company.histories.capex.map((point) => point.period),
    ),
  );
  const capexData = [...capexPeriods].sort().slice(-8).map((period) => ({
    period,
    ...Object.fromEntries(
      data.company_confirmation.companies.map((company) => [
        company.id,
        company.histories.capex.find((point) => point.period === period)?.value == null ? null : (company.histories.capex.find((point) => point.period === period)?.value as number) / 1e12,
      ]),
    ),
  }));
  const stateTone = thesisSignalTone(data.state);
  const laneCards = [
    {
      label: "DRAM 수급 핵심축",
      state: data.dram_bottleneck.state,
      displayState: dramBottleneckStateLabel(data.dram_bottleneck.state),
      reason: data.dram_bottleneck.reason,
      className: "lg:col-span-6",
    },
    {
      label: "HBM·서버 DRAM 간접계측",
      state: hbmProxy.state,
      displayState: hbmProxyStateLabel(hbmProxy.state),
      reason: hbmProxy.reason,
      className: "lg:col-span-6",
    },
    {
      label: "DRAM 수출 확인",
      state: data.demand.state,
      displayState: exportDemandStateLabel(data.demand.state),
      reason: data.demand.reason,
      className: "lg:col-span-4",
    },
    {
      label: "완제품 재고 보조",
      state: data.supply.state,
      displayState: supplyStateLabel(data.supply.state),
      reason: data.supply.reason,
      className: "lg:col-span-4",
    },
    {
      label: "국내 2사 실적 보조",
      state: data.company_confirmation.state,
      displayState: companyConfirmationStateLabel(data.company_confirmation.state),
      reason: data.company_confirmation.reason,
      className: "lg:col-span-4",
    },
  ] as const;
  return (
    <div className="space-y-6">
      <div className="px-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">반도체·메모리 수요·공급</h2>
          <Badge className="max-w-full whitespace-normal text-right leading-4" variant={TONE_STYLES[stateTone].badge}>
            {semiconductorStateLabel(data.state)}
          </Badge>
          <InfoTip label="반도체 판정 방법">{data.methodology} {data.limitations}</InfoTip>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{data.reason}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        {laneCards.map((item) => {
          const tone = thesisSignalTone(item.state);
          return (
            <Card key={item.label} className={`${TONE_STYLES[tone].panel} ${item.className}`}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="min-w-0 text-base leading-6">{item.label}</CardTitle>
                  <Badge className="max-w-full shrink-0 whitespace-normal text-right leading-4" variant={TONE_STYLES[tone].badge}>
                    {item.displayState}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent><p className="text-sm leading-6 text-muted-foreground">{item.reason}</p></CardContent>
            </Card>
          );
        })}
      </div>
      <Card className={TONE_STYLES[thesisSignalTone(hbmProxy.state)].panel}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>HBM·서버 DRAM 간접계측</CardTitle>
            <Badge className="max-w-full whitespace-normal text-right leading-4" variant={TONE_STYLES[thesisSignalTone(hbmProxy.state)].badge}>
              {hbmProxyStateLabel(hbmProxy.state)}
            </Badge>
            <Badge variant="neutral">직접 HBM 데이터 아님</Badge>
            <InfoTip label="간접계측 방법과 한계">
              {hbmProxy.methodology}. {hbmProxy.limitations}.
            </InfoTip>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{hbmProxy.reason}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: "서버 RDIMM 공개가격",
                value: `${signed(rdimmProxy.change_percent, 2)}%`,
                detail: `${rdimmStateLabel(rdimmProxy.state)} · ${rdimmProxy.observation_date || "미수집"}`,
                tone: memoryPriceTone(rdimmProxy.state),
                help: "공개 DDR5 RDIMM 모듈 표본의 최근 표기 변화율입니다. 서버 DRAM 계약가격이나 HBM 가격을 직접 뜻하지 않습니다.",
              },
              {
                label: "DRAM 칩 수출액",
                value: `${signed(data.demand.metrics.dram.yoy_3m_avg)}%`,
                detail: `3개월 평균 YoY · 최근 3M/직전 3M ${signed(data.demand.metrics.dram.sequential_3m)}%`,
                tone: data.demand.metrics.dram.yoy_3m_avg == null
                  ? "neutral" as const
                  : data.demand.metrics.dram.yoy_3m_avg >= 15 ? "positive" as const
                  : data.demand.metrics.dram.yoy_3m_avg < 0 ? "negative" as const : "neutral" as const,
                help: "관세청 HS 8542321010 DRAM 칩 수출액입니다. 전년동월 비교의 3개월 평균을 주 방향으로 사용하고, 최근 3개월 평균과 직전 3개월 평균의 차이를 단기 속도로 따로 표시합니다.",
              },
              {
                label: "MCP 수출액",
                value: `${signed(data.demand.metrics.mcp.yoy_3m_avg)}%`,
                detail: `3개월 평균 YoY · 최근 3M/직전 3M ${signed(data.demand.metrics.mcp.sequential_3m)}%`,
                tone: data.demand.metrics.mcp.yoy_3m_avg == null
                  ? "neutral" as const
                  : data.demand.metrics.mcp.yoy_3m_avg >= 15 ? "positive" as const
                  : data.demand.metrics.mcp.yoy_3m_avg < 0 ? "negative" as const : "neutral" as const,
                help: "관세청 HS 8542323000 복합구조칩 집적회로 수출액입니다. HBM을 직접 분리하지 못하지만 고집적 메모리 패키지 수요의 확인축으로 사용합니다.",
              },
              {
                label: "DRAM 모듈 수출액",
                value: `${signed(data.demand.metrics.dram_module.yoy_3m_avg)}%`,
                detail: `3개월 평균 YoY · 최근 3M/직전 3M ${signed(data.demand.metrics.dram_module.sequential_3m)}%`,
                tone: data.demand.metrics.dram_module.yoy_3m_avg == null
                  ? "neutral" as const
                  : data.demand.metrics.dram_module.yoy_3m_avg >= 15 ? "positive" as const
                  : data.demand.metrics.dram_module.yoy_3m_avg < 0 ? "negative" as const : "neutral" as const,
                help: "관세청 HS 8473304060 DRAM 모듈 수출액입니다. 칩 수출과 다른 분류에서 서버·완제품 단계 수요를 확인하는 보조축입니다.",
              },
              {
                label: "단가·제품믹스 프록시",
                value: `${signed(data.demand.metrics.dram_unit_value.yoy_3m_avg)}%`,
                detail: `3개월 평균 YoY · ${exportStructureStateLabel(exportDecomposition.state)}`,
                tone: thesisSignalTone(exportDecomposition.state),
                help: "관세청 DRAM 수출액을 신고 중량으로 나눈 단위중량당 수출액입니다. 실제 가격과 HBM 등 고부가 제품 비중 변화가 함께 반영됩니다.",
              },
              {
                label: "SK하이닉스 재고/매출 비율",
                value: skHynixInventory?.inventory_to_revenue == null
                  ? "-"
                  : `${skHynixInventory.inventory_to_revenue.toFixed(1)}%`,
                detail: `현재 비율은 참고값 · ${inventoryBurdenLabel(supplierInventory.state)}`,
                tone: "neutral" as const,
                help: "분기말 재고를 같은 분기 매출로 나눈 수준입니다. 비율 하락은 재고 절대액 감소나 물리적 소진을 뜻하지 않으며, 같은 DART 매출·재고의 파생 맥락이라 HBM 판정에 독립 신호로 중복 합산하지 않습니다.",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-muted/10 p-4">
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <InfoTip label={`${item.label} 설명`}>{item.help}</InfoTip>
                </div>
                <p className={`mt-2 text-xl font-semibold tabular-nums ${TONE_STYLES[item.tone].text}`}>
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          {hbmProxy.conflicts.length > 0 && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-5">
              <span className="font-medium text-warning">서로 엇갈리는 근거</span>
              <span className="ml-2 text-muted-foreground">
                {hbmProxy.conflicts.map(plainLanguageStateText).join(" · ")}
              </span>
            </div>
          )}
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-lg border bg-muted/5 p-4">
              <div className="mb-3">
                <div className="flex items-center gap-1">
                  <p className="font-medium">DRAM 관세 신고 기준 수출 구조 프록시</p>
                  <InfoTip label="DRAM 수출 구조 프록시 설명">
                    수출액을 신고중량과 단위중량당 수출액으로 산술 분해합니다.
                    신고중량은 패키징을 포함한 관세 신고 순중량이지 DRAM bit 출하량이
                    아니므로, 중량 감소만으로 수요 약화나 재고 부담을 판정하지 않습니다.
                    세 선은 같은 관세 자료를 재표현한 맥락이며 독립된 세 증거가 아닙니다.
                  </InfoTip>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  공통 기준 {structureBaseDate || "미확인"}=100 · 신고중량≠bit 출하량 · 단가 프록시=가격+제품믹스
                </p>
              </div>
              <div className="mb-3 rounded-md border bg-background/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">최근 3개월 평균 YoY 구조</p>
                  <Badge variant={TONE_STYLES[thesisSignalTone(exportDecomposition.state)].badge}>
                    {exportStructureStateLabel(exportDecomposition.state)}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center">
                  <div><p className="text-[10px] text-muted-foreground">수출액</p><p className="mt-1 text-sm font-semibold tabular-nums">{data.demand.metrics.dram.yoy_3m_avg == null ? "-" : `${(1 + data.demand.metrics.dram.yoy_3m_avg / 100).toFixed(2)}배`}</p><p className="text-[9px] text-muted-foreground">YoY {signed(data.demand.metrics.dram.yoy_3m_avg)}%</p></div>
                  <span className="text-muted-foreground">≈</span>
                  <div><p className="text-[10px] text-muted-foreground">신고중량</p><p className="mt-1 text-sm font-semibold tabular-nums">{data.demand.metrics.dram_weight.yoy_3m_avg == null ? "-" : `${(1 + data.demand.metrics.dram_weight.yoy_3m_avg / 100).toFixed(2)}배`}</p><p className="text-[9px] text-muted-foreground">YoY {signed(data.demand.metrics.dram_weight.yoy_3m_avg)}%</p></div>
                  <span className="text-muted-foreground">×</span>
                  <div><p className="text-[10px] text-muted-foreground">단가·믹스</p><p className="mt-1 text-sm font-semibold tabular-nums">{data.demand.metrics.dram_unit_value.yoy_3m_avg == null ? "-" : `${(1 + data.demand.metrics.dram_unit_value.yoy_3m_avg / 100).toFixed(2)}배`}</p><p className="text-[9px] text-muted-foreground">YoY {signed(data.demand.metrics.dram_unit_value.yoy_3m_avg)}%</p></div>
                </div>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exportStructureData} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" opacity={0.45} />
                    <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={32} tick={{ fontSize: 11 }} />
                    <YAxis width={48} tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(label) => `관측월 ${label}`}
                      formatter={(value: number, name: string) => [
                        Number(value).toFixed(1),
                        name === "exportValue" ? "수출액" : name === "exportWeight" ? "신고중량(참고)" : "단위중량당 수출액",
                      ]}
                      contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Legend formatter={(value) => value === "exportValue" ? "수출액" : value === "exportWeight" ? "신고중량(참고)" : "단위중량당 수출액"} />
                    <Line type="monotone" dataKey="exportValue" stroke={REGIME_SERIES_COLORS.blue} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="exportWeight" stroke={REGIME_SERIES_COLORS.violet} dot={false} strokeWidth={1.7} strokeDasharray="5 3" isAnimationActive={false} />
                    <Line type="monotone" dataKey="unitValue" stroke={REGIME_SERIES_COLORS.cyan} dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/5 p-4">
              <div className="mb-3">
                <div className="flex items-center gap-1">
                  <p className="font-medium">공급사 분기매출 대비 재고 · 회사별 추세</p>
                  <InfoTip label="공급사 매출 대비 재고 설명">
                    분기말 재고자산을 같은 분기 매출로 나눈 비율입니다. 20%라면 분기
                    매출 100원당 분기말 재고가 20원이라는 뜻입니다. 비율 하락은 재고
                    절대액이 줄거나 물리적으로 소진됐다는 뜻이 아니라, 매출 분모가
                    재고보다 빠르게 늘어난 방향입니다. 같은 DART 매출·재고를 재표현한
                    값이라 독립 판정축으로 중복 합산하지 않습니다.
                  </InfoTip>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  비율 수준(%) · 판정은 같은 회사의 전년동기 %p 변화 · 재고일수 아님
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {supplierInventory.companies.map((company, index) => {
                  const prior = priorInventoryRatio(company);
                  return (
                    <div key={company.id} className="rounded-md border bg-background/25 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{company.name}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {prior == null || company.inventory_to_revenue == null
                              ? "전년동기 비교 불가"
                              : `${prior.toFixed(1)}% → ${company.inventory_to_revenue.toFixed(1)}% (${signed(company.ratio_change_pp)}%p)`}
                          </p>
                        </div>
                        <Badge variant={TONE_STYLES[thesisSignalTone(company.state)].badge}>
                          {inventoryBurdenLabel(company.state)}
                        </Badge>
                      </div>
                      <div className="mt-2 h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={company.history.slice(-12)} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
                            <XAxis dataKey="period" tickFormatter={formatDate} minTickGap={28} tick={{ fontSize: 10 }} />
                            <YAxis width={40} tick={{ fontSize: 10 }} unit="%" domain={["auto", "auto"]} />
                            <Tooltip
                              labelFormatter={(label) => `분기말 ${label}`}
                              formatter={(value: number) => [`${Number(value).toFixed(1)}%`, "재고/분기매출"]}
                              contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                            />
                            <Line type="monotone" dataKey="value" stroke={index ? REGIME_SERIES_COLORS.violet : REGIME_SERIES_COLORS.blue} dot={{ r: 2 }} strokeWidth={2} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <MemoryCyclePanel data={memory} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>한국 메모리 수출액</CardTitle>
            <p className="text-sm text-muted-foreground">관세청 월별 품목 · 십억 달러</p>
          </CardHeader>
          <CardContent>
            {exportData.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exportData} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={32} tick={{ fontSize: 11 }} />
                    <YAxis width={48} tick={{ fontSize: 11 }} unit="B" />
                    <Tooltip labelFormatter={(label) => `관측월 ${label}`} formatter={(value: number, name: string) => [`$${Number(value).toFixed(2)}B`, name === "memory" ? "전체 메모리" : name === "dram" ? "DRAM" : "플래시메모리"]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                    <Legend formatter={(value) => value === "memory" ? "전체 메모리" : value === "dram" ? "DRAM" : "플래시메모리"} />
                    <Line type="monotone" dataKey="memory" stroke={REGIME_SERIES_COLORS.blue} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="dram" stroke={REGIME_SERIES_COLORS.cyan} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="flash" stroke={REGIME_SERIES_COLORS.violet} dot={false} strokeWidth={2} strokeDasharray="5 3" isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">관세청 데이터를 아직 수집하지 않았습니다.</div>}
            {data.demand.source_url && <a href={data.demand.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-primary hover:underline">관세청 원본 통계</a>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>한국 반도체 완제품 생산·출하·재고</CardTitle>
            <p className="text-sm text-muted-foreground">KOSIS C261 광의 지수 · 2020=100</p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border bg-muted/10 px-2 py-3">
                <p className="text-muted-foreground">재고 수준</p>
                <p className="mt-1 font-medium tabular-nums">
                  {data.supply.context.inventory_percentile == null
                    ? "-"
                    : `${data.supply.context.inventory_percentile.toFixed(0)}백분위`}
                </p>
              </div>
              <div className="rounded-md border bg-muted/10 px-2 py-3">
                <p className="text-muted-foreground">재고/출하</p>
                <p className="mt-1 font-medium tabular-nums">
                  {data.supply.context.inventory_shipments_ratio_percentile == null
                    ? "-"
                    : `${data.supply.context.inventory_shipments_ratio_percentile.toFixed(0)}백분위`}
                </p>
              </div>
              <div className="rounded-md border bg-muted/10 px-2 py-3">
                <p className="text-muted-foreground">재고 3개월</p>
                <p className="mt-1 font-medium tabular-nums">
                  {signed(data.supply.context.inventory_change_3m)}%
                </p>
              </div>
            </div>
            {supplyData.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={supplyData} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={32} tick={{ fontSize: 11 }} />
                    <YAxis width={48} tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                    <Tooltip labelFormatter={(label) => `관측월 ${label}`} formatter={(value: number, name: string) => [Number(value).toFixed(1), name === "production" ? "생산" : name === "shipments" ? "출하" : "재고"]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                    <Legend formatter={(value) => value === "production" ? "생산" : value === "shipments" ? "출하" : "재고"} />
                    <Line type="monotone" dataKey="production" stroke={REGIME_SERIES_COLORS.blue} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="shipments" stroke={REGIME_SERIES_COLORS.cyan} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="inventory" stroke={REGIME_SERIES_COLORS.pink} dot={false} strokeWidth={2} strokeDasharray="5 3" isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">KOSIS 데이터를 아직 수집하지 않았습니다.</div>}
            <a href={data.supply.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-primary hover:underline">KOSIS 원본 통계</a>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>국내 2사 실적 확인 · 보조축</CardTitle>
            <Badge
              className="max-w-full whitespace-normal text-right leading-4"
              variant={TONE_STYLES[thesisSignalTone(data.company_confirmation.state)].badge}
            >
              {companyConfirmationStateLabel(data.company_confirmation.state)}
            </Badge>
            <InfoTip label="공시 확인 범위">{data.company_confirmation.methodology} {data.company_confirmation.limitations}</InfoTip>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {data.company_confirmation.reason} 삼성전자는 전사 수치로 메모리 부문 단독 실적이 아닙니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.company_confirmation.companies.map((company) => (
              <CompanyFilingCard
                key={company.id}
                company={company}
                inventory={supplierInventory.companies.find((item) => item.id === company.id)}
              />
            ))}
          </div>
          <div className="mt-6 rounded-lg border bg-muted/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-medium">공급사 CAPEX 맥락 · 현재 판정 미사용</p>
                  <InfoTip label="공급사 CAPEX 차트 설명">
                    OpenDART 현금흐름표의 유형자산 취득을 단독 분기로 환산한 값입니다.
                    지급 시점 변동이 있고 메모리·AI 전용 투자로 분리되지 않습니다. 증가는
                    투자 의지와 미래 공급 확대를 함께 뜻할 수 있어 현재 실적·수급 판정에
                    기계적으로 합산하지 않습니다.
                  </InfoTip>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  회사별 최신 CAPEX 분기는 위 실적 기준분기와 다를 수 있습니다.
                </p>
              </div>
              <Badge variant="info">공급 증설 맥락</Badge>
            </div>
            {capexData.length ? (
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={capexData} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                    <YAxis width={48} tick={{ fontSize: 11 }} unit="조" />
                    <Tooltip labelFormatter={(label) => `분기말 ${label}`} formatter={(value: number, name: string) => [`₩${Number(value).toFixed(1)}조`, data.company_confirmation.companies.find((company) => company.id === name)?.name || name]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                    <Legend formatter={(value) => data.company_confirmation.companies.find((company) => company.id === value)?.name || value} />
                    {data.company_confirmation.companies.map((company, index) => <Bar key={company.id} dataKey={company.id} fill={index ? REGIME_SERIES_COLORS.violet : REGIME_SERIES_COLORS.blue} maxBarSize={30} isAnimationActive={false} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">OpenDART 데이터를 아직 수집하지 않았습니다.</div>}
          </div>
          <a href={data.company_confirmation.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-primary hover:underline">OpenDART 원본 공시 안내</a>
        </CardContent>
      </Card>
    </div>
  );
}

function PowerValueCard({
  label,
  value,
  unit = "%",
  digits = 1,
  showSign = false,
  tone = "neutral",
}: {
  label: string;
  value?: number | null;
  unit?: string;
  digits?: number;
  showSign?: boolean;
  tone?: SemanticTone;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-medium tabular-nums ${TONE_STYLES[tone].text}`}>
        {value == null
          ? "-"
          : `${showSign ? signed(value, digits) : value.toFixed(digits)}${unit}`}
      </p>
    </div>
  );
}

export function PowerDashboard({ data }: { data: RegimeCurrent["power_cycle"] }) {
  const metrics = data.metrics;
  const demand = data.demand_axis;
  const operations = data.operations_axis;
  const supply = data.supply_axis;
  const interconnection = data.interconnection_axis;
  const transmission = data.transmission_investment_axis;
  const dates = new Set(
    [metrics.total_sales, metrics.commercial_sales, metrics.industrial_sales, metrics.generation]
      .flatMap((metric) => metric.history.map((point) => point.date)),
  );
  const monthly = [...dates].sort().slice(-48).map((date) => ({
    date,
    total: metrics.total_sales.history.find((point) => point.date === date)?.value == null ? null : (metrics.total_sales.history.find((point) => point.date === date)?.value as number) / 1000,
    commercial: metrics.commercial_sales.history.find((point) => point.date === date)?.value == null ? null : (metrics.commercial_sales.history.find((point) => point.date === date)?.value as number) / 1000,
    industrial: metrics.industrial_sales.history.find((point) => point.date === date)?.value == null ? null : (metrics.industrial_sales.history.find((point) => point.date === date)?.value as number) / 1000,
    generation: metrics.generation.history.find((point) => point.date === date)?.value == null ? null : (metrics.generation.history.find((point) => point.date === date)?.value as number) / 1000,
  }));
  const capacity = metrics.capacity.history.map((point) => ({
    date: point.date, capacity: point.value / 1000,
  }));
  if (!demand || !supply) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI 전력 인프라 전달경로</CardTitle>
          <p className="text-sm text-muted-foreground">새 전력 판정자료를 불러오는 중입니다.</p>
        </CardHeader>
      </Card>
    );
  }
  const tone = powerDemandTone(data.state, !data.is_stale);
  const demandTone = powerDemandTone(demand.state, !data.is_stale);
  const operationsTone = powerOperationsTone(operations?.state, !operations?.is_stale);
  const supplyTone = powerConstructionTone(supply.state, !supply.is_stale);
  const interconnectionTone = powerInterconnectionTone(
    interconnection?.state,
    !interconnection?.is_stale,
  );
  const transmissionTone = powerTransmissionTone(
    transmission?.state,
    !transmission?.is_stale,
  );
  const demandHistory = demand.yoy_history.slice(-180);
  const operationsHistory = operations?.history.slice(-180) || [];
  const regionBars = demand.regions
    .filter((item) => item.yoy_84d != null)
    .map((item) => ({ ...item, value: item.yoy_84d as number }));
  const mixLabels: Record<string, string> = {
    solar: "태양광", battery: "배터리", wind: "풍력", gas: "가스", other: "기타",
  };
  const mixColors: Record<string, string> = {
    solar: REGIME_SERIES_COLORS.violet,
    battery: REGIME_SERIES_COLORS.cyan,
    wind: REGIME_SERIES_COLORS.blue,
    gas: REGIME_SERIES_COLORS.pink,
    other: "#64748b",
  };
  const mixRow = Object.fromEntries(
    supply.mix.map((item) => [item.id, item.value_gw || 0]),
  );
  const pipelineTotal = supply.mix.reduce((sum, item) => sum + (item.value_gw || 0), 0);
  const percentage = (value: number | null, digits = 1) =>
    value == null ? "-" : `${signed(value, digits)}%`;
  const gigawatts = (value: number | null, showSign = false) =>
    value == null ? "-" : `${showSign ? signed(value, 1) : value.toFixed(1)} GW`;
  const metricValue = (
    metric: { value: number; unit: string } | null | undefined,
    divisor = 1,
    digits = 1,
    unit?: string,
  ) => {
    if (metric == null) return "-";
    const displayUnit = unit ?? ({
      percent: "%",
      years: "년",
      projects: "개",
      reporters: "개사",
      USD: "달러",
    } as Record<string, string>)[metric.unit] ?? ` ${metric.unit}`;
    const spacing = displayUnit.startsWith(" ") || ["%", "년", "개", "개사"].includes(displayUnit)
      ? ""
      : " ";
    return `${(metric.value / divisor).toLocaleString("ko-KR", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })}${spacing}${displayUnit}`;
  };
  const usdBillions = (metric: { value: number } | null | undefined) =>
    metric == null ? "-" : `$${(metric.value / 1_000_000_000).toFixed(1)}B`;
  const queueHistory = (interconnection?.history || []).slice(-12);
  const transmissionHistory = (transmission?.history || []).slice(-12).map((point) => ({
    ...point,
    additions_billion: point.additions_usd == null ? null : point.additions_usd / 1_000_000_000,
  }));
  const flowAxes = [
    {
      title: "전력 수요 압력",
      state: demand.is_stale ? "수요자료 갱신 지연" : powerDemandAxisLabel(demand.state),
      reason: demand.reason,
      date: demand.observation_date,
      tone: demandTone,
      scope: "실제 수요",
    },
    {
      title: "계통 운영 압력",
      state: operations?.is_stale
        ? "운영자료 갱신 지연"
        : powerOperationsAxisLabel(operations?.state),
      reason: operations?.reason || "운영 프록시를 아직 수집하지 않았습니다.",
      date: operations?.observation_date,
      tone: operationsTone,
      scope: "운영 프록시",
    },
    {
      title: "발전·저장 건설",
      state: supply.is_stale ? "설비자료 갱신 지연" : powerSupplyAxisLabel(supply.state),
      reason: supply.reason,
      date: supply.observation_date,
      tone: supplyTone,
      scope: "공사단계 설비",
    },
    {
      title: "발전 공급 접속 대기",
      state: interconnection?.is_stale
        ? "접속자료 갱신 지연"
        : interconnectionAxisLabel(interconnection?.state),
      reason: interconnection?.reason || "공급측 접속 대기자료를 아직 수집하지 않았습니다.",
      date: interconnection?.observation_date,
      tone: interconnectionTone,
      scope: "공급측 대기열",
    },
    {
      title: "송전 투자 실행",
      state: transmission?.is_stale
        ? "투자자료 갱신 지연"
        : transmissionInvestmentAxisLabel(transmission?.state),
      reason: transmission?.reason || "송전 투자자료를 아직 수집하지 않았습니다.",
      date: transmission?.observation_date,
      tone: transmissionTone,
      scope: "회계상 투자",
    },
  ];
  return (
    <div className="space-y-6">
      <div className="px-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="scroll-mt-24 text-xl font-semibold">AI 전력 인프라 전달경로</h2>
          <Badge className="max-w-full whitespace-normal text-right leading-4" variant={TONE_STYLES[tone].badge}>
            {powerStateLabel(data.state)}
          </Badge>
          <InfoTip label="전력 투자 근거 판정 방식">{data.methodology} {data.limitations}</InfoTip>
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{data.reason}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          수요가 계통 부담과 실제 투자로 이어지는지를 단계별로 확인합니다 · 종합 기준일 {data.decision_as_of_date || data.as_of_date || "미수집"}
        </p>
      </div>
      <div className="rounded-xl border border-border/70 bg-card/30 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-5">
          {flowAxes.map((axis, index) => (
            <div
              key={axis.title}
              className={`relative min-w-0 rounded-lg border p-4 ${TONE_STYLES[axis.tone].panel}`}
              data-power-flow-axis={index + 1}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {index + 1}단계 · {axis.scope}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5">{axis.title}</p>
                </div>
                {index < flowAxes.length - 1 && (
                  <ArrowRight className="absolute -right-[18px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground lg:block" />
                )}
              </div>
              <Badge className="mt-3 max-w-full whitespace-normal text-left leading-4" variant={TONE_STYLES[axis.tone].badge}>
                {axis.state}
              </Badge>
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground" title={axis.reason}>
                {axis.reason}
              </p>
              <p className="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                기준 {axis.date || "미수집"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-medium text-primary">1단계 · 실제 수요</p>
            <h3 className="mt-1 text-lg font-semibold">전력 수요 압력</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{demand.reason}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={TONE_STYLES[demandTone].badge}>{powerDemandAxisLabel(demand.state)}</Badge>
            <p className="text-xs text-muted-foreground">EIA-930 · {demand.observation_date || "미수집"}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ChangeMetric label="미국 84일 YoY" value={demand.national_yoy_84d} tone={demandTone} />
          <ChangeMetric label="AI 관찰지역 84일 YoY" value={demand.ai_regions_yoy_84d} tone={demandTone} />
          <ChangeMetric label="AI 지역 초과 성장" value={demand.ai_excess_growth_pp} unit="%p" tone={demandTone} />
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">2% 이상 증가 지역</p>
            <p className={`mt-0.5 text-sm font-medium tabular-nums ${TONE_STYLES[demandTone].text}`}>
              {demand.regional_expansion_share == null
                ? "-"
                : `${regionBars.filter((item) => item.value >= 2).length}/${demand.expected_region_count || regionBars.length} · ${(demand.regional_expansion_share * 100).toFixed(0)}%`}
            </p>
          </div>
        </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>최근 전력수요 방향</CardTitle>
            <p className="text-sm text-muted-foreground">전년 같은 요일 대비 28일 이동 YoY · EIA-930 실제 수요</p>
          </CardHeader>
          <CardContent>
            {demandHistory.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={demandHistory} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={32} tick={{ fontSize: 11 }} />
                    <YAxis width={48} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} domain={["auto", "auto"]} />
                    <Tooltip labelFormatter={(label) => `관측일 ${label}`} formatter={(value: number, name: string) => [`${signed(Number(value), 1)}%`, name === "national" ? "미국 전체" : "AI 인프라 관찰지역"]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                    <Legend formatter={(value) => value === "national" ? "미국 전체" : "AI 인프라 관찰지역"} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.45} />
                    <Line type="monotone" dataKey="national" stroke={REGIME_SERIES_COLORS.blue} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="ai_regions" stroke={REGIME_SERIES_COLORS.cyan} dot={false} strokeWidth={2.4} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">EIA-930 일간 수요를 아직 수집하지 않았습니다.</div>}
            <p className="mt-3 text-xs leading-5 text-muted-foreground">AI 인프라 관찰지역은 중부대서양·텍사스·남동부·북서부·남서부·캐롤라이나 합계입니다. 데이터센터 전용 부하는 아니며 날씨 보정 전입니다.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>지역별 수요 확산</CardTitle>
            <p className="text-sm text-muted-foreground">최근 84일 YoY · AI 관찰지역은 청록색</p>
          </CardHeader>
          <CardContent>
            {regionBars.length ? (
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionBars} layout="vertical" margin={{ top: 0, right: 14, bottom: 4, left: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}%`} />
                    <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 10 }} />
                    <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" opacity={0.5} />
                    <Tooltip formatter={(value: number) => [`${signed(Number(value), 1)}%`, "84일 YoY"]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={18} isAnimationActive={false}>
                      {regionBars.map((item) => <Cell key={item.id} fill={item.is_ai_proxy ? REGIME_SERIES_COLORS.cyan : REGIME_SERIES_COLORS.blue} fillOpacity={item.is_ai_proxy ? 0.95 : 0.55} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">지역 수요자료를 아직 수집하지 않았습니다.</div>}
          </CardContent>
        </Card>
      </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-medium text-primary">2단계 · 운영 프록시</p>
            <h3 className="mt-1 text-lg font-semibold">계통 운영 압력</h3>
          </div>
          <p className="text-xs text-muted-foreground">EIA-930 · {operations?.observation_date || "미수집"}</p>
        </div>
        <Card className={TONE_STYLES[operationsTone].panel}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">수요예측 오차와 지역 수급 대응</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{operations?.reason || "운영자료를 아직 수집하지 않았습니다."}</p>
              </div>
              <Badge variant={TONE_STYLES[operationsTone].badge}>
                {powerOperationsAxisLabel(operations?.state)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <PowerValueCard label={`${operations?.window_days || 28}일 수요예측 초과`} value={operations?.forecast_surprise_pct} showSign tone={operationsTone} />
              <PowerValueCard label="예측 절대오차" value={operations?.forecast_abs_error_pct} />
              <PowerValueCard label="관찰지역 발전량/수요" value={operations?.generation_coverage_pct} />
              <PowerValueCard label="순수입 의존도" value={operations?.net_import_share_pct} tone={operationsTone} />
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">부담 관찰지역</p>
                <p className={`mt-0.5 text-sm font-medium tabular-nums ${TONE_STYLES[operationsTone].text}`}>
                  {operations?.pressure_region_count == null
                    ? "-"
                    : `${operations.pressure_region_count}/${operations.expected_region_count}`}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-3">
                <p className="mb-3 text-sm font-medium">실제 수요와 예측의 차이</p>
                {operationsHistory.length ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={operationsHistory} margin={{ top: 8, right: 12, bottom: 6, left: 2 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={28} tick={{ fontSize: 10 }} />
                        <YAxis width={42} tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}%`} />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" opacity={0.5} />
                        <Tooltip labelFormatter={(label) => `관측일 ${label}`} formatter={(value: number, name: string) => [`${signed(Number(value), 1)}%`, name === "forecast_surprise_pct" ? "수요예측 초과" : "예측 절대오차"]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                        <Line type="monotone" dataKey="forecast_surprise_pct" stroke={REGIME_SERIES_COLORS.pink} dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="forecast_abs_error_pct" stroke={REGIME_SERIES_COLORS.violet} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">운영 이력이 부족합니다.</div>}
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <p className="mb-3 text-sm font-medium">지역 순수입 의존도</p>
                {operationsHistory.length ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={operationsHistory} margin={{ top: 8, right: 12, bottom: 6, left: 2 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                        <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={28} tick={{ fontSize: 10 }} />
                        <YAxis width={42} tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}%`} domain={[0, "auto"]} />
                        <Tooltip labelFormatter={(label) => `관측일 ${label}`} formatter={(value: number) => [`${Number(value).toFixed(1)}%`, "순수입 의존도"]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                        <Line type="monotone" dataKey="net_import_share_pct" stroke={REGIME_SERIES_COLORS.cyan} dot={false} strokeWidth={2} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">운영 이력이 부족합니다.</div>}
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              실제 수요·당일 예측·지역 발전·순수입으로 계산한 운영 압력 프록시입니다. 예비율이나 송전 병목을 직접 측정한 값은 아닙니다.
            </p>
            {operations?.source_url && <a href={operations.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">EIA-930 운영 원자료</a>}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-medium text-primary">3단계 · 공사단계 설비</p>
            <h3 className="mt-1 text-lg font-semibold">발전·저장 건설</h3>
          </div>
          <p className="text-xs text-muted-foreground">EIA-860M · {supply.observation_date || "미수집"}</p>
        </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>24개월 발전·저장 공사단계 설비</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">공사 중·공사 완료 설비만 포함 · EIA-860M · {supply.observation_date || "미수집"}</p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{supply.reason}</p>
            </div>
            <Badge variant={TONE_STYLES[supplyTone].badge}>{supply.is_stale ? "설비자료 갱신 지연" : powerSupplyAxisLabel(supply.state)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {pipelineTotal > 0 ? (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[mixRow]} layout="vertical" margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} unit=" GW" />
                  <YAxis type="category" hide />
                  <Tooltip formatter={(value: number, name: string) => [`${Number(value).toFixed(1)} GW`, mixLabels[name] || name]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                  <Legend formatter={(value) => mixLabels[value] || value} />
                  {supply.mix.map((item) => <Bar key={item.id} dataKey={item.id} stackId="pipeline" fill={mixColors[item.id] || "#64748b"} isAnimationActive={false} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">EIA-860M 설비자료를 아직 수집하지 않았습니다.</div>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">현재 가동용량</p><p className="mt-0.5 text-sm font-medium tabular-nums">{supply.operating_capacity_gw == null ? "-" : `${supply.operating_capacity_gw.toFixed(1)} GW`}</p></div>
            <PowerValueCard label="건설 중 설비" value={supply.committed_additions_24m_gw} unit=" GW" tone={supplyTone} />
            <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">예정 은퇴</p><p className="mt-0.5 text-sm font-medium tabular-nums">{supply.retirements_24m_gw == null ? "-" : `${supply.retirements_24m_gw.toFixed(1)} GW`}</p></div>
            <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">순설비 확충</p><p className={`mt-0.5 text-sm font-medium tabular-nums ${TONE_STYLES[supplyTone].text}`}>{gigawatts(supply.net_additions_24m_gw, true)}</p></div>
            <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">가동용량 대비 순확충</p><p className={`mt-0.5 text-sm font-medium tabular-nums ${TONE_STYLES[supplyTone].text}`}>{percentage(supply.net_pipeline_ratio_24m_pct)}</p></div>
            <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">태양광·풍력·배터리 비중</p><p className="mt-0.5 text-sm font-medium tabular-nums text-info">{supply.variable_storage_share_24m_pct == null ? "-" : `${supply.variable_storage_share_24m_pct.toFixed(1)}%`}</p></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">순하계 명목용량 기준입니다. 태양광·풍력·배터리의 MW는 같은 양의 확정 공급력을 뜻하지 않으며, 접속 가능 여부는 다음 단계에서 별도로 봅니다.</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <a href={demand.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">EIA-930 수요 원자료</a>
            <a href={supply.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">EIA-860M 설비 원자료</a>
          </div>
        </CardContent>
      </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-medium text-primary">4단계 · 공급측 대기열</p>
            <h3 className="mt-1 text-lg font-semibold">발전 공급 접속 대기</h3>
          </div>
          <p className="text-xs text-muted-foreground">LBNL Queued Up · {interconnection?.observation_date || "미수집"}</p>
        </div>
        <Card className={TONE_STYLES[interconnectionTone].panel}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>발전·저장 프로젝트 계통 접속 대기열</CardTitle>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{interconnection?.reason || "접속 대기자료를 아직 수집하지 않았습니다."}</p>
              </div>
              <Badge variant={TONE_STYLES[interconnectionTone].badge}>{interconnectionAxisLabel(interconnection?.state)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">활성 접속 대기</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{metricValue(interconnection?.metrics.active_queue_gw)}</p></div>
              <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">접속계약 체결 비중</p><p className={`mt-0.5 text-sm font-semibold tabular-nums ${TONE_STYLES[interconnectionTone].text}`}>{metricValue(interconnection?.metrics.ia_executed_share_pct)}</p></div>
              <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">활성 대기기간 중앙값</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{metricValue(interconnection?.metrics.median_active_age_years)}</p></div>
              <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">최근 접수→상업운전 중앙 기간</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{metricValue(interconnection?.metrics.recent_ir_to_cod_median_years)}</p></div>
            </div>
            <div className="mt-5 rounded-lg border border-border/70 p-3">
              <p className="mb-3 text-sm font-medium">연도별 접수·완료·철회 기록 · GW</p>
              {queueHistory.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={queueHistory} margin={{ top: 8, right: 12, bottom: 6, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(0, 4)} tick={{ fontSize: 10 }} />
                      <YAxis width={58} tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}`} />
                      <Tooltip labelFormatter={(label) => `기준연도 ${String(label).slice(0, 4)}`} formatter={(value: number, name: string) => [`${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} GW`, name === "active_requests_gw" ? "해당 연도 접수 후 현재 활성" : name === "completed_gw" ? "해당 연도 상업운전 완료" : "해당 연도 철회"]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                      <Legend formatter={(value) => value === "active_requests_gw" ? "접수 후 현재 활성" : value === "completed_gw" ? "상업운전 완료" : "철회"} />
                      <Bar dataKey="active_requests_gw" fill={REGIME_SERIES_COLORS.blue} maxBarSize={24} isAnimationActive={false} />
                      <Bar dataKey="completed_gw" fill={REGIME_SERIES_COLORS.cyan} maxBarSize={24} isAnimationActive={false} />
                      <Bar dataKey="withdrawn_gw" fill={REGIME_SERIES_COLORS.pink} maxBarSize={24} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">접속 대기 이력이 부족합니다.</div>}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              발전·저장 공급 프로젝트가 송전망에 연결되기까지의 대기열입니다. 데이터센터 부하의 접속 대기열은 아닙니다. 활성 총량에는 LBNL의 하이브리드 저장용량 보정치가 포함됩니다.
            </p>
            {interconnection?.provenance.source_url && <a href={interconnection.provenance.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">LBNL Queued Up 원자료</a>}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-medium text-primary">5단계 · 회계상 투자</p>
            <h3 className="mt-1 text-lg font-semibold">송전 투자 실행</h3>
          </div>
          <p className="text-xs text-muted-foreground">FERC Form 1 · {transmission?.observation_date || "미수집"}</p>
        </div>
        <Card className={TONE_STYLES[transmissionTone].panel}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>미국 전력사업자 송전설비 증가액</CardTitle>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{transmission?.reason || "송전 투자자료를 아직 수집하지 않았습니다."}</p>
              </div>
              <Badge variant={TONE_STYLES[transmissionTone].badge}>{transmissionInvestmentAxisLabel(transmission?.state)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">최근 연간 증가액</p><p className={`mt-0.5 text-sm font-semibold tabular-nums ${TONE_STYLES[transmissionTone].text}`}>{usdBillions(transmission?.metrics.annual_additions_usd)}</p></div>
              <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">동일 보고사 3년 CAGR</p><p className={`mt-0.5 text-sm font-semibold tabular-nums ${TONE_STYLES[transmissionTone].text}`}>{metricValue(transmission?.metrics.like_for_like_three_year_cagr_pct)}</p></div>
              <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">최근 보고 사업자</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{metricValue(transmission?.metrics.reporter_count, 1, 0)}</p></div>
              <div className="rounded-md bg-muted/50 px-3 py-2"><p className="text-[11px] text-muted-foreground">현재 보고사의 전년 비교 가능률</p><p className="mt-0.5 text-sm font-semibold tabular-nums">{metricValue(transmission?.metrics.current_reporter_prior_year_coverage_pct)}</p></div>
            </div>
            <div className="mt-5 rounded-lg border border-border/70 p-3">
              <p className="mb-3 text-sm font-medium">연간 송전설비 증가액 · 십억달러</p>
              {transmissionHistory.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transmissionHistory} margin={{ top: 8, right: 12, bottom: 6, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(0, 4)} tick={{ fontSize: 10 }} />
                      <YAxis width={54} tick={{ fontSize: 10 }} tickFormatter={(value) => `$${value}`} />
                      <Tooltip labelFormatter={(label) => `회계연도 ${String(label).slice(0, 4)}`} formatter={(value: number) => [`$${Number(value).toFixed(1)}B`, "송전설비 증가액"]} contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="additions_billion" fill={REGIME_SERIES_COLORS.cyan} maxBarSize={36} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">송전 투자 이력이 부족합니다.</div>}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              PUDL이 정리한 FERC Form 1 명목 회계자료입니다. 보고사 표본의 설비 증가액이며 미국 전체 송전투자의 완전한 총계로 해석하지 않습니다.
            </p>
            {transmission?.provenance.source_url && <a href={transmission.provenance.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">PUDL · FERC Form 1 자료 안내</a>}
          </CardContent>
        </Card>
      </section>

      <details className="group rounded-lg border border-border/70 bg-card/40">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">월간 후행 총량·연간 가동설비 추이 보기</summary>
        <div className="grid gap-6 border-t border-border/70 p-5 xl:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium">월간 판매·발전량 · TWh</p>
            {monthly.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} /><XAxis dataKey="date" tickFormatter={formatDate} minTickGap={28} tick={{ fontSize: 10 }} /><YAxis width={48} tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} /><Line type="monotone" dataKey="generation" name="순발전" stroke={REGIME_SERIES_COLORS.blue} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="total" name="총판매" stroke={REGIME_SERIES_COLORS.violet} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="commercial" name="상업용" stroke={REGIME_SERIES_COLORS.cyan} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <p className="text-sm text-muted-foreground">미수집</p>}
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">연간 순하계 설비용량 · GW</p>
            {capacity.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={capacity}><CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => String(value).slice(0, 4)} tick={{ fontSize: 10 }} /><YAxis width={52} tick={{ fontSize: 10 }} domain={["auto", "auto"]} /><Tooltip contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }} /><Line type="monotone" dataKey="capacity" name="설비용량" stroke={REGIME_SERIES_COLORS.blue} dot={{ r: 2 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <p className="text-sm text-muted-foreground">미수집</p>}
          </div>
        </div>
      </details>
    </div>
  );
}

function JudgmentEditor({ snapshot }: { snapshot: RegimeSnapshot }) {
  const client = useQueryClient();
  const [level, setLevel] = useState<RegimeLevel | "">(
    snapshot.user_regime || "",
  );
  const [note, setNote] = useState(snapshot.user_note || "");
  const mutation = useMutation({
    mutationFn: () =>
      regimeApi.updateSnapshot(snapshot.id, {
        user_regime: level || undefined,
        user_note: note || undefined,
      }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["regime", "history"] }),
  });
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-[260px_1fr_auto]">
      <select
        className="h-10 rounded-md border bg-background px-3 text-sm"
        value={level}
        onChange={(e) => setLevel(e.target.value as RegimeLevel | "")}
      >
        <option value="">내 판정 미입력</option>
        {LEVELS.map((item) => (
          <option key={item} value={item}>{regimeLevelLabel(item)}</option>
        ))}
      </select>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="판단 메모 (선택)"
        className="min-h-10"
      />
      <Button
        variant="outline"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        저장
      </Button>
    </div>
  );
}

export function RegimePage() {
  const client = useQueryClient();
  const [judgment, setJudgment] = useState<RegimeLevel | "">("");
  const [note, setNote] = useState("");
  const [snapshotSavedAt, setSnapshotSavedAt] = useState<string | null>(null);
  const current = useQuery({
    queryKey: ["regime", "current"],
    queryFn: regimeApi.getCurrent,
  });
  const history = useQuery({
    queryKey: ["regime", "history"],
    queryFn: regimeApi.getHistory,
  });
  const refresh = useMutation({
    mutationFn: regimeApi.refresh,
    onSuccess: () => client.invalidateQueries({ queryKey: ["regime"] }),
  });
  const snapshot = useMutation({
    mutationFn: () =>
      regimeApi.createSnapshot({
        user_regime: judgment || undefined,
        user_note: note || undefined,
      }),
    onSuccess: () => {
      setNote("");
      setSnapshotSavedAt(new Date().toISOString());
      client.invalidateQueries({ queryKey: ["regime"] });
    },
  });
  const data = current.data;
  const blockingDataIssue = data?.data_quality.status === "판정 불가";

  return (
    <div className="space-y-8 pb-14 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-6">
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-primary">
            <span>포트폴리오 조기점검</span>
            <InfoTip label="투자 레짐 판정 체계">
              현재 투자 가설 판정은 미국 거시 수준·최근 지표 방향·금융여건을
              같은 규칙으로 계산하고 여러 독립 발표에서 재확인한 결과입니다.
              전환 후보는 최신 자료로 먼저 계산된 값이며, 같은 방향이 반복 확인되기
              전에는 현재 판정을 바꾸지 않습니다. 데이터 품질은 자료가 얼마나
              빠짐없이 수집됐는지를 뜻하며 예측 적중률이 아닙니다.
            </InfoTip>
          </div>
          <h1 className="text-3xl font-bold">투자 레짐</h1>
          <p className="mt-2 text-muted-foreground">
            상세 포트폴리오 점검이 필요한 순간을 데이터와 규칙으로 알려줍니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`}
            />
            데이터 새로고침
          </Button>
        </div>
      </div>
      {blockingDataIssue && (
        <Alert variant="destructive">
          <Database className="h-4 w-4" />
          <AlertTitle>핵심 판정자료 부족</AlertTitle>
          <AlertDescription>
            {data.data_quality.reasons.join(" · ")}. 현재 자동 판정의 범위가 제한됩니다.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList>
          <TabsTrigger value="current">현재</TabsTrigger>
          <TabsTrigger value="indicators">지표</TabsTrigger>
          <TabsTrigger value="history">기록</TabsTrigger>
        </TabsList>
        <TabsContent value="current" className="mt-0 space-y-8 pt-3">
          {data ? (
            <RegimeCurrentOverview
              data={data}
              judgment={judgment}
              note={note}
              snapshotPending={snapshot.isPending}
              snapshotSavedAt={snapshotSavedAt}
              onJudgment={setJudgment}
              onNote={setNote}
              onSnapshot={() => snapshot.mutate()}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-muted-foreground">
                판정 데이터를 불러오는 중입니다.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="indicators" className="mt-0">
          <Tabs defaultValue="market" className="space-y-6">
            <div className="sticky top-16 z-10 -mx-1 border-b border-border/70 bg-background/95 px-1 py-3 backdrop-blur">
              <div className="grid gap-2 sm:flex sm:w-max sm:items-end sm:gap-5">
                <div className="max-w-full overflow-x-auto sm:overflow-visible">
                  <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    거시·시장
                  </p>
                  <TabsList className="w-max">
                    {MACRO_DOMAIN_TABS.map((tab) => (
                      <TabsTrigger key={tab.id} value={tab.id}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                <div className="hidden h-9 w-px bg-border sm:block" />
                <div className="max-w-full overflow-x-auto sm:overflow-visible">
                  <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    AI 투자 가설
                  </p>
                  <TabsList className="w-max">
                    {THESIS_DOMAIN_TABS.map((tab) => (
                      <TabsTrigger key={tab.id} value={tab.id}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>
            </div>
            <TabsContent value="market" className="mt-0 space-y-6">
              <MarketIndicators
                signals={
                  data?.signals.filter((signal) =>
                    signal.id.startsWith("market_"),
                  ) || []
                }
                fetchedAt={data?.data_quality.last_fetched_at}
                triggers={data?.triggers || []}
              />
            </TabsContent>
            {DOMAIN_TABS.filter((tab) => tab.id !== "market").map((tab) => {
              if (tab.id === "ai") {
                return (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    {data && <AiCapexDashboard data={data.ai_capex} />}
                  </TabsContent>
                );
              }
              if (tab.id === "semiconductor") {
                return (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    {data && (
                      <SemiconductorDashboard
                        data={data.semiconductor_cycle}
                        memory={data.memory_cycle}
                      />
                    )}
                  </TabsContent>
                );
              }
              if (tab.id === "power") {
                return (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    {data && <PowerDashboard data={data.power_cycle} />}
                  </TabsContent>
                );
              }
              const rawSignals =
                data?.signals.filter((signal) => signal.domain === tab.id) ||
                [];
              const signals = tab.id === "rates"
                ? [...rawSignals].sort((a, b) => {
                    const aIndex = RATE_SIGNAL_ORDER.indexOf(a.id);
                    const bIndex = RATE_SIGNAL_ORDER.indexOf(b.id);
                    return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
                  })
                : rawSignals;
              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="mt-0 space-y-6"
                >
                  <div className="px-1">
                    <h2 className="text-xl font-semibold">{tab.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {signals.length}개 지표 · 최신 관측값과 변화 구간을 함께
                      표시합니다.
                    </p>
                  </div>
                  {tab.id === "rates" && data && (
                    <>
                      <RateModelOverview data={data} signals={signals} />
                      <div className="grid gap-6 xl:grid-cols-2">
                        <RateComparison signals={signals} />
                        <LongEndComparison signals={signals} />
                      </div>
                    </>
                  )}
                  {tab.id === "rates" ? (
                    <RateSignalGroups signals={signals} />
                  ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {signals.map((signal) => (
                        <SignalCard key={signal.id} signal={signal} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </TabsContent>
        <TabsContent value="history" className="mt-0 space-y-4">
          {history.data?.length ? (
            history.data.map((item) => {
              const recordedDirection =
                item.macro_quadrant?.pressure_vector?.direction ||
                item.macro_quadrant?.momentum_vector?.direction ||
                "미확인";
              return (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">기록 {new Date(item.created_at).toLocaleString("ko-KR")}</span>
                    <span className="text-xs text-muted-foreground">거시 기준 {item.as_of_date || "-"}</span>
                    <Badge variant={TONE_STYLES[regimeLevelTone(item.automatic_regime)].badge}>
                      기록 당시 {regimeLevelLabel(item.automatic_regime)}
                    </Badge>
                    {item.review_urgency && (
                      <Badge variant={item.review_urgency === "required" ? "danger" : item.review_urgency === "watch" ? "warning" : "neutral"}>
                        {reviewUrgencyLabel(item.review_urgency)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 rounded-lg bg-muted/20 p-4 text-xs sm:grid-cols-2 lg:grid-cols-5">
                    <p><span className="text-muted-foreground">사용자 판정</span><span className="mt-1 block font-medium">{item.user_regime ? regimeLevelLabel(item.user_regime) : "미입력"}</span></p>
                    <p><span className="text-muted-foreground">경제환경·최근 방향</span><span className="mt-1 block font-medium">{macroEnvironmentLabel(item.macro_quadrant?.environment_point?.label)} / {momentumDirectionLabel(recordedDirection)}</span></p>
                    <p><span className="text-muted-foreground">활성 위험 신호</span><span className="mt-1 block font-medium">{item.triggers?.length || 0}개</span></p>
                    <p><span className="text-muted-foreground">AI·메모리 보조지표</span><span className="mt-1 block font-medium">CAPEX {aiCapexStateLabel(item.ai_capex?.state)} · DRAM {memoryPriceStateLabel(item.memory_cycle?.state)} · NAND {nandPriceStateLabel(item.memory_cycle?.nand_state)}</span></p>
                    <p><span className="text-muted-foreground">수급·전력 보조지표</span><span className="mt-1 block font-medium">반도체 {semiconductorStateLabel(item.semiconductor_cycle?.state)} · 전력 {powerStateLabel(item.power_cycle?.state)}</span></p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.reasons?.slice(0, 3).map(plainLanguageStateText).join(" · ") ||
                      "저장된 주요 판정 사유 없음"}
                  </p>
                  {item.triggers?.length ? (
                    <ul className="mt-4 space-y-2 text-sm">
                      {item.triggers.slice(0, 3).map((trigger) => (
                        <li key={trigger.rule_id} className="rounded-md border bg-muted/10 px-3 py-2">
                          <span className="mr-2 text-xs text-muted-foreground">당시 충족한 점검 기준</span>
                          {plainLanguageStateText(trigger.summary)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <details className="mt-4 rounded-lg border bg-muted/10">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
                      기록 세부정보
                    </summary>
                    <div className="grid gap-4 border-t px-4 py-4 text-xs md:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">영역별 당시 상태</p>
                        <p className="mt-2 leading-6">
                          {item.domains?.map((domain) => `${domain.name} ${domainStateLabel(domain.id, domain.state)}`).join(" · ") || "미확인"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">재현 정보</p>
                        <p className="mt-2 leading-6">
                          규칙 {item.rule_version || "미확인"} · 저장 형식 {item.snapshot_schema_version || "1"}
                          {item.input_fingerprint ? ` · 입력 ${item.input_fingerprint.slice(0, 10)}` : ""}
                        </p>
                      </div>
                    </div>
                  </details>
                  <JudgmentEditor snapshot={item} />
                </CardContent>
              </Card>
            )})
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                아직 비교 기준이 없습니다. 현재 탭에서 첫 상태를 기록하면 이후
                경보와 판정 변화를 비교할 수 있습니다.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
