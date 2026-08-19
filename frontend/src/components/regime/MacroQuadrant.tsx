import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import {
  growthLevelLabel,
  inflationLevelLabel,
  macroEnvironmentLabel,
  momentumDirectionLabel,
  momentumStrengthLabel,
} from "@/lib/regime-display";
import type { RegimeCurrent } from "@/types";

type Quadrant = RegimeCurrent["macro_quadrant"];

const SIZE = 520;
const PAD = 66;
const PLOT = SIZE - PAD * 2;
const x = (value: number) => PAD + ((value + 100) / 200) * PLOT;
const y = (value: number) => PAD + ((100 - value) / 200) * PLOT;
const signed = (value: number | null | undefined) =>
  value == null ? "-" : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

function pressureEndpoint(
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  score: number,
) {
  const norm = Math.hypot(dx, dy);
  if (norm < 15) return null;
  const length = 28 + Math.min(1, score) * 42;
  const unitX = dx / norm;
  const unitY = -dy / norm;
  const boundary = Math.min(
    unitX > 0
      ? (SIZE - PAD - startX) / unitX
      : unitX < 0
        ? (PAD - startX) / unitX
        : Infinity,
    unitY > 0
      ? (SIZE - PAD - startY) / unitY
      : unitY < 0
        ? (PAD - startY) / unitY
        : Infinity,
  );
  const safeLength = Math.min(length, Math.max(0, boundary * 0.85));
  return { x: startX + unitX * safeLength, y: startY + unitY * safeLength };
}

export function MacroQuadrant({ data }: { data: Quadrant }) {
  const legacyPoint = data.points?.at(-1);
  const levelX = data.environment_point?.growth ?? data.growth_level?.score;
  const levelY =
    data.environment_point?.inflation ?? data.inflation_level?.score;
  const vector =
    data.pressure_vector ??
    data.momentum_vector ??
    (legacyPoint?.growth.coordinate != null &&
    legacyPoint.inflation.coordinate != null
      ? {
          dx: legacyPoint.growth.coordinate,
          dy: legacyPoint.inflation.coordinate,
          direction: `${legacyPoint.growth.coordinate <= -15 ? "성장 둔화" : legacyPoint.growth.coordinate >= 15 ? "성장 개선" : "성장 변화 미미"}·${legacyPoint.inflation.coordinate <= -15 ? "물가 완화" : legacyPoint.inflation.coordinate >= 15 ? "물가 재가속" : "물가 변화 미미"}`,
          strength:
            Math.hypot(
              legacyPoint.growth.coordinate,
              legacyPoint.inflation.coordinate,
            ) < 25
              ? "완만"
              : "뚜렷함",
          strength_score: Math.min(
            1,
            Math.hypot(
              legacyPoint.growth.coordinate,
              legacyPoint.inflation.coordinate,
            ) /
              (100 * Math.SQRT2),
          ),
          semantics: "relative_recent_pressure" as const,
          is_displacement: false as const,
          trajectory_available: false as const,
        }
      : undefined);
  const available = levelX != null && levelY != null;
  const startX = available ? x(levelX) : 0;
  const startY = available ? y(levelY) : 0;
  const endpoint =
    available && vector?.dx != null && vector.dy != null
      ? pressureEndpoint(
          startX,
          startY,
          vector.dx,
          vector.dy,
          vector.strength_score ?? 0,
        )
      : null;
  const rawEnvironment =
    data.environment_point?.label ??
    data.environment_label ??
    (data.growth_level && data.inflation_level
      ? `${data.growth_level.label}·물가 ${data.inflation_level.label}`
      : "판정 불가");
  const environment = macroEnvironmentLabel(rawEnvironment);
  const direction = momentumDirectionLabel(vector?.direction);
  const strength = momentumStrengthLabel(vector?.strength);
  const recession = data.recession_confirmation;
  const recessionTone =
    recession?.status === "confirmed"
      ? "text-danger"
      : recession?.status === "watch" || recession?.status === "leading_only"
        ? "text-warning"
        : recession?.status === "clear"
          ? "text-success"
          : "text-muted-foreground";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <CardTitle>미국 거시경제 현재 수준과 최근 방향</CardTitle>
            <InfoTip label="거시경제 상태 차트 읽는 법">
              점은 지표 원수치가 아니라 성장과 물가를 기준점과 비교한 합성
              위치입니다. 화살표는 최근 관측치로 계산한 상대 방향과 강도이며
              실제 이동 경로나 전망이 아닙니다.
            </InfoTip>
          </div>
        </div>
        <div className="min-w-0 text-right">
          <Badge className="max-w-full whitespace-normal text-right leading-4" variant="secondary">
            {environment}
          </Badge>
          <p className="mt-2 text-xs text-muted-foreground">
            가장 최근 관측일 {data.as_of_date || "-"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {available ? (
          <>
            <div className="mx-auto w-full max-w-[620px] overflow-hidden rounded-lg border border-border/80 bg-[#0b111b]">
              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                role="img"
                aria-label={`현재 환경 ${environment}. ${direction}. ${strength}`}
                className="h-auto w-full text-foreground [&_text]:fill-current"
              >
                <defs>
                  <marker
                    id="pressure-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill="hsl(var(--info))" />
                  </marker>
                </defs>
                <rect
                  x={PAD}
                  y={PAD}
                  width={PLOT / 2}
                  height={PLOT / 2}
                  fill="hsl(0 62% 42%)"
                  opacity="0.13"
                />
                <rect
                  x={SIZE / 2}
                  y={PAD}
                  width={PLOT / 2}
                  height={PLOT / 2}
                  fill="hsl(35 72% 42%)"
                  opacity="0.12"
                />
                <rect
                  x={PAD}
                  y={SIZE / 2}
                  width={PLOT / 2}
                  height={PLOT / 2}
                  fill="hsl(214 62% 40%)"
                  opacity="0.11"
                />
                <rect
                  x={SIZE / 2}
                  y={SIZE / 2}
                  width={PLOT / 2}
                  height={PLOT / 2}
                  fill="hsl(166 62% 34%)"
                  opacity="0.11"
                />
                {[-50, 0, 50].map((value) => (
                  <g key={value} opacity="0.32">
                    <line
                      x1={x(value)}
                      x2={x(value)}
                      y1={PAD}
                      y2={SIZE - PAD}
                      stroke="currentColor"
                      strokeDasharray={value === 0 ? undefined : "4 5"}
                    />
                    <line
                      x1={PAD}
                      x2={SIZE - PAD}
                      y1={y(value)}
                      y2={y(value)}
                      stroke="currentColor"
                      strokeDasharray={value === 0 ? undefined : "4 5"}
                    />
                  </g>
                ))}
                <text x={PAD + 12} y={PAD + 24} fontSize="13" fontWeight="600">
                  성장 취약 · 물가 높음
                </text>
                <text
                  x={SIZE - PAD - 12}
                  y={PAD + 24}
                  textAnchor="end"
                  fontSize="13"
                  fontWeight="600"
                >
                  성장 확장 · 물가 높음
                </text>
                <text
                  x={PAD + 12}
                  y={SIZE - PAD - 14}
                  fontSize="13"
                  fontWeight="600"
                >
                  성장 취약 · 물가 안정
                </text>
                <text
                  x={SIZE - PAD - 12}
                  y={SIZE - PAD - 14}
                  textAnchor="end"
                  fontSize="13"
                  fontWeight="600"
                >
                  성장 확장 · 물가 안정
                </text>
                <text
                  x={SIZE / 2}
                  y={SIZE - 17}
                  textAnchor="middle"
                  fontSize="12"
                  className="hidden sm:block"
                >
                  성장 수준 · 취약 ← → 확장
                </text>
                <text
                  x="18"
                  y={SIZE / 2}
                  textAnchor="middle"
                  fontSize="12"
                  className="hidden sm:block"
                  transform={`rotate(-90 18 ${SIZE / 2})`}
                >
                  물가 압력 수준 · 목표 부근 ← → 높음
                </text>
                {endpoint && (
                  <g>
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endpoint.x}
                      y2={endpoint.y}
                      stroke="hsl(var(--info))"
                      strokeWidth="9"
                      opacity="0.14"
                    />
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endpoint.x}
                      y2={endpoint.y}
                      stroke="hsl(var(--info))"
                      strokeWidth="4"
                      opacity="0.95"
                      markerEnd="url(#pressure-arrow)"
                    />
                    <text
                      x={endpoint.x + (endpoint.x >= startX ? 12 : -12)}
                      y={endpoint.y - 10}
                      textAnchor={endpoint.x >= startX ? "start" : "end"}
                      fontSize="11"
                      fontWeight="600"
                      fill="hsl(var(--info))"
                    >
                      최근 압력
                    </text>
                  </g>
                )}
                <circle
                  cx={startX}
                  cy={startY}
                  r="16"
                  fill="hsl(var(--primary))"
                  opacity="0.18"
                />
                <circle
                  cx={startX}
                  cy={startY}
                  r="9"
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth="3"
                />
                <text
                  x={startX + 14}
                  y={startY - 13}
                  fontSize="12"
                  fontWeight="700"
                >
                  현재 수준
                </text>
              </svg>
              <div className="flex items-center justify-between border-t border-border/70 px-3 py-2 text-[10px] text-muted-foreground sm:hidden">
                <span>가로 · 성장 취약 → 확장</span>
                <span>세로 · 물가 안정 → 높음</span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">현재 수준 · 모형 기준</p>
                <p className="mt-1 font-semibold">
                  {growthLevelLabel(data.growth_level?.label)} ·{" "}
                  {inflationLevelLabel(data.inflation_level?.label)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  성장 {signed(levelX)} / 물가 {signed(levelY)}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">최근 지표의 상대 방향</p>
                <p className="mt-1 font-semibold">
                  {direction}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {strength} · 성장 {signed(vector?.dx)} / 물가 {signed(vector?.dy)}
                </p>
              </div>
              {recession && (
                <div className="rounded-lg border p-4" data-recession-confirmation={recession.status}>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>현재 경기악화 확인</span>
                    <InfoTip label="현재 경기악화 확인 방법">
                      수익률곡선은 향후 침체 가능성을 미리 알리는 지표이고,
                      노동·실물경제·신용은 현재 악화 여부를 확인하는 세 축입니다.
                      이 카드는 세 축에서 확인된 범위만 말하며 경제 전체의 침체 여부를
                      단정하지 않습니다. 4분면의 위치나 화살표만으로도 침체를 판정하지
                      않습니다. {recession.channels.map((channel) => `${channel.name}: ${channel.state}`).join(" · ")}
                    </InfoTip>
                  </div>
                  <p className={`mt-1 font-semibold ${recessionTone}`}>{recession.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    현재 악화 영역 {recession.coincident_risk_count}/3
                    {recession.as_of_date ? ` · 기준 ${recession.as_of_date}` : ""}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-80 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            현재 절대 위치를 계산할 자료가 부족합니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
