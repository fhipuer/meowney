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
const levelClass: Record<string, string> = {
  유지: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  경계: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  약화: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  전환: "border-red-400/25 bg-red-400/10 text-red-300",
  강함: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  중립: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  둔화: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  "데이터 없음": "border-slate-400/20 bg-slate-400/10 text-slate-400",
};
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
    ["us10y", "tips10y", "bei10y", "term_premium", "fedfunds"].includes(
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
      <p
        className={`mt-0.5 text-sm font-medium ${value != null && value < 0 ? "text-red-500" : ""}`}
      >
        {value == null
          ? "-"
          : `${value > 0 ? "+" : ""}${value.toFixed(1)}${unit}`}
      </p>
    </div>
  );
}

function SignalCard({ signal }: { signal: RegimeSignal }) {
  const history = signal.history || [];
  const metrics = signal.display_metrics || [];
  const role =
    signal.usage === "regime"
      ? "레짐 산출"
      : signal.usage === "trigger"
        ? "경보 전용"
        : "맥락 지표";
  const status =
    signal.usage === "display" && signal.status !== "unavailable"
      ? "판정 미적용"
      : signalStatusLabel[signal.status] || signal.status;
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
            {signal.available_from && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                이용 가능 {signal.available_from}
                {signal.vintage_kind === "initial" ? " · 초도 발표일 기록 보유" : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge
              className={`${signal.usage === "display" ? levelClass["데이터 없음"] : levelClass[signal.status] || ""} whitespace-nowrap`}
            >
              {status}
            </Badge>
            {signal.usage !== "display" && (
              <InfoTip label={`${signal.name} 판정 기준`}>
                {signalRuleHelp(signal)} 현재 판정 근거: {signal.reason}.
              </InfoTip>
            )}
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
      <CardContent className="pt-3">
        {history.length > 1 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={history}
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
                <Line
                  type="monotone"
                  dataKey="value"
                  name={signal.name}
                  stroke="hsl(var(--primary))"
                  dot={false}
                  activeDot={{ r: 4 }}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            차트를 그릴 관측값이 부족합니다.
          </div>
        )}
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
  const selected = signals.filter((signal) =>
    ["us10y", "tips10y", "bei10y"].includes(signal.id),
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
  const chartData = [...byDate.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
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
          명목 10Y ≈ 실질 10Y(TIPS) + 기대인플레이션(BEI)
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
  return (
    <div className="space-y-6">
      <div className="px-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">하이퍼스케일러 설비투자 프록시</h2>
          <Badge variant={data.coverage >= 0.75 ? "secondary" : "outline"}>{data.state}</Badge>
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
                <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
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
                    <Bar key={company.id} dataKey={company.id} stackId="capex" fill={colors[company.id]} isAnimationActive={false} />
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
                YoY {company.yoy == null ? "-" : `${company.yoy > 0 ? "+" : ""}${company.yoy.toFixed(1)}%`} · TTM {company.ttm == null ? "-" : `$${(company.ttm / 1e9).toFixed(1)}B`}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">기준 {company.latest_period || "미수집"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
        <span>산출 방식</span>
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
  const priceCard = (item: (typeof ordered)[number]) => (
    <div key={item.series_id} className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5">{item.product_name}</p>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {item.market_type === "contract" ? "월간 Contract"
            : item.market_type === "module_spot" ? "Module Spot"
              : item.market_type === "nand_wafer_spot" ? "TLC Wafer Spot"
                : item.market_type === "nand_client_ssd_contract" ? "Client SSD Contract" : "Spot"}
        </Badge>
      </div>
      <p className="mt-4 text-2xl font-semibold">{item.price_average.toLocaleString("en-US", { maximumFractionDigits: 3 })}</p>
      <p className={`mt-1 text-sm ${(item.change_percent || 0) > 0 ? "text-amber-300" : (item.change_percent || 0) < 0 ? "text-sky-300" : "text-muted-foreground"}`}>
        {item.change_percent == null ? "변화율 미제공" : `${item.change_percent > 0 ? "+" : ""}${item.change_percent.toFixed(2)}%`}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">기준 {item.observation_date}{item.period_label ? ` · ${item.period_label}` : ""}</p>
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>공개 DRAM 가격 표본</CardTitle>
          <Badge variant={data.state === "판정 불가" ? "outline" : "secondary"}>{memoryStateLabel[data.state] || data.state}</Badge>
          <InfoTip label="공개 DRAM 표본의 범위">
            공개된 DDR5 SO-DIMM Contract와 일부 Spot 가격을 봅니다. Server
            DRAM·HBM·NAND 전체를 대표하지 않으며 AI 수요의 직접 판정에는
            사용하지 않습니다.
          </InfoTip>
        </div>
        <p className="text-sm text-muted-foreground">{data.reason}</p>
      </CardHeader>
      <CardContent>
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
            <Badge variant={data.nand_state === "판정 불가" ? "outline" : "secondary"}>{data.nand_state}</Badge>
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

  return (
    <div className="space-y-8 pb-14 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-6">
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-primary">
            <span>포트폴리오 조기점검</span>
            <InfoTip label="투자 레짐 판정 체계">
              확정 레짐은 독립된 핵심 발표에서 재확인된 상태, 후보 레짐은 최신
              자료의 즉시 계산입니다. 데이터 품질은 수집 완전성을 뜻하며 예측
              적중률이 아닙니다.
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
      {data?.is_stale && (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>오래된 캐시 사용 중</AlertTitle>
          <AlertDescription>
            마지막 정상 수집 후 {data.cache_age_hours}시간이 지났습니다.
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
            history.data.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">기록 {new Date(item.created_at).toLocaleString("ko-KR")}</span>
                    <span className="text-xs text-muted-foreground">거시 기준 {item.as_of_date || "-"}</span>
                    <Badge className={levelClass[item.automatic_regime]}>
                      확정 {item.automatic_regime}
                    </Badge>
                    {item.review_urgency && (
                      <Badge variant="secondary">
                        {urgencyLabel[item.review_urgency]}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 rounded-lg bg-muted/20 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <p><span className="text-muted-foreground">사용자 판정</span><span className="mt-1 block font-medium">{item.user_regime || "미입력"}</span></p>
                    <p><span className="text-muted-foreground">경제환경</span><span className="mt-1 block font-medium">{item.macro_quadrant?.environment_point?.label || "미확인"}</span></p>
                    <p><span className="text-muted-foreground">활성 임계신호</span><span className="mt-1 block font-medium">{item.triggers?.length || 0}개</span></p>
                    <p><span className="text-muted-foreground">AI·메모리 보조지표</span><span className="mt-1 block font-medium">CAPEX {item.ai_capex?.state || "미확인"} · DRAM {item.memory_cycle?.state ? memoryStateLabel[item.memory_cycle.state] || item.memory_cycle.state : "미확인"} · NAND {item.memory_cycle?.nand_state || "미확인"}</span></p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.reasons?.slice(0, 3).join(" · ") ||
                      "저장된 주요 판정 사유 없음"}
                  </p>
                  <JudgmentEditor snapshot={item} />
                </CardContent>
              </Card>
            ))
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
