import { AlertTriangle, CheckCircle2, Database, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MacroQuadrant } from "./MacroQuadrant";
import type { RegimeCurrent, RegimeLevel } from "@/types";

const LEVELS: RegimeLevel[] = ["유지", "경계", "약화", "전환"];
export type CurrentOverviewProps = {
  data: RegimeCurrent;
  judgment: RegimeLevel | "";
  note: string;
  reviewCompleted: boolean;
  snapshotPending: boolean;
  onJudgment: (value: RegimeLevel | "") => void;
  onNote: (value: string) => void;
  onReviewCompleted: (value: boolean) => void;
  onSnapshot: () => void;
};
const signed = (value: number | null | undefined, digits = 1) =>
  value == null ? "-" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;

function DecisionHeader({ data }: { data: RegimeCurrent }) {
  const limited = data.data_quality.status !== "충분";
  const title = data.needs_new_review
    ? "지금 상세 점검 필요"
    : data.review_urgency === "watch"
      ? "관찰 유지"
      : "신규 중요 경보 없음";
  const detail = data.needs_new_review
    ? data.review_reasons[0] || "중요 임계조건이 충족됐습니다."
    : limited
      ? "경보는 없지만 데이터 공백 때문에 정상 확정은 제한됩니다."
      : "핵심 데이터에서 새 임계선 통과가 확인되지 않았습니다.";
  const calm =
    !data.needs_new_review && data.review_urgency === "not_needed" && !limited;
  const pressure =
    data.macro_quadrant.pressure_vector ??
    data.macro_quadrant.momentum_vector;
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
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,1.5fr)_repeat(3,minmax(150px,1fr))]">
          <div className="flex gap-4">
            {calm ? (
              <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle
                className={`mt-1 h-7 w-7 shrink-0 ${data.needs_new_review ? "text-red-400" : "text-amber-400"}`}
              />
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                포트폴리오 상세점검 판단
              </p>
              <h2 className="mt-1 text-2xl font-bold">{title}</h2>
              <p className="mt-2 text-sm font-medium">{environment}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {detail}
              </p>
            </div>
          </div>
          <div className="border-l pl-5">
            <p className="text-xs text-muted-foreground">자동 거시 레짐</p>
            <p className="mt-2 text-xl font-semibold">
              {data.automatic_regime}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              후보 {data.candidate_regime} · 거시 전용
            </p>
          </div>
          <div className="border-l pl-5">
            <p className="text-xs text-muted-foreground">현재 경제환경</p>
            <p className="mt-2 text-xl font-semibold">
              {data.macro_quadrant.environment_point?.label ||
                data.macro_quadrant.environment_label ||
                (data.macro_quadrant.growth_level &&
                data.macro_quadrant.inflation_level
                  ? `${data.macro_quadrant.growth_level.label}·물가 ${data.macro_quadrant.inflation_level.label}`
                  : "판정 불가")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              점=절대수준 · 화살표=최근 압력
            </p>
          </div>
          <div className="border-l pl-5">
            <p className="text-xs text-muted-foreground">데이터 품질</p>
            <p className="mt-2 text-xl font-semibold">
              {data.data_quality.status}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              coverage {Math.round(data.data_quality.overall_coverage * 100)}% ·
              적중률 아님
            </p>
          </div>
        </div>
        {data.review_acknowledged && (
          <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
            마지막 상세점검 당시 경보 집합은 확인됐습니다. 새로운 경보 또는
            심각도 상승 시 다시 알립니다.
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
          <CardTitle>
            {data.triggers.length
              ? "현재 판단을 바꾸는 신호"
              : "현재 판단의 근거와 제한"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.triggers.length ? (
            <ul className="space-y-3">
              {data.triggers.slice(0, 3).map((trigger) => (
                <li key={trigger.rule_id} className="flex gap-2 text-sm">
                  <Badge
                    variant={
                      trigger.severity === "critical"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {trigger.severity === "critical" ? "긴급" : "높음"}
                  </Badge>
                  <span>{trigger.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              활성 High/Critical 임계 신호가 없습니다. 이는 모든 환경이
              양호하다는 뜻이 아니라 정의된 경보선의 신규 통과가 없다는
              뜻입니다.
            </p>
          )}
          {data.data_quality.status !== "충분" && (
            <div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <div className="flex gap-2">
                <Database className="mt-0.5 h-4 w-4 text-amber-300" />
                <div>
                  <p className="text-sm font-medium">판단 범위 제한</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {data.data_quality.reasons.join(" · ")}
                  </p>
                  {data.data_quality.stale.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      오래됨:{" "}
                      {data.data_quality.stale
                        .slice(0, 3)
                        .map((item) => `${item.name}(${item.observation_date})`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>좌표를 움직인 상위 기여</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
          <DriverList
            title="성장 모멘텀"
            contributors={current?.growth.contributors || []}
            positive="개선 기여"
            negative="둔화 기여"
          />
          <DriverList
            title="인플레이션 모멘텀"
            contributors={current?.inflation.contributors || []}
            positive="재가속 기여"
            negative="완화 기여"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function MonitoringTable({ data }: { data: RegimeCurrent }) {
  const current = data.macro_quadrant.points.at(-1),
    conditions = data.macro_quadrant.financial_conditions;
  const count = (domain: string) =>
    data.triggers.filter((item) => item.domain === domain).length;
  const rows = [
    [
      "성장·고용",
      `${data.macro_quadrant.growth_level?.label || "판정 불가"} / 모멘텀 ${signed(current?.growth.coordinate)}`,
      current?.growth.contributors[0]?.name || "자료 부족",
      `품질 ${current?.growth.data_quality_label || current?.growth.confidence_label} ${current?.growth.data_quality_score ?? current?.growth.confidence ?? 0}점`,
      count("growth"),
    ],
    [
      "물가",
      `${data.macro_quadrant.inflation_level?.label || "판정 불가"} / 모멘텀 ${signed(current?.inflation.coordinate)}`,
      current?.inflation.contributors[0]?.name || "자료 부족",
      `품질 ${current?.inflation.data_quality_label || current?.inflation.confidence_label} ${current?.inflation.data_quality_score ?? current?.inflation.confidence ?? 0}점`,
      count("inflation"),
    ],
    [
      "정책 긴축",
      conditions?.policy.label || "판정 불가",
      `Fed ${conditions?.policy.fed_funds?.toFixed(2) ?? "-"}% / Core PCE YoY ${conditions?.policy.core_pce_yoy?.toFixed(2) ?? "-"}% / 실질 정책금리 ${signed(conditions?.policy.real_policy_rate, 2)}%p`,
      `${data.coverage.domains.rates.status} ${Math.round(data.coverage.domains.rates.coverage * 100)}%`,
      count("rates"),
    ],
    [
      "장기금리 전달",
      conditions?.long_rates.label || "판정 불가",
      `10Y ${conditions?.long_rates.nominal_10y?.toFixed(2) ?? "-"}% = TIPS ${conditions?.long_rates.real_10y?.toFixed(2) ?? "-"}% + BEI ${conditions?.long_rates.breakeven_10y?.toFixed(2) ?? "-"}% · TP ${conditions?.long_rates.term_premium?.toFixed(2) ?? "-"}%`,
      data.rate_decomposition
        ? `20일 ${data.rate_decomposition.driver} · 명목 ${signed(data.rate_decomposition.nominal_change, 2)}%p`
        : "변화 분해 자료 부족",
      count("rates"),
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
        <CardTitle>거시 전달경로 모니터</CardTitle>
        <p className="text-sm text-muted-foreground">
          절대수준과 최근 충격을 함께 봅니다. 경보 없음은 완화적이라는 뜻이
          아닙니다.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-3 font-medium">영역</th>
              <th className="pb-3 font-medium">수준 / 방향</th>
              <th className="pb-3 font-medium">실제값과 분해</th>
              <th className="pb-3 font-medium">품질 / 변화</th>
              <th className="pb-3 text-right font-medium">활성 경보</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-b last:border-0">
                <td className="py-4 font-medium">{row[0]}</td>
                <td className="py-4">{row[1]}</td>
                <td className="py-4 text-muted-foreground">{row[2]}</td>
                <td className="py-4 text-muted-foreground">{row[3]}</td>
                <td className="py-4 text-right">
                  <Badge variant={row[4] ? "destructive" : "outline"}>
                    {row[4] ? `${row[4]}개` : "없음"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ThesisPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 인프라 투자 가설</CardTitle>
        <p className="text-sm text-muted-foreground">
          거시 환경과 독립적으로 판단해야 하는 구조적 사이클입니다.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div className="rounded-lg border border-dashed p-5">
            <Badge variant="outline">판정 불가</Badge>
            <p className="mt-4 text-lg font-semibold">CAPEX 데이터 미연결</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              시장 가격을 CAPEX 대용으로 사용하지 않습니다.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">판정에 필요한 데이터</p>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li>· 4개사 분기 CAPEX</li>
              <li>· 합산 TTM과 YoY</li>
              <li>· 공시일과 회계기간</li>
              <li>· 실적시즌 coverage</li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Microsoft · Alphabet · Meta · Amazon SEC XBRL 연동 후 `확대 가속 /
              높은 투자 지속·감속 / 축소`를 구분합니다.
            </p>
          </div>
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
            <p className="font-semibold">공식 Snapshot 기록</p>
            <p className="mt-1 text-sm text-muted-foreground">
              판정 기준시점과 원자료를 동결해 History에 보존합니다.
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
            <p className="text-muted-foreground">환경 좌표 기준일</p>
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
            <p className="text-muted-foreground">마지막 수집</p>
            <p className="mt-1">
              {data.data_quality.last_fetched_at
                ? new Date(data.data_quality.last_fetched_at).toLocaleString(
                    "ko-KR",
                  )
                : "-"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          기록 시각과 경제지표 관측일은 서로 다릅니다. 초기 발표값 빈티지는 별도
          보존하며, 완전한 시점기준 이력이 쌓이기 전까지 과거 궤적은 표시하지
          않습니다.
        </p>
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
            <Save className="mr-2 h-4 w-4" />이 기준으로 저장
          </Button>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={props.reviewCompleted}
            onChange={(event) => props.onReviewCompleted(event.target.checked)}
          />
          <span>
            <span className="font-medium">
              외부 상세 포트폴리오 점검도 완료함
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              선택한 경우에만 당시 경보 집합을 확인 완료로 기록합니다. 외부
              리포트 본문은 저장하지 않습니다.
            </span>
          </span>
        </label>
      </div>
    </details>
  );
}

export function RegimeCurrentOverview(props: CurrentOverviewProps) {
  return (
    <div className="space-y-8">
      <DecisionHeader data={props.data} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <MacroQuadrant data={props.data.macro_quadrant} />
        <EvidencePanel data={props.data} />
      </div>
      <MonitoringTable data={props.data} />
      <ThesisPanel />
      <SnapshotPanel {...props} />
    </div>
  );
}
