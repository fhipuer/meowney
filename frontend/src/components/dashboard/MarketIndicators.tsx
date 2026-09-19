import {
  Activity,
  BarChart3,
  Coins,
  Gauge,
  Globe2,
  Landmark,
  Waves,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { REGIME_SERIES_COLORS, TONE_STYLES } from "@/lib/regime-tone";
import type { RegimeCurrent, RegimeSignal, RegimeTrigger } from "@/types";

type Props = {
  signals: RegimeSignal[];
  fetchedAt?: string | null;
  triggers?: RegimeTrigger[];
  energyShock?: RegimeCurrent["energy_shock"];
};

const META: Record<
  string,
  { short: string; role: string; icon: typeof Globe2; group: string }
> = {
  market_sp500: {
    short: "S&P 500",
    role: "미국 위험자산 베타",
    icon: BarChart3,
    group: "risk",
  },
  market_nasdaq: {
    short: "NASDAQ",
    role: "성장주·AI 민감도",
    icon: Activity,
    group: "risk",
  },
  market_kospi: {
    short: "KOSPI",
    role: "한국 경기·반도체 베타",
    icon: Globe2,
    group: "risk",
  },
  market_vix: {
    short: "VIX",
    role: "옵션 내재 변동성",
    icon: Gauge,
    group: "stress",
  },
  market_usdkrw: {
    short: "USD/KRW",
    role: "원화 포트폴리오 환율",
    icon: Landmark,
    group: "fx",
  },
  market_dxy: {
    short: "DXY",
    role: "익숙한 달러 시장 체감",
    icon: Landmark,
    group: "fx",
  },
  market_dollar: {
    short: "광의 달러",
    role: "글로벌 달러 긴축",
    icon: Landmark,
    group: "fx",
  },
  market_wti: {
    short: "WTI",
    role: "공급충격·에너지 물가",
    icon: Waves,
    group: "real",
  },
  market_ovx: {
    short: "OVX",
    role: "원유 옵션 내재 변동성",
    icon: Gauge,
    group: "real",
  },
  market_copper: {
    short: "구리",
    role: "글로벌 제조업 수요",
    icon: Coins,
    group: "real",
  },
  market_gold: {
    short: "COMEX 금 선물",
    role: "실질금리·달러·방어 수요",
    icon: Coins,
    group: "hedge",
  },
  market_silver: {
    short: "COMEX 은 선물",
    role: "산업 수요·귀금속 혼합",
    icon: Coins,
    group: "hedge",
  },
  market_gold_silver_ratio: {
    short: "금은비",
    role: "방어 선호·산업수요 상대 확인",
    icon: Gauge,
    group: "hedge",
  },
};

const signed = (value?: number | null) =>
  value == null
    ? "—"
    : `${value > 0 ? "↑ " : value < 0 ? "↓ " : ""}${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const formatValue = (signal: RegimeSignal) => {
  if (signal.value == null) return "—";
  if (signal.id === "market_usdkrw")
    return signal.value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  if (signal.id === "market_dxy") return signal.value.toFixed(2);
  if (signal.id === "market_dollar") return signal.value.toFixed(1);
  if (signal.id === "market_wti") return `$${signal.value.toFixed(1)} /배럴`;
  if (signal.id === "market_ovx") return signal.value.toFixed(1);
  if (signal.id === "market_copper")
    return `$${signal.value.toLocaleString("en-US", { maximumFractionDigits: 0 })} /톤`;
  if (signal.id === "market_gold" || signal.id === "market_silver")
    return `$${signal.value.toLocaleString("en-US", { maximumFractionDigits: 1 })} /온스`;
  if (signal.id === "market_gold_silver_ratio")
    return `${signal.value.toFixed(1)}배`;
  return signal.value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
};

function changeTone(value?: number | null) {
  return value == null || Math.abs(value) < 0.05
    ? "text-muted-foreground"
    : "text-foreground";
}

function marketAlertLabel(signalId: string) {
  if (["market_sp500", "market_nasdaq"].includes(signalId)) return "위험회피 경보";
  if (signalId === "market_vix") return "시장 스트레스";
  if (signalId === "market_usdkrw") return "원화·달러 긴축";
  return "시장 경보";
}

function MarketCard({ signal, trigger }: { signal: RegimeSignal; trigger?: RegimeTrigger }) {
  const meta = META[signal.id];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Card className="bg-card/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.07] text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{meta.short}</p>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {signal.usage === "trigger" ? "경보 전용" : "맥락 지표"}
                </Badge>
                {trigger && (
                  <Badge variant="danger" className="text-[10px] font-normal">
                    {marketAlertLabel(signal.id)}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {meta.role}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {signal.is_stale ? "오래됨 · " : ""}{signal.observation_date || "미수집"}
          </Badge>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums">
            {formatValue(signal)}
          </p>
          <p
            className={`text-sm font-medium ${changeTone(signal.change_1m)}`}
          >
            1M {signed(signal.change_1m)}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-xs">
          <div>
            <span className="text-muted-foreground">3M </span>
            <span className={changeTone(signal.change_3m)}>
              {signed(signal.change_3m)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">12M </span>
            <span className={changeTone(signal.change_12m)}>
              {signed(signal.change_12m)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function normalizedDollarTrend(
  dxy?: RegimeSignal,
  broadDollar?: RegimeSignal,
) {
  const selected = [dxy, broadDollar].filter(
    (signal): signal is RegimeSignal => Boolean(signal && (signal.history?.length || 0) > 1),
  );
  if (!selected.length) return [];
  const startDate = selected
    .map((signal) => signal.history?.[0]?.date || "")
    .sort()
    .at(-1) || "";
  const rows = new Map<string, Record<string, string | number>>();
  selected.forEach((signal) => {
    const history = (signal.history || []).filter((point) => point.date >= startDate);
    const base = history[0]?.value;
    if (!base) return;
    history.forEach((point) =>
      rows.set(point.date, {
        ...(rows.get(point.date) || { date: point.date }),
        [signal.id]: (point.value / base) * 100,
      }),
    );
  });
  return [...rows.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
}

function DollarMetric({
  signal,
  eyebrow,
  title,
  primary = false,
}: {
  signal?: RegimeSignal;
  eyebrow: string;
  title: string;
  primary?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${primary ? "border-primary/35 bg-primary/[0.06]" : "bg-muted/15"}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {signal ? formatValue(signal) : "—"}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-muted-foreground">
          {signal?.observation_date || "미수집"}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/70 pt-3 text-xs tabular-nums">
        {[
          ["1M", signal?.change_1m],
          ["3M", signal?.change_3m],
          ["12M", signal?.change_12m],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-muted-foreground">{label}</p>
            <p className={`mt-1 ${changeTone(value as number | null | undefined)}`}>
              {signed(value as number | null | undefined)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DollarEnvironmentCard({
  dxy,
  broadDollar,
}: {
  dxy?: RegimeSignal;
  broadDollar?: RegimeSignal;
}) {
  const trend = normalizedDollarTrend(dxy, broadDollar);
  return (
    <Card className="bg-card/70 md:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1">
              <CardTitle>달러 환경</CardTitle>
              <InfoTip label="DXY와 광의 달러의 역할">
                DXY는 유로 비중이 큰 6개 통화 바스켓으로 시장에서 익숙한 달러
                체감 지표입니다. Fed 광의 달러는 미국 주요 교역국을 상품·서비스
                교역 비중으로 가중해 글로벌 달러 금융여건을 보조 확인합니다. 두
                지수의 기준값은 서로 달라 절대수준을 직접 비교하지 않으며, 자동
                거시 레짐 점수에는 합산하지 않습니다.
              </InfoTip>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              DXY로 빠르게 읽고, 광의 달러로 교역국 전반의 확산을 확인합니다.
            </p>
          </div>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            맥락 지표
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.2fr)]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <DollarMetric signal={dxy} eyebrow="주 표시 · 시장 체감" title="DXY" primary />
            <DollarMetric signal={broadDollar} eyebrow="보조 확인 · 글로벌 압력" title="Fed 광의 달러" />
          </div>
          <div className="rounded-lg border bg-muted/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">달러 강도 방향 비교</p>
              <p className="text-xs text-muted-foreground">최근 1년 · 표시 시작점=100</p>
            </div>
            {trend.length > 1 ? (
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 2, left: 0 }}>
                    <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => String(value).slice(5).replace("-", ".")}
                      minTickGap={46}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      width={38}
                      domain={[
                        (minimum: number) => Math.floor(minimum - 2),
                        (maximum: number) => Math.ceil(maximum + 2),
                      ]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                    <Tooltip
                      labelFormatter={(label) => `관측일 ${label}`}
                      formatter={(value, name) => [Number(value).toFixed(2), name]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="market_dxy"
                      name="DXY"
                      stroke={REGIME_SERIES_COLORS.blue}
                      dot={false}
                      strokeWidth={2.2}
                      connectNulls
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="market_dollar"
                      name="광의 달러"
                      stroke={REGIME_SERIES_COLORS.cyan}
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                두 달러지수의 비교 시계열을 수집하는 중입니다.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function normalizedTrend(signals: RegimeSignal[]) {
  const selected = signals.filter(
    (signal) =>
      ["market_sp500", "market_nasdaq", "market_kospi"].includes(signal.id) &&
      (signal.history?.length || 0) > 1,
  );
  const rows = new Map<string, Record<string, string | number>>();
  selected.forEach((signal) => {
    const history = signal.history || [];
    const base = history[0]?.value;
    if (!base) return;
    history.forEach((point) =>
      rows.set(point.date, {
        ...(rows.get(point.date) || { date: point.date }),
        [signal.id]: (point.value / base) * 100,
      }),
    );
  });
  return [...rows.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
}

export function MarketIndicators({ signals, fetchedAt, triggers = [], energyShock }: Props) {
  const available = signals.filter(
    (signal) => META[signal.id] && signal.value != null,
  );
  const trend = normalizedTrend(available);
  const group = (name: string) =>
    available.filter((signal) => META[signal.id].group === name);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-semibold">시장 환경</h2>
            <InfoTip label="시장 환경 지표 사용법">
              시장 가격은 위험 선호와 충격을 확인하는 맥락·경보 지표입니다.
              단독으로 자동 거시 레짐을 결정하지 않습니다. 화살표는 가격 방향일
              뿐 포트폴리오 전체의 긍정·부정을 뜻하지 않으며, 규칙이 경제적
              의미를 확정한 활성 경보에만 위험 색상을 사용합니다.
            </InfoTip>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            위험자산 · 스트레스 · 달러 · 실물 · 귀금속
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>마지막 갱신</p>
          <p className="mt-1">
            {fetchedAt
              ? new Date(fetchedAt).toLocaleString("ko-KR")
              : "확인 불가"}
          </p>
        </div>
      </div>

      {energyShock && (
        <Card data-energy-shock-summary className={TONE_STYLES[energyShock.tone].panel}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1">
                  <CardTitle>에너지 가격·공급충격</CardTitle>
                  <InfoTip label="에너지 충격 판정 방식">
                    WTI 가격 변화, OVX 변동성, EIA 미국 상업용 원유재고를
                    분리해 봅니다. 유가만 올랐다고 공급부족으로 확정하지 않으며,
                    자산 추천이 아닌 거시 물가·성장 충격 조기경보입니다.
                  </InfoTip>
                </div>
                <p className={`mt-2 text-lg font-semibold ${TONE_STYLES[energyShock.tone].text}`}>
                  {energyShock.state}
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {energyShock.reason}
                </p>
              </div>
              <Badge variant={TONE_STYLES[energyShock.tone].badge}>
                거시 조기경보
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/15 p-4">
                <p className="text-xs text-muted-foreground">WTI 가격 압력</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  ${energyShock.components.wti.value?.toFixed(2) ?? "-"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  20관측일 {signed(energyShock.components.wti.change_20d)} · 12개월 {signed(energyShock.components.wti.change_12m)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/15 p-4">
                <p className="text-xs text-muted-foreground">OVX 불확실성</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {energyShock.components.ovx.value?.toFixed(1) ?? "-"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  최근 1년 {energyShock.components.ovx.percentile_1y?.toFixed(0) ?? "-"}백분위
                </p>
              </div>
              <div className="rounded-lg border bg-muted/15 p-4">
                <p className="text-xs text-muted-foreground">상업용 원유재고</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {energyShock.components.inventory.value?.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) ?? "-"}천 배럴
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  4주 {signed(energyShock.components.inventory.change_4w)} · 52주 {signed(energyShock.components.inventory.change_52w)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-1">
            <CardTitle>위험자산 상대 흐름</CardTitle>
            <InfoTip label="위험자산 상대 흐름 계산 방식">
              표시 구간의 첫 관측값을 각각 100으로 환산한 성과지수입니다. 지수의
              절대 수준이나 서로 다른 통화의 투자수익률을 직접 비교하는 차트가
              아닙니다.
            </InfoTip>
          </div>
          <p className="text-sm text-muted-foreground">
            최근 1년 · 표시 시작점=100
          </p>
        </CardHeader>
        <CardContent>
          {trend.length > 1 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trend}
                  margin={{ top: 8, right: 18, bottom: 4, left: 4 }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--chart-grid))"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) =>
                      String(value).slice(5).replace("-", ".")
                    }
                    minTickGap={52}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    width={46}
                    domain={[
                      (minimum: number) => Math.floor(minimum - 5),
                      (maximum: number) => Math.ceil(maximum + 5),
                    ]}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
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
                    dataKey="market_sp500"
                    name="S&P 500"
                    stroke={REGIME_SERIES_COLORS.blue}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="market_nasdaq"
                    name="NASDAQ"
                    stroke={REGIME_SERIES_COLORS.violet}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="market_kospi"
                    name="KOSPI"
                    stroke={REGIME_SERIES_COLORS.cyan}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              정규화 차트를 만들 장기 시계열이 부족합니다.
            </div>
          )}
        </CardContent>
      </Card>

      {[
        ["risk", "주요 시장"],
        ["stress", "스트레스"],
        ["fx", "달러·환율"],
        ["real", "실물·공급충격"],
        ["hedge", "귀금속·방어 확인"],
      ].map(([id, title]) =>
        group(id).length ? (
          <section key={id}>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-sm font-medium">{title}</h3>
              <div className="h-px flex-1 bg-border/70" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {id === "fx" && available.some((signal) =>
                ["market_dxy", "market_dollar"].includes(signal.id),
              ) && (
                <DollarEnvironmentCard
                  dxy={available.find((signal) => signal.id === "market_dxy")}
                  broadDollar={available.find((signal) => signal.id === "market_dollar")}
                />
              )}
              {group(id).filter((signal) =>
                id !== "fx" || !["market_dxy", "market_dollar"].includes(signal.id),
              ).map((signal) => (
                <MarketCard
                  key={signal.id}
                  signal={signal}
                  trigger={triggers.find((trigger) =>
                    trigger.rule_id.includes(signal.id.replace("market_", ""))
                    || trigger.rule_id.includes(signal.id)
                  )}
                />
              ))}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}
