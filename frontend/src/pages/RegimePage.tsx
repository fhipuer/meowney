import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Database, Download, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
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
  required: "지금 상세 점검 필요",
  watch: "관찰 필요",
  not_needed: "상세 점검 불필요",
};
const signalStatusLabel: Record<string, string> = {
  강함: "개선 신호",
  중립: "임계 변화 없음",
  둔화: "악화 접근",
  약화: "악화 신호",
  unavailable: "미수집",
};
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
                {signal.vintage_kind === "initial" ? " · 초기 발표값" : ""}
              </p>
            )}
          </div>
          <Badge
            className={
              signal.usage === "display"
                ? levelClass["데이터 없음"]
                : levelClass[signal.status] || ""
            }
          >
            {status}
          </Badge>
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
        <CardTitle>명목금리 구성 비교</CardTitle>
        <p className="text-sm text-muted-foreground">
          10Y 명목금리, 실질금리와 기대인플레이션을 동일 축에서 비교합니다.
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
  const [reviewCompleted, setReviewCompleted] = useState(false);
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
        review_completed: reviewCompleted,
      }),
    onSuccess: () => {
      setNote("");
      setReviewCompleted(false);
      client.invalidateQueries({ queryKey: ["regime"] });
    },
  });
  const data = current.data;

  return (
    <div className="space-y-8 pb-14 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-6">
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-medium text-primary">
            <span>포트폴리오 조기경보</span>
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
            분석 데이터
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
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="current" className="mt-0 space-y-8 pt-3">
          {data ? (
            <RegimeCurrentOverview
              data={data}
              judgment={judgment}
              note={note}
              reviewCompleted={reviewCompleted}
              snapshotPending={snapshot.isPending}
              onJudgment={setJudgment}
              onNote={setNote}
              onReviewCompleted={setReviewCompleted}
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
                    <span className="font-medium">
                      {new Date(item.created_at).toLocaleString("ko-KR")}
                    </span>
                    <Badge className={levelClass[item.automatic_regime]}>
                      자동 {item.automatic_regime}
                    </Badge>
                    <Badge variant="outline">
                      사용자 {item.user_regime || "미입력"}
                    </Badge>
                    {item.review_urgency && (
                      <Badge variant="secondary">
                        {urgencyLabel[item.review_urgency]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.reasons?.slice(0, 3).join(" · ") ||
                      "주요 악화 사유 없음"}
                  </p>
                  <JudgmentEditor snapshot={item} />
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                아직 공식 Snapshot이 없습니다.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
