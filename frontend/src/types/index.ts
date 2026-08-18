// Meowney 타입 정의 냥~ 🐱

// 자산 카테고리
export interface AssetCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  display_order: number;
}

// 자산 기본 정보
export interface Asset {
  id: string;
  portfolio_id: string;
  category_id: string | null;
  name: string;
  ticker: string | null;
  asset_type: string;
  quantity: number;
  average_price: number;
  currency: string;
  current_value: number | null;
  purchase_exchange_rate: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // 계산된 필드 (API에서 반환)
  current_price: number | null;
  market_value: number | null;
  market_value_usd: number | null; // USD 자산의 달러 원본 금액
  profit_loss: number | null;
  profit_rate: number | null;
  cost_basis_krw: number | null;
  current_exchange_rate: number | null;
  unit_price_krw: number | null;
  price_status: "live" | "cached" | "stale" | "manual" | "unavailable" | null;
  price_as_of: string | null;
  price_source: string | null;
  valuation_error: string | null;
  category_name: string | null;
  category_color: string | null;
}

// 자산 목록 요약 (v0.7.0)
export interface AssetsSummary {
  total_value: number;
  total_principal: number;
  total_profit: number;
  profit_rate: number;
  valuation_complete: boolean;
  unavailable_asset_count: number;
  stale_asset_count: number;
}

// 자산 목록 API 응답 (v0.7.0)
export interface AssetsListResponse {
  assets: Asset[];
  summary: AssetsSummary;
}

// 자산 생성 요청
export interface AssetCreate {
  name: string;
  ticker?: string;
  asset_type: string;
  category_id?: string;
  quantity: number;
  average_price: number;
  currency?: string;
  current_value?: number;
  purchase_exchange_rate?: number;
  notes?: string;
  portfolio_id?: string;
}

// 자산 수정 요청
export interface AssetUpdate {
  name?: string;
  ticker?: string;
  asset_type?: string;
  category_id?: string;
  quantity?: number;
  average_price?: number;
  currency?: string;
  current_value?: number;
  purchase_exchange_rate?: number;
  notes?: string;
  is_active?: boolean;
}

// 카테고리별 배분
export interface CategoryAllocation {
  category_id: string | null;
  category_name: string;
  color: string;
  market_value: number;
  percentage: number;
  target_percentage?: number;
}

// 대시보드 요약
export interface DashboardSummary {
  total_value: number;
  total_principal: number;
  total_profit: number;
  profit_rate: number;
  valuation_complete: boolean;
  unavailable_asset_count: number;
  stale_asset_count: number;
  annual_asset_change_rate: number | null;
  annual_baseline_value: number | null;
  annual_baseline_date: string | null;
  asset_count: number;
  allocations: CategoryAllocation[];
  last_updated: string;
  // 메인 플랜 정보 냥~
  main_plan_id?: string;
  main_plan_name?: string;
}

// 자산 히스토리
export interface AssetHistory {
  id: string;
  portfolio_id: string;
  snapshot_date: string;
  total_value: number;
  total_principal: number;
  total_profit: number;
  profit_rate: number | null;
  category_breakdown: Record<string, number> | null;
  created_at: string;
}

// API 공통 응답
export interface MeowResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// 환율 응답
export interface ExchangeRateResponse {
  rate: number;
  from_currency: string;
  to_currency: string;
  timestamp: string;
}

// 리밸런싱 알림
export interface RebalanceAlert {
  category_name: string;
  current_percentage: number;
  target_percentage: number;
  deviation: number;
  direction: "over" | "under";
}

// 리밸런싱 알림 응답
export interface RebalanceAlertsResponse {
  alerts: RebalanceAlert[];
  threshold: number;
  needs_rebalancing: boolean;
}

// 목표 진행률
export interface GoalProgressResponse {
  target_value: number;
  current_value: number;
  progress_percentage: number;
  remaining_amount: number;
  is_achieved: boolean;
}

// 포트폴리오
export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  base_currency: string;
  target_value: number | null;
  created_at: string;
  updated_at: string;
}

// 티커 검증 응답
export interface TickerValidation {
  valid: boolean;
  ticker: string;
  name: string | null;
  current_price: number | null;
  currency: string | null;
  exchange: string | null;
  error: string | null;
}

// ============================================
// 리밸런싱 플랜 관련 타입
// ============================================

// 플랜 배분 설정
export interface PlanAllocation {
  id: string;
  plan_id: string;
  asset_id: string | null;
  ticker: string | null;
  alias: string | null; // 티커 없는 자산용 별칭 냥~
  display_name: string | null; // 커스텀 표시명 냥~
  target_percentage: number;
  absolute_band?: number | null;
  relative_band?: number | null;
  asset_name?: string;
  matched_asset?: Asset; // 매칭된 자산 정보 냥~
  matched_asset_name?: string; // 매칭된 자산명 냥~
  current_value?: number; // 현재 시가 냥~
  current_percentage?: number;
  created_at: string;
  updated_at: string;
}

// 배분 그룹 아이템 냥~ (weight 제거됨 - 단순 소속 관계만)
export interface AllocationGroupItem {
  id?: string;
  asset_id?: string;
  ticker?: string;
  alias?: string;
  matched_asset?: Asset;
  // weight 필드 제거: 그룹 내 비중은 더 이상 사용하지 않음
}

// 배분 그룹 냥~
export interface AllocationGroup {
  id?: string;
  plan_id?: string;
  name: string;
  target_percentage: number;
  display_order?: number;
  items: AllocationGroupItem[];
  current_value?: number;
  current_percentage?: number;
  created_at?: string;
  updated_at?: string;
}

// 리밸런싱 플랜
export interface RebalancePlan {
  id: string;
  portfolio_id: string;
  name: string;
  description: string | null;
  strategy_prompt: string | null;
  is_main: boolean;
  is_active: boolean;
  allocations: PlanAllocation[];
  groups: AllocationGroup[]; // 배분 그룹 냥~
  created_at: string;
  updated_at: string;
}

// 플랜 생성 요청
export interface RebalancePlanCreate {
  name: string;
  description?: string;
  strategy_prompt?: string;
  is_main?: boolean;
  portfolio_id?: string;
  allocations?: PlanAllocationCreate[];
}

// 플랜 수정 요청
export interface RebalancePlanUpdate {
  name?: string;
  description?: string;
  strategy_prompt?: string;
  is_main?: boolean;
  is_active?: boolean;
}

// 배분 생성 요청
export interface PlanAllocationCreate {
  asset_id?: string;
  ticker?: string;
  alias?: string; // 티커 없는 자산용 별칭 냥~
  display_name?: string; // 커스텀 표시명 냥~
  target_percentage: number;
  absolute_band?: number | null;
  relative_band?: number | null;
}

// 그룹 아이템 생성 요청 (weight 제거됨)
export interface AllocationGroupItemCreate {
  asset_id?: string;
  ticker?: string;
  alias?: string;
  // weight 필드 제거: 그룹 내 비중은 더 이상 사용하지 않음
}

// 그룹 생성 요청
export interface AllocationGroupCreate {
  name: string;
  target_percentage: number;
  display_order?: number;
  items?: AllocationGroupItemCreate[];
}

// 자산 기준 리밸런싱 제안
export interface AssetRebalanceSuggestion {
  asset_id: string | null;
  asset_name: string;
  ticker: string | null;
  alias: string | null; // 티커 없는 자산용 별칭 냥~
  current_value: number;
  current_percentage: number;
  target_percentage: number;
  difference_percentage: number;
  suggested_amount: number;
  suggested_quantity: number | null;
  is_matched: boolean; // 보유 자산과 매칭 여부 냥~
  effective_band: number;
  action: "buy" | "sell" | "hold";
}

// 그룹 아이템 정보 (단순화: 개별 목표 없음)
export interface GroupItemSuggestion {
  asset_id: string | null;
  asset_name?: string | null;
  ticker: string | null;
  alias: string | null;
  current_value: number;
  is_matched: boolean;
  // weight, target_value, suggested_amount 제거됨 - 그룹 단위 계산만 수행
}

// 그룹 리밸런싱 제안
export interface GroupRebalanceSuggestion {
  group_id: string | null;
  group_name: string;
  target_percentage: number;
  current_percentage: number;
  current_value: number;
  target_value: number;
  suggested_amount: number;
  items: GroupItemSuggestion[];
  effective_band: number;
  action: "buy" | "sell" | "hold";
}

// 자산 기준 리밸런싱 응답
export interface AssetRebalanceResponse {
  plan_id: string;
  plan_name: string;
  total_value: number;
  suggestions: AssetRebalanceSuggestion[];
  group_suggestions: GroupRebalanceSuggestion[]; // 그룹 제안 냥~
  valuation_complete: boolean;
  unavailable_asset_count: number;
  stale_asset_count: number;
  valuation_error?: string | null;
}

// 티커 히스토리 (Sparkline용)
export interface TickerHistoryPoint {
  date: string;
  close: number;
}

export interface TickerHistoryResponse {
  ticker: string;
  data: TickerHistoryPoint[];
  change_rate: number;
}

// ============================================
// 데이터 마이그레이션 타입 냥~
// ============================================

// 내보내기 데이터 구조
export interface ExportData {
  schema_version: string;
  export_date: string;
  portfolios: ExportPortfolio[];
  assets: ExportAsset[];
  rebalance_plans: ExportPlan[];
  plan_allocations: ExportAllocation[];
}

export interface ExportPortfolio {
  name: string;
  description: string | null;
  base_currency: string;
  target_value: number | null;
}

export interface ExportAsset {
  name: string;
  ticker: string | null;
  asset_type: string;
  quantity: number;
  average_price: number;
  currency: string;
  current_value: number | null;
  purchase_exchange_rate: number | null;
  notes: string | null;
  is_active: boolean;
  _portfolio_name: string | null;
}

export interface ExportPlan {
  name: string;
  description: string | null;
  strategy_prompt: string | null;
  is_main: boolean;
  is_active: boolean;
  _portfolio_name: string | null;
}

export interface ExportAllocation {
  ticker: string | null;
  target_percentage: number;
  _plan_name: string | null;
}

// 가져오기 응답
export interface ImportResponse {
  success: boolean;
  message: string;
  stats: {
    portfolios_created: number;
    assets_created: number;
    plans_created: number;
    allocations_created: number;
  };
}

// 스키마 정보
export interface SchemaInfo {
  current_version: string;
  supported_versions: string[];
  fields: Record<string, string[]>;
}

// ============================================
// 시장 지표 타입 냥~
// ============================================

export interface MarketIndicator {
  ticker: string;
  name: string;
  price: number;
  change_rate: number;
  currency: string;
}

export interface GoldSilverRatio {
  gold_price: number;
  silver_price: number;
  ratio: number;
}

export interface IndexPerEntry {
  label: string;
  ticker: string;
  per: number | null;
  type: string | null;
  valid: boolean;
}

export interface IndexPer {
  sp500: IndexPerEntry;
  nasdaq: IndexPerEntry;
  kospi: IndexPerEntry;
}

export interface MarketIndicatorsResponse {
  indicators: MarketIndicator[];
  gold_silver_ratio: GoldSilverRatio | null;
  index_per: IndexPer | null;
  timestamp: string;
}

export type RegimeLevel = "유지" | "경계" | "약화" | "전환";

export interface RegimeSignal {
  id: string;
  domain: string;
  name: string;
  unit?: string;
  source: string;
  frequency?: string;
  direction?: "up_good" | "up_bad" | "neutral";
  observation_date?: string;
  fetched_at?: string;
  value?: number;
  change_1m?: number | null;
  change_3m?: number | null;
  change_12m?: number | null;
  score: number;
  status: string;
  reason: string;
  history?: { date: string; value: number }[];
  display_period?: string;
  display_metrics?: { label: string; value: number; unit: string; kind: string }[];
  decision_chart?: {
    title: string;
    unit: string;
    series: Array<{ key: string; label: string }>;
    points: Array<Record<string, string | number>>;
    reference_lines: Array<{ value: number; label: string }>;
  } | null;
  decision_role?: "core" | "corroborative" | "context";
  usage?: "regime" | "trigger" | "display";
  available_from?: string | null;
  release_date?: string | null;
  vintage_kind?: string;
  vintage_history_available?: boolean;
  is_stale?: boolean;
  age_days?: number | null;
  max_age_days?: number;
  usable_for_decision?: boolean;
}

export type ReviewUrgency = "required" | "watch" | "not_needed";

export interface RegimeTrigger {
  rule_id: string;
  rule_version: string;
  domain: string;
  severity: "medium" | "high" | "critical";
  evidence_cluster: string;
  summary: string;
  evidence: Record<string, number | string | null>;
}

export interface RegimeCoverageDomain {
  total: number;
  usable: number;
  stale: string[];
  coverage: number;
  status: "충분" | "부분" | "판정 불가";
}

export interface RegimeDomain {
  id: string;
  name: string;
  state: string;
  score: number;
  reasons: string[];
}

export interface RegimeTrendMetric {
  latest: number | null;
  observation_date: string | null;
  yoy: number | null;
  yoy_3m_avg: number | null;
  mom?: number | null;
  sequential_3m?: number | null;
  momentum_3m_annualized?: number | null;
  change_3m?: number | null;
  unit: string;
  history: Array<{ date: string; value: number; yoy: number | null }>;
}

export interface SemiconductorCycle {
  state: string;
  reason: string;
  coverage: number;
  role: "corroborative";
  as_of_date: string | null;
  dram_bottleneck: {
    state: string;
    reason: string;
    coverage: number;
    confidence: "부분" | "충분";
    primary_signal: string;
    conflicts: string[];
    methodology: string;
    limitations: string;
  };
  hbm_server_proxy: {
    state: string;
    reason: string;
    coverage: number;
    confidence: "부분";
    direct_hbm_data: false;
    conflicts: string[];
    methodology: string;
    limitations: string;
    components: {
      server_rdimm: {
        state: string;
        reason: string;
        observation_date: string | null;
        price: number | null;
        change_percent: number | null;
        is_stale: boolean;
      };
      export_decomposition: {
        state: string;
        reason: string;
        coverage: number;
        driver: "unit_value_mix" | "value_and_downstream" | "export_value" | "contraction" | "mixed" | "unknown";
        conflicts: string[];
        confirmations: string[];
        context: {
          declared_weight_yoy_3m_avg: number | null;
          declared_weight_role: "declared_packaging_mass_context" | "packaging_mix_context";
          mcp_export_yoy_3m_avg: number | null;
          dram_module_export_yoy_3m_avg: number | null;
          export_value_mom: number | null;
          export_value_sequential_3m: number | null;
        };
      };
      supplier_inventory: {
        state: string;
        reason: string;
        coverage: number;
        primary_company: "sk_hynix";
        companies: Array<{
          id: string;
          name: string;
          state: string;
          period: string | null;
          inventory_to_revenue: number | null;
          prior_inventory_to_revenue: number | null;
          ratio_change_yoy: number | null;
          ratio_change_pp: number | null;
          revenue_yoy: number | null;
          inventory_yoy: number | null;
          is_stale: boolean;
          history: Array<{ period: string; value: number }>;
        }>;
      };
    };
  };
  demand: {
    state: string;
    reason: string;
    decomposition: {
      state: string;
      reason: string;
      coverage: number;
      driver: "unit_value_mix" | "value_and_downstream" | "export_value" | "contraction" | "mixed" | "unknown";
      conflicts: string[];
      confirmations: string[];
      context: {
        declared_weight_yoy_3m_avg: number | null;
        declared_weight_role: "declared_packaging_mass_context" | "packaging_mix_context";
        mcp_export_yoy_3m_avg: number | null;
        dram_module_export_yoy_3m_avg: number | null;
        export_value_mom: number | null;
        export_value_sequential_3m: number | null;
      };
    };
    metrics: {
      memory: RegimeTrendMetric;
      dram: RegimeTrendMetric;
      flash: RegimeTrendMetric;
      mcp: RegimeTrendMetric;
      dram_module: RegimeTrendMetric;
      dram_weight: RegimeTrendMetric;
      dram_unit_value: RegimeTrendMetric;
    };
    source: string;
    source_url: string | null;
    fetch_status: RegimeFeedHealth | null;
  };
  supply: {
    state: string;
    reason: string;
    metrics: {
      production: RegimeTrendMetric;
      shipments: RegimeTrendMetric;
      inventory: RegimeTrendMetric;
    };
    seasonally_adjusted_history: Record<
      "production" | "shipments" | "inventory",
      Array<{ date: string; value: number }>
    >;
    context: {
      history_months: number;
      inventory_percentile: number | null;
      inventory_shipments_ratio: number | null;
      inventory_shipments_ratio_percentile: number | null;
      inventory_change_3m: number | null;
      inventory_shipments_ratio_change_3m: number | null;
      inventory_shipment_yoy_gap: number | null;
      inventory_shipment_yoy_gap_last_two: number[];
      ratio_history: Array<{ date: string; value: number }>;
    };
    source: string;
    source_url: string;
    fetch_status: RegimeFeedHealth | null;
  };
  company_confirmation: {
    state: string;
    reason: string;
    coverage: number;
    source: string;
    source_url: string;
    methodology: string;
    limitations: string;
    fetch_status: RegimeFeedHealth | null;
    companies: Array<{
      id: string;
      name: string;
      ticker: string;
      latest_period: string | null;
      age_days: number | null;
      is_stale: boolean;
      latest_capex: number | null;
      capex_period: string | null;
      capex_yoy: number | null;
      revenue_yoy: number | null;
      inventory_yoy: number | null;
      operating_margin: number | null;
      operating_margin_prior: number | null;
      operating_margin_change_yoy_pp: number | null;
      histories: Record<
        "capex" | "revenue" | "operating_income" | "inventory",
        Array<{
          period: string;
          value: number;
          derivation?: string;
          source_periods?: string[];
        }>
      >;
    }>;
  };
  methodology: string;
  limitations: string;
}

export interface PowerCycle {
  state: string;
  reason: string;
  coverage: number;
  role: "context";
  as_of_date: string | null;
  age_days: number | null;
  is_stale: boolean;
  metrics: Record<
    "total_sales" | "commercial_sales" | "industrial_sales" | "generation" | "capacity",
    RegimeTrendMetric
  >;
  source: string;
  source_url: string;
  fetch_status: RegimeFeedHealth | null;
  methodology: string;
  limitations: string;
}

export interface RegimeFeedHealth {
  source: string;
  status: string;
  last_attempted_at?: string | null;
  last_success_at?: string | null;
  item_count?: number;
  error?: string | null;
}

export interface RateChangeWindow {
  periods: number;
  start_date: string;
  end_date: string;
  changes: {
    us10y: number;
    tips10y: number;
    bei10y: number;
  };
}

export interface LongEndRateChangeWindow {
  periods: number;
  start_date: string;
  end_date: string;
  changes: {
    us10y: number;
    us30y: number;
    tips10y: number;
    tips30y: number;
  };
}

export interface RegimeCurrent {
  id: string;
  evaluated_at: string;
  candidate_regime: RegimeLevel;
  automatic_regime: RegimeLevel;
  signals: RegimeSignal[];
  domains: RegimeDomain[];
  reasons: string[];
  portfolio_signals: string[];
  last_fetch: { status: string; finished_at?: string; error?: string } | null;
  previous_snapshot: {
    created_at: string;
    automatic_regime: RegimeLevel;
  } | null;
  changes_since_snapshot: string[];
  thesis_changes_since_snapshot: string[];
  cache_age_hours: number | null;
  newest_cache_age_hours?: number | null;
  is_stale: boolean;
  upcoming_events: Array<{
    id: string;
    event_type: string;
    scheduled_at: string | null;
    scheduled_date?: string | null;
    time_precision?: "date" | "datetime";
    importance: string;
    status: string;
    source: string;
    source_url: string;
    affected_domains: string[];
  }>;
  ai_capex: {
    state: string;
    reason: string;
    coverage: number;
    methodology: string;
    as_of_range?: { from: string | null; to: string | null };
    period_alignment?: "company_fiscal_quarter";
    companies: Array<{
      id: string;
      name: string;
      latest_period: string | null;
      latest_capex: number | null;
      yoy: number | null;
      ttm: number | null;
      age_days?: number | null;
      is_stale?: boolean;
      history: Array<{
        period: string;
        value: number;
        derivation?: string;
        source_accessions?: string[];
      }>;
      fetch_status: { status: string; last_success_at?: string } | null;
    }>;
  };
  memory_cycle: {
    state: string;
    reason: string;
    nand_state: string;
    nand_reason: string;
    source: string;
    source_url: string;
    nand_source_url: string;
    limitations: string;
    fetch_status: { status: string; last_success_at?: string; error?: string } | null;
    series: Array<{
      series_id: string;
      market_type: "contract" | "spot" | "module_spot" | "nand_wafer_spot" | "nand_client_ssd_contract";
      product_name: string;
      observation_date: string;
      period_label: string | null;
      price_high: number | null;
      price_low: number | null;
      price_average: number;
      change_percent: number | null;
      currency?: string;
      price_basis?: string;
      age_days?: number;
      max_age_days?: number;
      is_stale?: boolean;
      history: Array<{ observation_date: string; price_average: number; change_percent: number | null }>;
    }>;
  };
  semiconductor_cycle: SemiconductorCycle;
  power_cycle: PowerCycle;
  review_urgency: ReviewUrgency;
  review_reasons: string[];
  triggers: RegimeTrigger[];
  coverage: {
    domains: Record<string, RegimeCoverageDomain>;
    insufficient_domains: number;
    overall: number;
  };
  rate_decomposition: {
    periods: number;
    start_date?: string;
    end_date?: string;
    nominal_change: number;
    real_change: number;
    breakeven_change: number;
    residual: number;
    driver: string;
  } | null;
  review_acknowledged: boolean;
  needs_new_review: boolean;
  latest_acknowledgment: {
    completed_at: string;
    note: string | null;
    trigger_state: Record<string, string>;
    assessment_fingerprint?: string | null;
    candidate_regime?: RegimeLevel | null;
    urgency?: ReviewUrgency | null;
  } | null;
  assessment_fingerprint?: string;
  rule_version: string;
  macro_quadrant: {
    version: string;
    scope: string;
    scope_status?: "macro_only" | "full";
    as_of_date: string | null;
    label: string;
    history_basis?: string;
    trajectory_status?: string;
    growth_level?: MacroLevelAxis;
    inflation_level?: MacroLevelAxis;
    environment_quadrant?: string;
    environment_label?: string;
    environment_point?: {
      growth: number | null;
      inflation: number | null;
      quadrant: string;
      label: string;
      semantics: "absolute_macro_level";
    };
    momentum_vector?: MacroPressureVector;
    pressure_vector?: MacroPressureVector;
    financial_conditions?: {
      rates?: {
        score: number | null;
        label: string;
        driver: string;
        coverage: number;
        version: string;
        methodology: string;
      };
      policy: {
        score: number | null;
        label: string;
        fed_funds: number | null;
        core_pce_yoy: number | null;
        real_policy_rate: number | null;
        semantics?: string;
      };
      long_rates: {
        score: number | null;
        label: string;
        nominal_10y: number | null;
        real_10y: number | null;
        breakeven_10y: number | null;
        nominal_30y: number | null;
        real_30y: number | null;
        spread_30y10y: number | null;
        term_premium: number | null;
        term_premium_percentile?: number | null;
        term_premium_change_63d?: number | null;
        term_premium_label?: string;
        term_premium_role?: "decomposition_context";
        term_premium_model?: string;
      };
      recent_shock?: {
        score: number | null;
        base_score?: number | null;
        duration_floor?: number;
        label: string;
        direction: string;
        persistent: boolean;
        change_20d: RateChangeWindow | null;
        change_63d: RateChangeWindow | null;
      };
      duration_stress?: {
        score: number | null;
        bounded_shock_floor: number;
        label: string;
        driver: string;
        nominal_10y: number | null;
        nominal_30y: number | null;
        real_30y: number | null;
        spread_30y10y: number | null;
        change_20d: LongEndRateChangeWindow | null;
        change_63d: LongEndRateChangeWindow | null;
        breakeven_10y_change_20d?: number | null;
        confirmation_count_5d: number;
        confirmed: boolean;
        persistent: boolean;
        role: "bounded_confirmation";
      };
      yield_curve?: {
        score: number | null;
        label: string;
        state: string;
        spread_10y3m: number | null;
        monthly_average_10y3m: number | null;
        recession_probability_12m: number | null;
        spread_10y2y: number | null;
        monthly_average_10y2y: number | null;
        confirmation?: string;
        inversion_days: number;
        days_since_inversion: number | null;
        last_inversion_date: string | null;
        inversion_memory: boolean;
        steepening: {
          state: string;
          long_change_20d: number | null;
          short_change_20d: number | null;
          spread_change_20d: number | null;
          start_date?: string;
          end_date?: string;
        };
        as_of_date: string | null;
        evidence_cluster: "yield_curve";
        probability_model?: string;
        smoothing?: string;
      };
      credit: {
        score: number | null;
        label: string;
        hy_oas: number | null;
        ig_oas: number | null;
        nfci: number | null;
      };
    };
    growth_motion?: { delta: number | null; direction: string; speed: string };
    inflation_motion?: {
      delta: number | null;
      direction: string;
      speed: string;
    };
    points: Array<{
      label: string;
      as_of_date: string;
      quadrant: string;
      growth: MacroMomentumAxis;
      inflation: MacroMomentumAxis;
    }>;
  };
  data_quality: {
    status: "충분" | "제한" | "판정 불가";
    overall_coverage: number;
    reasons: string[];
    stale: Array<{ id: string; name: string; observation_date?: string }>;
    auxiliary_stale: Array<{
      id: string;
      name: string;
      observation_date?: string;
    }>;
    unavailable: string[];
    scope: "us_macro_decision_inputs";
    observation_range: { from: string | null; to: string | null };
    last_fetched_at: string | null;
  };
  feed_health: Record<
    "macro" | "events" | "ai_capex" | "memory" | "kosis" | "customs" | "opendart" | "eia",
    RegimeFeedHealth | null
  >;
}

export interface MacroMomentumAxis {
  coordinate: number | null;
  data_quality_score?: number;
  data_quality_label?: string;
  confidence: number;
  confidence_label: string;
  contributors: Array<{
    id: string;
    name: string;
    z: number;
    weighted_z: number;
    cluster?: string;
  }>;
}

export interface MacroPressureVector {
  dx: number | null;
  dy: number | null;
  direction: string;
  strength: string;
  strength_score: number | null;
  data_quality_score?: number;
  semantics: "relative_recent_pressure";
  is_displacement: false;
  trajectory_available: false;
}

export interface MacroLevelAxis {
  score: number | null;
  label: string;
  coverage: number;
  contributors: Array<{
    id: string;
    name: string;
    value: number;
    normalized: number;
    weight: number;
  }>;
}

export interface RegimeSnapshot {
  id: string;
  created_at: string;
  automatic_regime: RegimeLevel;
  user_regime: RegimeLevel | null;
  user_note: string | null;
  domains: RegimeDomain[];
  reasons: string[];
  review_urgency?: ReviewUrgency;
  triggers?: RegimeTrigger[];
  coverage?: RegimeCurrent["coverage"];
  rule_version?: string;
  review_completed?: number;
  as_of_date?: string | null;
  last_fetched_at?: string | null;
  observation_range?: { from: string | null; to: string | null };
  macro_quadrant?: RegimeCurrent["macro_quadrant"];
  ai_capex?: RegimeCurrent["ai_capex"];
  memory_cycle?: RegimeCurrent["memory_cycle"];
  semiconductor_cycle?: RegimeCurrent["semiconductor_cycle"];
  power_cycle?: RegimeCurrent["power_cycle"];
  input_fingerprint?: string | null;
  assessment_fingerprint?: string | null;
  snapshot_schema_version?: string;
  raw_data_available?: boolean;
  feed_health?: RegimeCurrent["feed_health"];
}

// ============================================
// 과거 데이터 수동 입력 타입 (v0.6.0) 냥~
// ============================================

export interface ManualHistoryEntry {
  snapshot_date: string;
  total_value: number;
  total_principal: number;
}

export interface ManualHistoryItem {
  id: string;
  portfolio_id: string;
  snapshot_date: string;
  total_value: number;
  total_principal: number;
  total_profit: number;
  profit_rate: number | null;
  is_manual: boolean;
  created_at: string;
}

export interface ManualHistoryCreateResponse {
  success: boolean;
  message: string;
  entries: ManualHistoryItem[];
}

// ============================================
// 사용자 설정 타입 (v0.8.0) 냥~
// ============================================

export interface UserSettings {
  id: string;
  user_id: string;
  default_absolute_band: number; // 기본 절대 밴드 (%p)
  default_relative_band: number; // 기본 상대 밴드 (%)
  created_at: string;
  updated_at: string;
}

export interface UserSettingsUpdate {
  default_absolute_band?: number;
  default_relative_band?: number;
}
