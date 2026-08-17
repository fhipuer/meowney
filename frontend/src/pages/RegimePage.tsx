import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Database, Download, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Bar,
  BarChart,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/ui/info-tip";
import { regimeApi } from "@/lib/api";
import {
  TONE_STYLES,
  aiCapexDeltaTone,
  aiCapexTone,
  memoryPriceTone,
  memorySupplierPriceDeltaTone,
  regimeLevelTone,
  signalStatusTone,
} from "@/lib/regime-tone";
import type {
  RegimeCurrent,
  RegimeLevel,
  RegimeSignal,
  RegimeSnapshot,
  ReviewUrgency,
} from "@/types";

const LEVELS: RegimeLevel[] = ["유지", "경계", "약화", "전환"];
const DOMAIN_TABS = [
  { id: "market", label: "시장" },
  { id: "growth", label: "성장·고용" },
  { id: "inflation", label: "물가" },
  { id: "rates", label: "금리" },
  { id: "liquidity", label: "유동성·신용" },
  { id: "ai", label: "AI CAPEX·메모리" },
];
const urgencyLabel: Record<ReviewUrgency, string> = {
  required: "지금 다시 상세점검",
  watch: "다음 발표까지 관찰",
  not_needed: "새 상세점검 사유 없음",
};
const memoryStateLabel: Record<string, string> = {
  "가격 확장": "관측가격 큰 폭 상승",
  "가격 상승": "관측가격 상승",
  "하락 관찰": "관측가격 하락 관찰",
  "가격 유지": "관측가격 변화 미미",
};
const signalStatusLabel: Record<string, string> = {
  강함: "우호 범위",
  중립: "중립 범위",
  둔화: "주의 범위",
  약화: "악화 범위",
  unavailable: "미수집",
};

export function signalRuleHelp(signal: RegimeSignal) {
  if (["us_unemployment", "us_claims"].includes(signal.id))
    return "최근 3개월 노동시장 변화로 판정합니다. 실업률·실업수당 상승은 악화 방향, 하락은 개선 방향입니다.";
  if (
    ["cpi", "core_cpi", "pce", "core_pce", "ppi", "wages"].includes(signal.id)
  )
    return "최근 3개월 연율을 사용합니다. 물가·임금 상승세 재가속은 악화 방향, 목표 수준을 향한 둔화는 개선 방향입니다.";
  if (
    ["us3m", "us10y", "tips10y", "bei10y", "term_premium", "fedfunds"].includes(
      signal.id,
    )
  )
    return "주로 최근 3개월 금리 변화로 판정하며, 실질금리와 기간 프리미엄은 높은 절대수준도 함께 봅니다. 상승은 금융여건 악화 방향입니다.";
  if (["hy_oas", "ig_oas", "nfci", "curve2s10s"].includes(signal.id))
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
}: {
  label: string;
  value?: number | null;
  unit?: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
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
  const chartColors = ["#60a5fa", "#f59e0b", "#34d399"];
  const role =
    signal.usage === "regime"
      ? "레짐 산출"
      : signal.usage === "trigger"
        ? "경보 전용"
        : "맥락 지표";
  const status =
    signal.is_stale
      ? `오래됨 · ${signal.age_days ?? "-"}일`
      : signal.usage === "display" && signal.status !== "unavailable"
      ? "판정 미적용"
      : signalStatusLabel[signal.status] || signal.status;
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
              <Badge variant="outline" className="text-[10px] font-normal">
                {role}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {signal.source.toUpperCase()} · 관측{" "}
              {signal.observation_date || "미수집"} · {signal.display_period}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge
              className="whitespace-nowrap"
              variant={TONE_STYLES[tone].badge}
            >
              {status}
            </Badge>
            <InfoTip label={`${signal.name} ${signal.usage === "display" ? "사용 범위" : "판정 기준"}`}>
              {signal.usage === "display"
                ? "현재 환경을 해석하는 보조자료이며 자동 레짐과 임계경보 계산에는 사용하지 않습니다. 현재 카드는 최신 저장값을 표시합니다."
                : `${signalRuleHelp(signal)} 현재 판정 근거: ${signal.reason}. 현재 카드는 최신 저장값을 표시하며 초기 발표값과 수정 이력은 시점기준 이력으로 별도 보관합니다.`}
              {signal.is_stale
                ? ` 최신 관측이 허용기간 ${signal.max_age_days ?? "-"}일을 넘어 판정에서 제외됐습니다.`
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
            {signal.reason} · {role} 지표입니다.
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
    <Card className="mb-6">
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
                stroke="#60a5fa"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="tips10y"
                name="10Y 실질"
                stroke="#f97316"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="bei10y"
                name="10Y BEI"
                stroke="#34d399"
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

function AiCapexDashboard({
  data,
  memory,
}: {
  data: NonNullable<RegimeCurrent["ai_capex"]>;
  memory: RegimeCurrent["memory_cycle"];
}) {
  const chartData = Array.from(
    new Set(data.companies.flatMap((company) => company.history.map((point) => point.period))),
  )
    .sort()
    .slice(-8)
    .map((period) => ({
      period,
      ...Object.fromEntries(
        data.companies.map((company) => [
          company.id,
          company.history.find((point) => point.period === period)?.value == null
            ? null
            : (company.history.find((point) => point.period === period)?.value as number) / 1e9,
        ]),
      ),
    }));
  const colors: Record<string, string> = {
    microsoft: "#60a5fa",
    alphabet: "#fbbf24",
    meta: "#a78bfa",
    amazon: "#34d399",
  };
  const stateTone = aiCapexTone(data.state);
  return (
    <div className="space-y-6">
      <div className="px-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">하이퍼스케일러 설비투자 프록시</h2>
          <Badge variant={TONE_STYLES[stateTone].badge}>{data.state}</Badge>
          <InfoTip label="설비투자 프록시의 범위">
            SEC 공시의 기업 전체 현금 CAPEX입니다. AI 인프라 투자도 포함하지만
            AI 전용 금액은 분리되지 않으므로 투자 강도의 보조지표로 사용합니다.
          </InfoTip>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{data.reason}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>기업별 분기 총 현금 CAPEX</CardTitle>
          <p className="text-sm text-muted-foreground">
            SEC 공시 기준 · 십억 달러
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
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
          ) : (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              데이터 새로고침으로 SEC 공시를 수집해주세요.
            </div>
          )}
        </CardContent>
      </Card>
      <MemoryCyclePanel data={memory} />
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
          산출 방식 · 회사별 회계분기 기준
          {data.as_of_range?.from && data.as_of_range?.to
            ? ` · 최신 분기 범위 ${data.as_of_range.from}~${data.as_of_range.to}`
            : ""}
        </span>
        <InfoTip label="CAPEX 산출 방식">{data.methodology}</InfoTip>
      </div>
    </div>
  );
}

function MemoryCyclePanel({ data }: { data: RegimeCurrent["memory_cycle"] }) {
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
  const dramSeries = ordered.filter((item) => !item.market_type.startsWith("nand_"));
  const nandSeries = ordered.filter((item) => item.market_type.startsWith("nand_"));
  const historySeries = ordered.filter((item) => item.history.length > 1).slice(0, 6);
  const historyByDate = new Map<string, Record<string, string | number>>();
  historySeries.forEach((item) => {
    const base = item.history[0]?.price_average;
    if (!base) return;
    item.history.forEach((point) => {
      historyByDate.set(point.observation_date, {
        ...(historyByDate.get(point.observation_date) || { date: point.observation_date }),
        [item.series_id]: Number(((point.price_average / base) * 100).toFixed(2)),
      });
    });
  });
  const memoryHistory = [...historyByDate.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  const memoryColors = ["#60a5fa", "#a78bfa", "#34d399", "#f59e0b", "#f472b6", "#22d3ee"];
  const priceCard = (item: (typeof ordered)[number]) => {
    const tone = memorySupplierPriceDeltaTone(
      item.change_percent,
      !item.is_stale,
    );
    return (
      <div key={item.series_id} className="rounded-lg border bg-muted/20 p-4">
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
      </div>
    );
  };
  const dramTone = memoryPriceTone(data.state);
  const nandTone = memoryPriceTone(data.nand_state);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>공개 DRAM 가격 표본</CardTitle>
          <Badge variant={TONE_STYLES[dramTone].badge}>{memoryStateLabel[data.state] || data.state}</Badge>
          <InfoTip label="공개 DRAM 표본의 범위">
            공개된 DDR5 SO-DIMM Contract와 일부 Spot 가격을 봅니다. Server
            DRAM·HBM·NAND 전체를 대표하지 않으며 AI 수요의 직접 판정에는
            사용하지 않습니다.
          </InfoTip>
        </div>
        <p className="text-sm text-muted-foreground">{data.reason}</p>
      </CardHeader>
      <CardContent>
        {memoryHistory.length > 1 && (
          <div className="mb-6 rounded-lg border bg-muted/10 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">수집 이후 가격 방향 비교</p>
              <p className="text-xs text-muted-foreground">각 표본의 첫 관측값=100</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memoryHistory} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={36} tick={{ fontSize: 11 }} />
                  <YAxis width={48} tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip
                    labelFormatter={(label) => `관측일 ${label}`}
                    formatter={(value: number, name: string) => [
                      Number(value).toFixed(1),
                      historySeries.find((item) => item.series_id === name)?.product_name || name,
                    ]}
                    contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Legend formatter={(value) => historySeries.find((item) => item.series_id === value)?.product_name || value} />
                  {historySeries.map((item, index) => (
                    <Line
                      key={item.series_id}
                      type="monotone"
                      dataKey={item.series_id}
                      stroke={memoryColors[index % memoryColors.length]}
                      dot={false}
                      connectNulls
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {dramSeries.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dramSeries.map(priceCard)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">공개 가격표를 아직 수집하지 않았습니다.</p>
        )}
        <div className="mt-7 border-t pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">공개 NAND 가격 표본</h3>
            <Badge variant={TONE_STYLES[nandTone].badge}>{data.nand_state}</Badge>
            <InfoTip label="공개 NAND 표본의 범위">
              512Gb TLC wafer spot을 주 방향 신호로 사용하고 PC Client SSD
              계약가격을 함께 표시합니다. Enterprise SSD 계약가격·재고·출하량을
              직접 측정하는 지표는 아닙니다.
            </InfoTip>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{data.nand_reason}</p>
          {nandSeries.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{nandSeries.map(priceCard)}</div>
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
    <div className="mt-5 grid gap-3 md:grid-cols-[160px_1fr_auto]">
      <select
        className="h-10 rounded-md border bg-background px-3 text-sm"
        value={level}
        onChange={(e) => setLevel(e.target.value as RegimeLevel | "")}
      >
        <option value="">내 판정 미입력</option>
        {LEVELS.map((item) => (
          <option key={item}>{item}</option>
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
      client.invalidateQueries({ queryKey: ["regime"] });
    },
  });
  const data = current.data;
  const unhealthyFeeds = data
    ? Object.entries(data.feed_health || {}).filter(([, feed]) =>
        feed && ["failed", "partial", "configuration_required"].includes(feed.status),
      )
    : [];

  return (
    <div className="space-y-8 pb-14 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-6">
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-primary">
            <span>포트폴리오 조기점검</span>
            <InfoTip label="투자 레짐 판정 체계">
              확정 점검 레짐은 미국 거시 수준·최근 모멘텀·금융여건을 동일한
              판정 경로로 계산한 뒤 독립 발표에서 재확인한 상태입니다. 후보는
              최신 자료의 즉시 계산이며, 경제환경 4분면 자체와는 용도가
              다릅니다. 데이터 품질은 수집 완전성을 뜻하며 예측 적중률이
              아닙니다.
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
            onClick={() => regimeApi.downloadMarkdown()}
          >
            <Download className="mr-2 h-4 w-4" />
            상세점검용 데이터
          </Button>
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
      {data?.last_fetch?.status === "failed" && (
        <Alert variant="destructive">
          <AlertTitle>최근 갱신 실패</AlertTitle>
          <AlertDescription>
            마지막 정상 캐시를 표시합니다. {data.last_fetch.error}
          </AlertDescription>
        </Alert>
      )}
      {unhealthyFeeds.length > 0 && (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>일부 외부 데이터 연결 제한</AlertTitle>
          <AlertDescription>
            {unhealthyFeeds
              .map(([name, feed]) => `${name}: ${feed?.status}`)
              .join(" · ")}
            . 정상 캐시는 유지되며 각 영역의 최신성을 별도로 표시합니다.
          </AlertDescription>
        </Alert>
      )}
      {data?.is_stale && (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>오래된 캐시 사용 중</AlertTitle>
          <AlertDescription>
            하나 이상의 미국 판정입력이 허용 최신성 범위를 벗어났습니다.
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
            <div className="sticky top-16 z-10 -mx-1 overflow-x-auto bg-background/95 px-1 py-3 backdrop-blur">
              <TabsList className="w-max">
                {DOMAIN_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="market" className="mt-0 space-y-6">
              <MarketIndicators
                signals={
                  data?.signals.filter((signal) =>
                    signal.id.startsWith("market_"),
                  ) || []
                }
                fetchedAt={data?.data_quality.last_fetched_at}
              />
            </TabsContent>
            {DOMAIN_TABS.filter((tab) => tab.id !== "market").map((tab) => {
              if (tab.id === "ai") {
                return (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    {data && <AiCapexDashboard data={data.ai_capex} memory={data.memory_cycle} />}
                  </TabsContent>
                );
              }
              const signals =
                data?.signals.filter((signal) => signal.domain === tab.id) ||
                [];
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
                  {tab.id === "rates" && <RateComparison signals={signals} />}
                  <div className="grid gap-5 xl:grid-cols-2">
                    {signals.map((signal) => (
                      <SignalCard key={signal.id} signal={signal} />
                    ))}
                  </div>
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
                      확정 {item.automatic_regime}
                    </Badge>
                    {item.review_urgency && (
                      <Badge variant={item.review_urgency === "required" ? "danger" : item.review_urgency === "watch" ? "warning" : "neutral"}>
                        {urgencyLabel[item.review_urgency]}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 rounded-lg bg-muted/20 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <p><span className="text-muted-foreground">사용자 판정</span><span className="mt-1 block font-medium">{item.user_regime || "미입력"}</span></p>
                    <p><span className="text-muted-foreground">경제환경·최근 방향</span><span className="mt-1 block font-medium">{item.macro_quadrant?.environment_point?.label || "미확인"} / {recordedDirection}</span></p>
                    <p><span className="text-muted-foreground">활성 임계신호</span><span className="mt-1 block font-medium">{item.triggers?.length || 0}개</span></p>
                    <p><span className="text-muted-foreground">AI·메모리 보조지표</span><span className="mt-1 block font-medium">CAPEX {item.ai_capex?.state || "미확인"} · DRAM {item.memory_cycle?.state ? memoryStateLabel[item.memory_cycle.state] || item.memory_cycle.state : "미확인"} · NAND {item.memory_cycle?.nand_state || "미확인"}</span></p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.reasons?.slice(0, 3).join(" · ") ||
                      "저장된 주요 판정 사유 없음"}
                  </p>
                  {item.triggers?.length ? (
                    <ul className="mt-4 space-y-2 text-sm">
                      {item.triggers.slice(0, 3).map((trigger) => (
                        <li key={trigger.rule_id} className="rounded-md border bg-muted/10 px-3 py-2">
                          <span className="mr-2 text-xs text-muted-foreground">당시 활성 임계</span>
                          {trigger.summary}
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
                          {item.domains?.map((domain) => `${domain.name} ${domain.state}`).join(" · ") || "미확인"}
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
