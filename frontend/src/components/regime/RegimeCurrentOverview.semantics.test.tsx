import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RegimeCurrent } from "@/types";
import {
  ChangeInbox,
  DataConnectionStatus,
  DecisionHeader,
} from "./RegimeCurrentOverview";

const base = {
  automatic_regime: "경계",
  candidate_regime: "경계",
  needs_new_review: false,
  review_urgency: "watch",
  review_reasons: ["High trigger 활성"],
  review_acknowledged: false,
  triggers: [],
  changes_since_snapshot: [],
  thesis_changes_since_snapshot: [],
  feed_health: { events: { status: "success" } },
  coverage: {
    domains: {
      growth: { usable: 3, total: 3 },
      inflation: { usable: 3, total: 3 },
      rates: { usable: 3, total: 3 },
      liquidity: { usable: 3, total: 3 },
    },
  },
  data_quality: {
    status: "충분",
    reasons: [],
    auxiliary_stale: [],
  },
  macro_quadrant: {
    environment_point: { label: "완만한 확장·물가 높음" },
    pressure_vector: { direction: "성장 둔화·물가 완화" },
    points: [],
  },
  ai_capex: { state: "확대 강함" },
  semiconductor_cycle: {
    state: "확장 확인",
    dram_bottleneck: { state: "타이트 신호" },
    supply: { state: "균형" },
  },
} as unknown as RegimeCurrent;

describe("current overview semantics", () => {
  it("labels the automatic value as a macro regime instead of an investment thesis", () => {
    const html = renderToStaticMarkup(<DecisionHeader data={base} />);

    expect(html).toContain("미국 거시 판단");
    expect(html).not.toContain("후보 경계");
    expect(html).not.toContain("현재 투자 가설 판정");
    expect(html).not.toContain("자동 매매 아님");
    expect(html).not.toContain("점=현재 수준");
  });

  it("keeps non-blocking source delays in the compact metadata row", () => {
    const data = {
      ...base,
      feed_health: {
        events: { status: "success" },
        macro: { status: "partial" },
      },
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(<DecisionHeader data={data} />);

    expect(html).toContain("자료원 상태 · 미국 거시지표 일부 항목 갱신 지연");
    expect(html).toContain("보조자료 갱신 상태");
    expect(html).not.toContain("일부 데이터 원본 갱신 지연");
  });

  it("does not present one high watch signal as an immediate review instruction", () => {
    const data = {
      ...base,
      triggers: [{
        rule_id: "tightening.restrictive_level",
        rule_version: "test",
        domain: "rates",
        severity: "high",
        evidence_cluster: "rate_level",
        summary: "긴축 수준 지속",
        evidence: {},
        lifecycle: "acknowledged",
      }],
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(<ChangeInbox data={data} />);

    expect(html).toContain("활성 위험 신호");
    expect(html).toContain("상태 기록에서 확인");
    expect(html).not.toContain("즉시 상세점검 사유");
    expect(html).not.toContain("점검 기준 충족");
  });

  it("separates stale display-only data from decision warnings", () => {
    const data = {
      ...base,
      data_quality: {
        status: "충분",
        reasons: [],
        auxiliary_stale: [{
          id: "kr_indpro",
          name: "한국 산업생산",
          source: "fred",
          observation_date: "2024-03-01",
          age_days: 901,
          max_age_days: 95,
          reason_code: "reference_stale",
          used_in_decision: false,
        }],
      },
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(<DataConnectionStatus data={data} />);

    expect(html).toContain("<details");
    expect(html).toContain("판정 미사용 참고자료");
    expect(html).toContain("자동 판정에 쓰지 않는 참고자료 1건");
    expect(html).toContain("참고자료 오래됨");
    expect(html).toContain("자동 레짐 판정 미사용");
    expect(html).not.toContain("보조자료 갱신 필요");
    expect(html).not.toContain("<details open");
  });
});
