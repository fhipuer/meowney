import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PowerCycle } from "@/types";
import { PowerDashboard } from "./RegimePage";

const metric = {
  latest: 100,
  observation_date: "2026-06-01",
  yoy: 3,
  yoy_3m_avg: 2.5,
  mom: 1,
  sequential_3m: 2,
  unit: "TWh",
  history: [{ date: "2026-06-01", value: 100, yoy: 3 }],
};

describe("PowerDashboard", () => {
  it("separates demand, supply, and bottleneck interpretation without overclaiming", () => {
    const data = {
      state: "수요 확대·공급 확충",
      reason: "전력수요와 발전·저장설비 파이프라인이 함께 확대되고 있습니다.",
      coverage: 1,
      role: "context",
      as_of_date: "2026-08-19",
      decision_as_of_date: "2026-08-19",
      age_days: 1,
      is_stale: false,
      metrics: {
        total_sales: metric,
        commercial_sales: metric,
        industrial_sales: metric,
        generation: metric,
        capacity: metric,
      },
      source: "EIA",
      source_url: "https://example.com/eia",
      fetch_status: null,
      demand_axis: {
        state: "전력 수요 빠르게 확대",
        reason: "미국 84일 +2.5% · AI 인프라 관찰지역 84일 +3.8%",
        score: 6,
        coverage: 1,
        model: "eia930+monthly",
        observation_date: "2026-08-19",
        age_days: 1,
        is_stale: false,
        national_yoy_28d: 3.1,
        national_yoy_84d: 2.5,
        ai_regions_yoy_28d: 4.8,
        ai_regions_yoy_84d: 3.8,
        ai_regions_acceleration_pp: 1,
        ai_excess_growth_pp: 1.3,
        regional_expansion_share: 0.54,
        region_coverage: 1,
        expected_region_count: 13,
        available_region_count: 13,
        commercial_yoy_3m: 3,
        regions: [{ id: "TEX", name: "Texas", yoy_28d: 7, yoy_84d: 6.4, observation_date: "2026-08-19", is_ai_proxy: true }],
        yoy_history: [{ date: "2026-08-01", national: 2.5, ai_regions: 3.8 }],
        source_url: "https://example.com/eia930",
      },
      operations_axis: {
        state: "부담 신호 관찰",
        reason: "수요가 예측을 웃돌고 일부 관찰지역에서 운영 부담이 함께 확인됩니다.",
        coverage: 1,
        observation_date: "2026-08-19",
        age_days: 1,
        is_stale: false,
        window_days: 28,
        forecast_surprise_pct: 1.9,
        forecast_abs_error_pct: 1.7,
        generation_coverage_pct: 92.4,
        net_import_share_pct: 3.1,
        pressure_region_count: 2,
        expected_region_count: 6,
        history: [
          {
            date: "2026-08-01",
            forecast_surprise_pct: 1.9,
            forecast_abs_error_pct: 1.7,
            generation_coverage_pct: 92.4,
            net_import_share_pct: 3.1,
          },
        ],
        source_url: "https://example.com/eia930",
        limitations: "운영 프록시",
      },
      supply_axis: {
        state: "건설 진행",
        reason: "향후 24개월 순확충은 현재 가동용량의 4.9%입니다.",
        coverage: 1,
        observation_date: "2026-06-30",
        age_days: 51,
        is_stale: false,
        operating_capacity_gw: 1287.7,
        committed_additions_24m_gw: 83.2,
        retirements_24m_gw: 19.9,
        net_additions_24m_gw: 63.4,
        net_pipeline_ratio_24m_pct: 4.9,
        variable_storage_share_24m_pct: 89.7,
        delayed_committed_capacity_gw: 1,
        mix: [
          { id: "solar", value_gw: 42 },
          { id: "battery", value_gw: 21 },
          { id: "wind", value_gw: 11 },
          { id: "gas", value_gw: 8 },
        ],
        source_url: "https://example.com/eia860m",
        fetch_status: null,
      },
      interconnection_axis: {
        state: "접속 대기 부담 높음",
        reason: "활성 접속 대기 규모와 처리기간이 모두 높은 수준입니다.",
        coverage: 1,
        observation_date: "2025-12-31",
        is_stale: false,
        metrics: {
          active_queue_gw: { value: 2061.3, unit: "GW", observation_date: "2025-12-31" },
          active_generation_gw: { value: 1312, unit: "GW", observation_date: "2025-12-31" },
          active_storage_gw: { value: 749.3, unit: "GW", observation_date: "2025-12-31" },
          ia_executed_active_gw: { value: 500.1, unit: "GW", observation_date: "2025-12-31" },
          ia_executed_share_pct: { value: 24.3, unit: "%", observation_date: "2025-12-31" },
          median_active_age_years: { value: 3, unit: "년", observation_date: "2025-12-31" },
          recent_ir_to_cod_median_years: { value: 5, unit: "년", observation_date: "2025-12-31" },
          active_projects: { value: 10100, unit: "개", observation_date: "2025-12-31" },
        },
        history: [
          { date: "2024-12-31", active_requests_gw: 1900, completed_gw: 180, withdrawn_gw: 900 },
          { date: "2025-12-31", active_requests_gw: 2061.3, completed_gw: 210, withdrawn_gw: 1030 },
        ],
        provenance: {
          provider: "LBNL",
          source_url: "https://example.com/lbnl",
          scope_note: "발전·저장 공급측 접속 대기열",
        },
        freshness: {
          status: "success",
          observation_date: "2025-12-31",
          is_stale: false,
        },
      },
      transmission_investment_axis: {
        state: "송전 투자 확대",
        reason: "동일 보고사 기준 송전설비 증가액이 확대되고 있습니다.",
        coverage: 1,
        observation_date: "2025-12-31",
        is_stale: false,
        metrics: {
          annual_additions_usd: { value: 35_315_000_000, unit: "USD", observation_date: "2025-12-31" },
          reporter_count: { value: 201, unit: "개", observation_date: "2025-12-31" },
          three_year_cagr_pct: { value: 13.6, unit: "%", observation_date: "2025-12-31" },
          like_for_like_three_year_cagr_pct: { value: 13, unit: "%", observation_date: "2025-12-31" },
          current_reporter_prior_year_coverage_pct: { value: 91.5, unit: "%", observation_date: "2025-12-31" },
          prior_reporter_retention_pct: { value: 90, unit: "%", observation_date: "2025-12-31" },
        },
        history: [
          { date: "2024-12-31", additions_usd: 31_000_000_000, reporter_count: 195 },
          { date: "2025-12-31", additions_usd: 35_315_000_000, reporter_count: 201 },
        ],
        provenance: {
          provider: "PUDL",
          source_url: "https://example.com/pudl",
          scope_note: "FERC Form 1 보고사 표본",
        },
        freshness: {
          status: "success",
          observation_date: "2025-12-31",
          is_stale: false,
        },
      },
      methodology: "결정론적 수요·공급 분리 판정",
      limitations: "직접 계통 병목자료 없음",
    } as unknown as PowerCycle;

    const html = renderToStaticMarkup(<PowerDashboard data={data} />);

    expect(html).toContain("AI 전력 인프라 전달경로");
    expect(html).toContain("1단계 · 실제 수요");
    expect(html).toContain("2단계 · 운영 프록시");
    expect(html).toContain("3단계 · 공사단계 설비");
    expect(html).toContain("4단계 · 공급측 대기열");
    expect(html).toContain("5단계 · 회계상 투자");
    expect(html).toContain("계통 운영 압력");
    expect(html).toContain("발전 공급 접속 대기");
    expect(html).toContain("송전 투자 실행");
    expect(html).toContain("+63.4 GW");
    expect(html).toContain("AI 인프라 관찰지역");
    expect(html).toContain("예비율이나 송전 병목을 직접 측정한 값은 아닙니다");
    expect(html).toContain("데이터센터 부하의 접속 대기열은 아닙니다");
    expect(html).toContain("미국 전체 송전투자의 완전한 총계로 해석하지 않습니다");
    expect(html).toContain("24개월 발전·저장 공사단계 설비");

    const partialHtml = renderToStaticMarkup(
      <PowerDashboard
        data={{
          ...data,
          operations_axis: undefined,
          interconnection_axis: undefined,
          transmission_investment_axis: undefined,
        } as unknown as PowerCycle}
      />,
    );
    expect(partialHtml).toContain("운영 프록시를 아직 수집하지 않았습니다");
    expect(partialHtml).toContain("공급측 접속 대기자료를 아직 수집하지 않았습니다");
    expect(partialHtml).toContain("송전 투자자료를 아직 수집하지 않았습니다");
  });
});
