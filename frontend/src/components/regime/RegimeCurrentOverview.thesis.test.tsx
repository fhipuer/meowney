import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RegimeCurrent } from "@/types";
import { AiThesisMonitor } from "./RegimeCurrentOverview";

const metric = (yoy: number, average = yoy) => ({
  latest: 100,
  observation_date: "2026-07-01",
  yoy,
  yoy_3m_avg: average,
  unit: "index",
  history: [],
});

describe("AiThesisMonitor", () => {
  it("keeps the four-stage thesis flow ordered while preserving expandable evidence", () => {
    const data = {
      ai_capex: {
        state: "확대 강함",
        reason: "4개 기업 모두 전년 대비 증가했습니다.",
        coverage: 1,
        methodology: "SEC 현금흐름표 CAPEX 비교",
        as_of_range: { from: "2026-03-31", to: "2026-06-30" },
        companies: [
          { id: "microsoft", name: "Microsoft", yoy: 30, is_stale: false },
          { id: "alphabet", name: "Alphabet", yoy: 25, is_stale: false },
          { id: "meta", name: "Meta", yoy: 20, is_stale: false },
          { id: "amazon", name: "Amazon", yoy: 15, is_stale: false },
        ],
      },
      memory_cycle: {
        state: "가격 상승",
        reason: "DDR5 계약가격이 상승했습니다.",
        nand_state: "관측가격 상승",
        nand_reason: "512Gb TLC wafer spot이 상승했습니다.",
        source_url: "https://example.com/dram",
        nand_source_url: "https://example.com/nand",
        series: [
          { observation_date: "2026-08-01" },
        ],
      },
      semiconductor_cycle: {
        state: "확장 확인",
        reason: "두 개 이상의 독립 축이 확장 방향입니다.",
        as_of_date: "2026-07-01",
        methodology: "독립 축 판정",
        limitations: "거시 레짐 직접 변경 안 함",
        dram_bottleneck: {
          state: "타이트 신호",
          reason: "공개 DDR5 가격과 DRAM 수출이 함께 상승했습니다.",
          coverage: 1,
          confidence: "부분",
          primary_signal: "가격 상승",
          conflicts: ["한국 반도체 완제품 재고 부담"],
          methodology: "공개 DDR5 가격을 주축으로 사용",
          limitations: "HBM과 Server DRAM 직접 수급 미연결",
        },
        hbm_server_proxy: {
          state: "타이트 지속 신호",
          reason: "서버 RDIMM, 수출 단가·믹스, 재고 소화가 함께 확인됩니다.",
          coverage: 1,
          confidence: "부분",
          direct_hbm_data: false,
          conflicts: ["MCP 수출액 감소"],
          methodology: "세 개의 간접 프록시를 순차 확인",
          limitations: "HBM 계약가격을 직접 수집하지 않음",
          components: {
            server_rdimm: {
              state: "가격 상승",
              reason: "RDIMM 가격 상승",
              observation_date: "2026-08-03",
              price: 1565,
              change_percent: 1.29,
              is_stale: false,
            },
            export_decomposition: {
              state: "단가·믹스 주도 확장",
              reason: "수출액과 단위중량당 수출액이 상승했습니다.",
              coverage: 1,
              driver: "unit_value_mix",
              conflicts: [],
              confirmations: ["MCP 수출액 증가", "DRAM 모듈 수출액 증가"],
              context: {
                declared_weight_yoy_3m_avg: -10,
                declared_weight_role: "declared_packaging_mass_context",
                mcp_export_yoy_3m_avg: 25,
                dram_module_export_yoy_3m_avg: 30,
                export_value_mom: 5,
                export_value_sequential_3m: 10,
              },
            },
            supplier_inventory: {
              state: "상대 재고부담 크게 완화",
              reason: "매출 대비 재고비율이 하락했습니다.",
              coverage: 1,
              primary_company: "sk_hynix",
              companies: [{
                id: "samsung",
                name: "삼성전자",
                state: "상대 재고부담 크게 완화",
                period: "2026-06-30",
                inventory_to_revenue: 41.6,
                prior_inventory_to_revenue: 68.4,
                ratio_change_yoy: -39.2,
                ratio_change_pp: -26.8,
                revenue_yoy: 130,
                inventory_yoy: 39.9,
                is_stale: false,
                history: [],
              }, {
                id: "sk_hynix",
                name: "SK하이닉스",
                state: "상대 재고부담 크게 완화",
                period: "2026-06-30",
                inventory_to_revenue: 22.7,
                prior_inventory_to_revenue: 60.3,
                ratio_change_yoy: -62.4,
                ratio_change_pp: -37.6,
                revenue_yoy: 100,
                inventory_yoy: 20,
                is_stale: false,
                history: [],
              }],
            },
          },
        },
        demand: {
          state: "수출 증가",
          reason: "DRAM 수출 증가가 지속됐습니다.",
          source_url: "https://example.com/customs",
          decomposition: {
            state: "단가·믹스 주도 확장",
            reason: "수출액 +400%, 중량 -10%, 단가·믹스 +480%입니다.",
            coverage: 1,
            driver: "unit_value_mix",
            conflicts: [],
            confirmations: ["MCP 수출액 증가", "DRAM 모듈 수출액 증가"],
            context: {
              declared_weight_yoy_3m_avg: -10,
              declared_weight_role: "declared_packaging_mass_context",
              mcp_export_yoy_3m_avg: 25,
              dram_module_export_yoy_3m_avg: 30,
              export_value_mom: 5,
              export_value_sequential_3m: 10,
            },
          },
          metrics: {
            dram: metric(20), memory: metric(10), flash: metric(5),
            mcp: metric(25), dram_module: metric(30),
            dram_weight: metric(-10), dram_unit_value: metric(480),
          },
        },
        supply: {
          state: "재고 부담",
          reason: "재고 증가율이 출하 증가율을 웃돕니다.",
          source_url: "https://example.com/kosis",
          metrics: { production: metric(2), shipments: metric(3), inventory: metric(18) },
          context: {
            history_months: 60,
            inventory_percentile: 85,
            inventory_shipments_ratio: 110,
            inventory_shipments_ratio_percentile: 90,
            inventory_change_3m: 12,
            inventory_shipments_ratio_change_3m: 8,
            inventory_shipment_yoy_gap: 15,
            inventory_shipment_yoy_gap_last_two: [12, 15],
            ratio_history: [],
          },
        },
        company_confirmation: {
          state: "확장 확인",
          reason: "두 회사 실적을 확인했습니다.",
          source_url: "https://example.com/dart",
          companies: [
            {
              id: "samsung",
              name: "삼성전자",
              latest_period: "2026-06-30",
              revenue_yoy: 10,
              capex_yoy: 12,
              inventory_yoy: 8,
              operating_margin: 15,
              operating_margin_prior: 8,
              operating_margin_change_yoy_pp: 7,
              capex_period: "2026-06-30",
            },
            {
              id: "sk_hynix",
              name: "SK하이닉스",
              latest_period: "2026-06-30",
              revenue_yoy: 20,
              capex_yoy: 25,
              inventory_yoy: 5,
              operating_margin: 30,
              operating_margin_prior: 15,
              operating_margin_change_yoy_pp: 15,
              capex_period: "2026-06-30",
            },
          ],
        },
      },
      power_cycle: {
        state: "전력망 투자 가설 강화",
        reason: "수요 확대, 운영 부담과 송전 투자 실행이 독립적으로 확인됩니다.",
        methodology: "수요·운영·건설·접속대기·송전투자를 단계별로 판정",
        limitations: "각 축은 병목을 단독 확정하지 않음",
        source_url: "https://example.com/eia",
        decision_as_of_date: "2026-08-18",
        is_stale: false,
        demand_axis: {
          state: "전력 수요 확대",
          observation_date: "2026-08-18",
          national_yoy_84d: 2.5,
          ai_regions_yoy_84d: 3.8,
          source_url: "https://example.com/eia930",
        },
        operations_axis: {
          state: "부담 신호 관찰",
          observation_date: "2026-08-18",
          forecast_surprise_pct: 1.9,
          pressure_region_count: 2,
          expected_region_count: 6,
          is_stale: false,
          source_url: "https://example.com/eia930",
        },
        supply_axis: {
          state: "건설 진행",
          observation_date: "2026-06-30",
          net_additions_24m_gw: 63.4,
          net_pipeline_ratio_24m_pct: 4.9,
          is_stale: false,
          source_url: "https://example.com/eia860m",
        },
        interconnection_axis: {
          state: "접속 대기 부담 높음",
          reason: "공급측 발전·저장 접속 신청이 큽니다.",
          observation_date: "2025-12-31",
          is_stale: false,
          metrics: {
            active_queue_gw: { value: 2061.3, unit: "GW", observation_date: "2025-12-31" },
            ia_executed_share_pct: { value: 24.3, unit: "%", observation_date: "2025-12-31" },
          },
          provenance: {
            provider: "Lawrence Berkeley National Laboratory",
            source_url: "https://example.com/lbnl",
            scope_note: "공급측 발전·저장 접속 신청",
          },
        },
        transmission_investment_axis: {
          state: "송전 투자 확대",
          reason: "동일 보고자 기준 송전 투자 증가가 이어집니다.",
          observation_date: "2025-12-31",
          is_stale: false,
          metrics: {
            annual_additions_usd: { value: 35_315_000_000, unit: "USD", observation_date: "2025-12-31" },
            like_for_like_three_year_cagr_pct: { value: 13, unit: "%", observation_date: "2025-12-31" },
          },
          provenance: {
            provider: "PUDL / Catalyst Cooperative",
            source_url: "https://example.com/pudl",
            scope_note: "처리된 FERC Form 1 Schedule 204",
          },
        },
        metrics: {
          total_sales: metric(2, 2.5),
          commercial_sales: metric(5, 5.5),
        },
      },
    } as unknown as RegimeCurrent;

    const html = renderToStaticMarkup(<AiThesisMonitor data={data} />);

    expect(html).toContain("AI 인프라 투자 가설");
    expect(html).toContain("하이퍼스케일러 4사 전체 현금 CAPEX");
    expect(html).toContain("DRAM 수급 핵심축");
    expect(html).toContain("한국 반도체 완제품 재고");
    expect(html).toContain("국내 2사 실적 확인");
    expect(html).toContain("미국 전력 인프라 전달경로");
    expect(html).toContain("서로 엇갈리는 근거");
    expect(html).toContain("재고 부담");
    expect(html).toContain("90백분위");
    expect(html).toContain("서버 DRAM");
    expect(html).toContain("HBM");
    expect(html).toContain("간접계측");
    expect(html).toContain("수출 단가·믹스");
    expect(html).toContain("SK하이닉스 재고/매출");
    expect(html).toContain("재고자산 YoY · 절대액");
    expect(html).toContain("60.3% → 22.7%");
    expect(html).toContain("(-37.6%p)");
    expect(html).toContain("재고 절대액은 증가했지만");
    expect(html).toContain("판정 미사용");
    expect(html).toContain("서로 엇갈리는 근거");
    expect(html).toContain("후속 전력 인프라 근거");
    expect(html).toContain("전력 수요 압력");
    expect(html).toContain("계통 운영 압력");
    expect(html).toContain("발전·저장 건설");
    expect(html).toContain("발전 공급 접속 대기");
    expect(html).toContain("송전 투자 실행");
    expect(html).toContain("2,061 GW");
    expect(html).toContain("+13.0%");
    expect(html).toContain("$35.31B");
    expect(html).toContain("LBNL Queued Up · 공급측 접속대기");
    expect(html).toContain("PUDL 처리 FERC Form 1 · 송전 투자");
    expect(html).not.toContain("계통 병목 확정");
    expect(html).toContain('data-power-axis="1" data-semantic-tone="positive"');
    expect(html).toContain('data-power-axis="2" data-semantic-tone="caution"');
    expect(html).toContain('data-power-axis="3" data-semantic-tone="positive"');
    expect(html).toContain('data-power-axis="4" data-semantic-tone="negative"');
    expect(html).toContain('data-power-axis="5" data-semantic-tone="positive"');
    expect(html).toContain("+3.8%");
    expect(html).toContain("+63.4 GW");
    expect(html).toContain("가설 전달 단계");
    expect(html).toContain("AI 투자 상세");
    expect(html).toContain("광의 DRAM 수급과 HBM 간접 확인");
    expect(html).toContain("실적·재고 확인 상세");
    expect(html).toContain("보조 지표·원자료");
    expect(html).toContain('data-thesis-evidence="hbm"');
    expect(html).toContain('data-thesis-evidence="exports"');
    expect(html).toContain('data-thesis-evidence="companies"');
    expect(html).toContain('data-thesis-evidence="inventory"');
    expect(html).not.toContain("xl:order-");
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(4);

    const capex = html.indexOf('data-thesis-stage="capex"');
    const dram = html.indexOf('data-thesis-stage="dram"');
    const confirmation = html.indexOf('data-thesis-stage="confirmation"');
    const power = html.indexOf('data-thesis-stage="power"');
    expect(capex).toBeGreaterThan(-1);
    expect(capex).toBeLessThan(dram);
    expect(dram).toBeLessThan(confirmation);
    expect(confirmation).toBeLessThan(power);
  });
});
