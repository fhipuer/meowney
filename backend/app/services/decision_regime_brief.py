"""Compact, decision-ready regime evidence for the portfolio review document.

The browser needs full histories for charts, while an external portfolio review
needs current values, decision-window changes, provenance and model context.
This module deliberately never serializes chart histories or raw snapshot rows.
"""

from __future__ import annotations

from typing import Any, Iterable


DECISION_BRIEF_SCHEMA_VERSION = "1.1.0"

SIGNAL_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "시장·환율·원자재",
        (
            "market_kospi", "market_sp500", "market_nasdaq", "market_vix",
            "market_usdkrw", "market_dollar", "market_wti", "market_copper",
            "market_gold", "market_silver", "market_gold_silver_ratio",
        ),
    ),
    (
        "미국 성장·고용",
        (
            "us_gdp", "us_unemployment", "us_payrolls", "us_claims",
            "us_retail", "us_indpro",
        ),
    ),
    (
        "한국 거시 보조",
        ("kr_gdp", "kr_exports", "kr_indpro"),
    ),
    (
        "물가",
        ("cpi", "core_cpi", "pce", "core_pce", "ppi", "wages"),
    ),
    (
        "금리",
        (
            "fedfunds", "us3m", "us2y", "us10y", "us30y", "tips10y",
            "tips30y", "bei10y", "curve10y3m", "curve2s10s", "term_premium",
        ),
    ),
    (
        "유동성·신용",
        ("hy_oas", "ig_oas", "nfci", "fed_assets", "bank_reserves", "reverse_repo"),
    ),
)

REVIEW_LABELS = {
    "required": "지금 상세점검",
    "watch": "관찰 유지",
    "not_needed": "신규 상세점검 사유 없음",
}
SEVERITY_LABELS = {"critical": "매우 중요", "high": "중요", "medium": "관찰"}


def _text(value: Any) -> str:
    if value is None:
        return "-"
    return str(value).replace("\r", " ").replace("\n", " ").replace("|", "\\|")


def _number(value: Any, digits: int = 2, *, signed: bool = False) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "-"
    sign = "+" if signed and number > 0 else ""
    return f"{sign}{number:,.{digits}f}"


def _percent(value: Any, digits: int = 1, *, signed: bool = False) -> str:
    rendered = _number(value, digits, signed=signed)
    return f"{rendered}%" if rendered != "-" else rendered


def _coverage(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "-"
    if 0 <= number <= 1:
        number *= 100
    return f"{number:.0f}%"


def _value_with_unit(value: Any, unit: Any, digits: int = 2) -> str:
    rendered = _number(value, digits)
    if rendered == "-":
        return rendered
    suffix = _text(unit)
    return rendered if suffix == "-" else f"{rendered} {suffix}"


def _money_billions(value: Any) -> str:
    try:
        return f"${float(value) / 1_000_000_000:.1f}B"
    except (TypeError, ValueError):
        return "-"


def _source_link(label: Any, url: Any) -> str:
    text = _text(label)
    if isinstance(url, str) and url.startswith(("http://", "https://")):
        return f"[{text}]({url})"
    return text


def _metric_summary(signal: dict[str, Any]) -> str:
    rendered: list[str] = []
    for item in signal.get("display_metrics") or []:
        value = item.get("value")
        unit = item.get("unit") or ""
        if value is None:
            continue
        signed = item.get("kind") in {"delta", "return"}
        rendered.append(
            f"{_text(item.get('label'))} {_number(value, 2, signed=signed)}{_text(unit) if unit else ''}"
        )
    if rendered:
        return " · ".join(rendered)
    fallback = []
    for label, key in (("1개월", "change_1m"), ("3개월", "change_3m"), ("12개월", "change_12m")):
        if signal.get(key) is not None:
            fallback.append(f"{label} {_percent(signal[key], 2, signed=True)}")
    return " · ".join(fallback) or _text(signal.get("reason"))


def _append_signal_table(lines: list[str], title: str, ids: Iterable[str], signals: dict[str, dict[str, Any]]) -> None:
    rows = [signals[key] for key in ids if key in signals]
    if not rows:
        return
    lines += [f"#### {title}", "", "| 지표 | 현재값 | 주요 변화 | 앱 판정 | 관측일 | 출처 |", "| --- | ---: | --- | --- | --- | --- |"]
    for item in rows:
        status = _text(item.get("status"))
        if item.get("is_stale"):
            status += " · 오래됨"
        lines.append(
            f"| {_text(item.get('name'))} | {_value_with_unit(item.get('value'), item.get('unit'))} "
            f"| {_metric_summary(item)} | {status} · {_text(item.get('reason'))} "
            f"| {_text(item.get('observation_date'))} | {_text(item.get('source'))} |"
        )
    lines.append("")


def _change_window(window: dict[str, Any] | None, keys: tuple[str, ...]) -> str:
    if not window:
        return "-"
    changes = window.get("changes") or {}
    parts = [
        f"{key} {_number(changes.get(key), 2, signed=True)}%p"
        for key in keys if changes.get(key) is not None
    ]
    date_range = ""
    if window.get("start_date") or window.get("end_date"):
        date_range = f" ({_text(window.get('start_date'))} → {_text(window.get('end_date'))})"
    return (" · ".join(parts) or "-") + date_range


def _trend_row(name: str, metric: dict[str, Any] | None) -> str:
    metric = metric or {}
    changes = []
    for label, key in (
        ("YoY", "yoy"), ("3개월 평균 YoY", "yoy_3m_avg"),
        ("MoM", "mom"), ("직전 3개월 대비", "sequential_3m"),
        ("3개월 변화", "change_3m"),
    ):
        if metric.get(key) is not None:
            changes.append(f"{label} {_percent(metric[key], 1, signed=True)}")
    return (
        f"| {_text(name)} | {_value_with_unit(metric.get('latest'), metric.get('unit'))} "
        f"| {' · '.join(changes) or '-'} | {_text(metric.get('observation_date'))} |"
    )


def _append_regime_summary(lines: list[str], current: dict[str, Any]) -> None:
    data_quality = current.get("data_quality") or {}
    observation_range = data_quality.get("observation_range") or {}
    lines += [
        "## Meowney 정량 레짐 데이터",
        "",
        "> 아래 내용은 동일 데이터에 동일 결과를 내는 앱의 사전 관측입니다. 최종 투자 결론이 아니며, 외부 분석에서는 앱 이후 발표·정성적 기업 정보·미수집 영역을 독립적으로 보완합니다.",
        "",
        f"- 정량 데이터 스키마: {DECISION_BRIEF_SCHEMA_VERSION}",
        f"- 레짐 평가시각: {_text(current.get('evaluated_at'))}",
        f"- 핵심 관측 범위: {_text(observation_range.get('from'))} ~ {_text(observation_range.get('to'))}",
        f"- 마지막 수집시각: {_text(data_quality.get('last_fetched_at'))}",
        f"- 규칙 버전: {_text(current.get('rule_version'))}",
        f"- 데이터 품질: {_text(data_quality.get('status'))} · coverage {_coverage(data_quality.get('overall_coverage'))}",
        "",
        "### 조기점검 및 자동판정",
        "",
        f"- 점검 필요도: {REVIEW_LABELS.get(current.get('review_urgency'), _text(current.get('review_urgency')))}",
        f"- 확정 자동 레짐: {_text(current.get('automatic_regime'))}",
        f"- 최신 데이터 후보 레짐: {_text(current.get('candidate_regime'))}",
        f"- 마지막 공식 Snapshot: {_text((current.get('previous_snapshot') or {}).get('created_at'))}",
    ]
    for reason in current.get("review_reasons") or []:
        lines.append(f"- 점검 사유: {_text(reason)}")
    for change in (current.get("changes_since_snapshot") or []) + (current.get("thesis_changes_since_snapshot") or []):
        lines.append(f"- Snapshot 이후 변화: {_text(change)}")
    lines.append("")

    domains = current.get("domains") or []
    if domains:
        lines += ["| 영역 | 판정 | 핵심 근거 |", "| --- | --- | --- |"]
        for domain in domains:
            reasons = " · ".join(_text(reason) for reason in domain.get("reasons") or []) or "명시적 악화 근거 없음"
            lines.append(f"| {_text(domain.get('name'))} | {_text(domain.get('state'))} | {reasons} |")
        lines.append("")

    triggers = current.get("triggers") or []
    if triggers:
        lines += ["#### 활성 경보", "", "| 중요도 | 영역 | 정량 근거 | 규칙 버전 |", "| --- | --- | --- | --- |"]
        for trigger in triggers[:5]:
            lines.append(
                f"| {SEVERITY_LABELS.get(trigger.get('severity'), _text(trigger.get('severity')))} "
                f"| {_text(trigger.get('domain'))} | {_text(trigger.get('summary'))} "
                f"| {_text(trigger.get('rule_version'))} |"
            )
        lines.append("")


def _append_macro_environment(lines: list[str], current: dict[str, Any]) -> None:
    macro = current.get("macro_quadrant") or {}
    growth = macro.get("growth_level") or {}
    inflation = macro.get("inflation_level") or {}
    pressure = macro.get("pressure_vector") or macro.get("momentum_vector") or {}
    lines += [
        "### 거시경제 현재 환경",
        "",
        f"- 기준일: {_text(macro.get('as_of_date'))}",
        f"- 현재 절대환경: {_text(macro.get('environment_label') or macro.get('label'))}",
        f"- 성장 수준: {_text(growth.get('label'))} · coverage {_coverage(growth.get('coverage'))}",
        f"- 물가 수준: {_text(inflation.get('label'))} · coverage {_coverage(inflation.get('coverage'))}",
        f"- 최근 지표 압력: {_text(pressure.get('direction'))} · 강도 {_text(pressure.get('strength'))}",
        "",
    ]
    signal_map = {item.get("id"): item for item in current.get("signals") or [] if item.get("id")}
    for title, ids in SIGNAL_GROUPS:
        _append_signal_table(lines, title, ids, signal_map)


def _append_financial_conditions(lines: list[str], current: dict[str, Any]) -> None:
    conditions = (current.get("macro_quadrant") or {}).get("financial_conditions") or {}
    if not conditions:
        return
    policy = conditions.get("policy") or {}
    long_rates = conditions.get("long_rates") or {}
    shock = conditions.get("recent_shock") or {}
    duration = conditions.get("duration_stress") or {}
    curve = conditions.get("yield_curve") or {}
    credit = conditions.get("credit") or {}
    lines += [
        "### 금융 전달경로 계산",
        "",
        "| 계층 | 앱 판정 | 정량 근거 |",
        "| --- | --- | --- |",
        f"| 정책 제약 | {_text(policy.get('label'))} | Fed {_percent(policy.get('fed_funds'), 2)} · Core PCE YoY {_percent(policy.get('core_pce_yoy'), 2)} · 실질 정책금리 {_percent(policy.get('real_policy_rate'), 2, signed=True)} |",
        f"| 장기금리 부담 | {_text(long_rates.get('label'))} | 10Y {_percent(long_rates.get('nominal_10y'), 2)} · 10Y TIPS {_percent(long_rates.get('real_10y'), 2)} · BEI {_percent(long_rates.get('breakeven_10y'), 2)} · 기간 프리미엄 {_percent(long_rates.get('term_premium'), 2, signed=True)} |",
        f"| 최근 금리 충격 | {_text(shock.get('label'))} | 20관측일 {_change_window(shock.get('change_20d'), ('us10y', 'tips10y', 'bei10y'))} / 63관측일 {_change_window(shock.get('change_63d'), ('us10y', 'tips10y', 'bei10y'))} |",
        f"| 30년물 부담 | {_text(duration.get('label'))} | 30Y {_percent(duration.get('nominal_30y'), 2)} · 30Y TIPS {_percent(duration.get('real_30y'), 2)} · 30Y-10Y {_percent(duration.get('spread_30y10y'), 2, signed=True)} · 최근 5회 중 {int(duration.get('confirmation_count_5d') or 0)}회 확인 · {_text(duration.get('driver'))} |",
        f"| 수익률곡선 | {_text(curve.get('label'))} | 10Y-3M 월평균 {_percent(curve.get('monthly_average_10y3m'), 2, signed=True)} · 2Y-10Y 월평균 {_percent(curve.get('monthly_average_10y2y'), 2, signed=True)} · 12개월 침체확률 {_percent(curve.get('recession_probability_12m'), 1)} · {_text(curve.get('state'))} |",
        f"| 신용·금융여건 | {_text(credit.get('label'))} | HY OAS {_percent(credit.get('hy_oas'), 2)} · IG OAS {_percent(credit.get('ig_oas'), 2)} · NFCI {_number(credit.get('nfci'), 2, signed=True)} |",
        "",
    ]


def _append_ai_thesis(lines: list[str], current: dict[str, Any]) -> None:
    ai = current.get("ai_capex") or {}
    memory = current.get("memory_cycle") or {}
    semiconductor = current.get("semiconductor_cycle") or {}
    power = current.get("power_cycle") or {}
    lines += [
        "### AI 인프라 투자 가설 정량 근거",
        "",
        f"- 하이퍼스케일러 CAPEX 판정: {_text(ai.get('state'))} · {_text(ai.get('reason'))} · coverage {_coverage(ai.get('coverage'))}",
    ]
    companies = ai.get("companies") or []
    if companies:
        lines += ["", "| 기업 | 최근 분기 | 분기 CAPEX | YoY | TTM | 수집 상태 |", "| --- | --- | ---: | ---: | ---: | --- |"]
        for company in companies:
            status = company.get("fetch_status") or {}
            lines.append(
                f"| {_text(company.get('name'))} | {_text(company.get('latest_period'))} "
                f"| {_money_billions(company.get('latest_capex'))} | {_percent(company.get('yoy'), 1, signed=True)} "
                f"| {_money_billions(company.get('ttm'))} | {_text(status.get('status'))} |"
            )
        lines.append("")

    lines += [
        f"- DRAM 가격 표본: {_text(memory.get('state'))} · {_text(memory.get('reason'))}",
        f"- NAND 가격 표본: {_text(memory.get('nand_state'))} · {_text(memory.get('nand_reason'))}",
    ]
    series = memory.get("series") or []
    if series:
        lines += ["", "| 공개 가격 표본 | 시장 | 최근 가격 | 최근 변화 | 관측일 |", "| --- | --- | ---: | ---: | --- |"]
        for item in series:
            currency = item.get("currency") or "USD"
            lines.append(
                f"| {_text(item.get('product_name'))} | {_text(item.get('market_type'))} "
                f"| {_value_with_unit(item.get('price_average'), currency, 3)} "
                f"| {_percent(item.get('change_percent'), 2, signed=True)} | {_text(item.get('observation_date'))} |"
            )
        lines.append("")

    if semiconductor:
        dram = semiconductor.get("dram_bottleneck") or {}
        hbm = semiconductor.get("hbm_server_proxy") or {}
        demand = semiconductor.get("demand") or {}
        supply = semiconductor.get("supply") or {}
        company_confirmation = semiconductor.get("company_confirmation") or {}
        lines += [
            f"- DRAM 수급 핵심축: {_text(dram.get('state'))} · {_text(dram.get('reason'))}",
            f"- HBM·서버 DRAM 간접계측: {_text(hbm.get('state'))} · {_text(hbm.get('reason'))}",
            f"- 국내 기업 확인: {_text(company_confirmation.get('state'))} · {_text(company_confirmation.get('reason'))}",
            "",
        ]
        demand_metrics = demand.get("metrics") or {}
        if demand_metrics:
            labels = {
                "dram": "DRAM 칩 수출액", "mcp": "MCP 수출액",
                "dram_module": "DRAM 모듈 수출액", "dram_unit_value": "DRAM 신고중량당 수출액",
            }
            lines += ["#### 메모리 수출", "", "| 항목 | 최근값 | 주요 변화 | 관측일 |", "| --- | ---: | --- | --- |"]
            for key in ("dram", "mcp", "dram_module", "dram_unit_value"):
                if key in demand_metrics:
                    lines.append(_trend_row(labels[key], demand_metrics[key]))
            lines.append("")

        supply_metrics = supply.get("metrics") or {}
        if supply_metrics:
            lines += ["#### 한국 반도체 생산·출하·재고", "", "| 항목 | 최근값 | 주요 변화 | 관측일 |", "| --- | ---: | --- | --- |"]
            for key, label in (("production", "생산"), ("shipments", "출하"), ("inventory", "완제품 재고")):
                if key in supply_metrics:
                    lines.append(_trend_row(label, supply_metrics[key]))
            context = supply.get("context") or {}
            lines += [
                "",
                f"- 재고 역사적 백분위: {_percent(context.get('inventory_percentile'), 1)}",
                f"- 재고/출하 비율: {_number(context.get('inventory_shipments_ratio'), 2)} · 역사적 백분위 {_percent(context.get('inventory_shipments_ratio_percentile'), 1)}",
                f"- 재고/출하 비율 3개월 변화: {_percent(context.get('inventory_shipments_ratio_change_3m'), 1, signed=True)}",
                "",
            ]

        filing_companies = company_confirmation.get("companies") or []
        if filing_companies:
            lines += ["#### 국내 반도체 기업 공시", "", "| 기업 | 기준분기 | 매출 YoY | 영업이익률 | 전년 대비 | 재고 YoY | CAPEX YoY |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |"]
            for company in filing_companies:
                lines.append(
                    f"| {_text(company.get('name'))} | {_text(company.get('latest_period'))} "
                    f"| {_percent(company.get('revenue_yoy'), 1, signed=True)} "
                    f"| {_percent(company.get('operating_margin'), 1)} "
                    f"| {_number(company.get('operating_margin_change_yoy_pp'), 1, signed=True)}%p "
                    f"| {_percent(company.get('inventory_yoy'), 1, signed=True)} "
                    f"| {_percent(company.get('capex_yoy'), 1, signed=True)} |"
                )
            lines.append("")

    if power:
        demand_axis = power.get("demand_axis") or {}
        operations_axis = power.get("operations_axis") or {}
        supply_axis = power.get("supply_axis") or {}
        interconnection_axis = power.get("interconnection_axis") or {}
        transmission_axis = power.get("transmission_investment_axis") or {}
        regional_share = demand_axis.get("regional_expansion_share")
        regional_share_pct = float(regional_share) * 100 if regional_share is not None else None
        lines += [
            f"- 미국 전력 투자 근거: {_text(power.get('state'))} · {_text(power.get('reason'))}",
            "",
        ]
        if demand_axis or supply_axis:
            queue_metrics = interconnection_axis.get("metrics") or {}
            transmission_metrics = transmission_axis.get("metrics") or {}

            def axis_value(metrics: dict[str, Any], key: str) -> Any:
                return (metrics.get(key) or {}).get("value")

            transmission_additions = axis_value(
                transmission_metrics, "annual_additions_usd"
            )
            transmission_billions = (
                float(transmission_additions) / 1_000_000_000
                if transmission_additions is not None else None
            )

            lines += [
                "| 전력 투자 축 | 판정 | 핵심 정량값 | 기준일 |",
                "| --- | --- | --- | --- |",
                f"| 실제 수요 | {_text(demand_axis.get('state'))} "
                f"| 미국 84일 YoY {_percent(demand_axis.get('national_yoy_84d'), 1, signed=True)} · "
                f"AI 관찰지역 {_percent(demand_axis.get('ai_regions_yoy_84d'), 1, signed=True)} · "
                f"2% 이상 증가 지역 {_percent(regional_share_pct, 0)} "
                f"| {_text(demand_axis.get('observation_date'))} |",
                f"| 계통 운영 압력 프록시 | {_text(operations_axis.get('state'))} "
                f"| 실제-익일예측 {_percent(operations_axis.get('forecast_surprise_pct'), 1, signed=True)} · "
                f"순발전/수요 {_percent(operations_axis.get('generation_coverage_pct'), 1)} · "
                f"순유입 의존 {_percent(operations_axis.get('net_import_share_pct'), 1)} "
                f"| {_text(operations_axis.get('observation_date'))} |",
                f"| 발전·저장 건설 | {_text(supply_axis.get('state'))} "
                f"| 24개월 건설 중 {_number(supply_axis.get('committed_additions_24m_gw'), 1, signed=True)} GW · "
                f"예정 은퇴 {_number(supply_axis.get('retirements_24m_gw'), 1, signed=True)} GW · "
                f"순확충 {_number(supply_axis.get('net_additions_24m_gw'), 1, signed=True)} GW "
                f"({_percent(supply_axis.get('net_pipeline_ratio_24m_pct'), 1, signed=True)}) "
                f"| {_text(supply_axis.get('observation_date'))} |",
                f"| 발전 공급 접속 대기 | {_text(interconnection_axis.get('state'))} "
                f"| 활성 {_number(axis_value(queue_metrics, 'active_queue_gw'), 1)} GW · "
                f"연결계약 단계 {_percent(axis_value(queue_metrics, 'ia_executed_share_pct'), 1)} · "
                f"중앙 대기 {_number(axis_value(queue_metrics, 'median_active_age_years'), 1)}년 "
                f"| {_text(interconnection_axis.get('observation_date'))} |",
                f"| 송전 투자 실행 | {_text(transmission_axis.get('state'))} "
                f"| 연간 ${_number(transmission_billions, 1)}B · "
                f"동일 보고자 3년 CAGR {_percent(axis_value(transmission_metrics, 'like_for_like_three_year_cagr_pct'), 1, signed=True)} "
                f"| {_text(transmission_axis.get('observation_date'))} |",
                "",
                "전력 판정 제한: AI 관찰지역은 데이터센터 전용 부하가 아니며, LBNL 대기열은 발전·저장 공급측 접속 요청입니다. EIA 명목 MW는 송전 연결 가능량이나 확정 공급력을 뜻하지 않습니다. 지역간 순유입도 예비율 부족이나 데이터센터 연결 지연을 직접 뜻하지 않습니다.",
                "",
            ]
        metrics = power.get("metrics") or {}
        if metrics:
            labels = {
                "total_sales": "전체 전력판매", "commercial_sales": "상업용 전력판매",
                "industrial_sales": "산업용 전력판매", "generation": "발전량", "capacity": "발전설비용량",
            }
            lines += ["| 전력 항목 | 최근값 | 주요 변화 | 관측일 |", "| --- | ---: | --- | --- |"]
            for key in ("total_sales", "commercial_sales", "industrial_sales", "generation", "capacity"):
                if key in metrics:
                    lines.append(_trend_row(labels[key], metrics[key]))
            lines.append("")

    source_lines = []
    for label, section in (("메모리 공개가격", memory), ("반도체 수요·공급", semiconductor), ("미국 전력", power)):
        if section.get("source"):
            source_lines.append(f"- {label} 출처: {_source_link(section.get('source'), section.get('source_url'))}")
    if source_lines:
        lines += source_lines + [""]


def _append_quality_and_events(lines: list[str], current: dict[str, Any]) -> None:
    quality = current.get("data_quality") or {}
    stale = quality.get("stale") or []
    auxiliary_stale = quality.get("auxiliary_stale") or []
    unavailable = quality.get("unavailable") or []
    unhealthy = [
        (name, feed) for name, feed in (current.get("feed_health") or {}).items()
        if feed and feed.get("status") not in {"success", "cached"}
    ]
    lines += ["### 데이터 공백과 다음 확인 일정", ""]
    if stale:
        lines.append("- 오래된 핵심 지표: " + ", ".join(_text(item.get("name")) for item in stale))
    if auxiliary_stale:
        lines.append("- 오래된 보조 지표: " + ", ".join(_text(item.get("name")) for item in auxiliary_stale))
    if unavailable:
        lines.append("- 미수집 핵심 지표: " + ", ".join(_text(item) for item in unavailable))
    for name, feed in unhealthy:
        lines.append(
            f"- 수집 상태: {_text(name)} {_text(feed.get('status'))} · 마지막 성공 {_text(feed.get('last_success_at'))}"
            + (f" · {_text(feed.get('error'))}" if feed.get("error") else "")
        )
    limitations = []
    for section in (current.get("memory_cycle") or {}, current.get("semiconductor_cycle") or {}, current.get("power_cycle") or {}):
        if section.get("limitations") and section.get("limitations") not in limitations:
            limitations.append(section["limitations"])
    for limitation in limitations:
        lines.append(f"- 측정 한계: {_text(limitation)}")
    if not any((stale, auxiliary_stale, unavailable, unhealthy, limitations)):
        lines.append("- 현재 문서에 포함한 핵심 데이터에서 별도 공백이 확인되지 않았습니다.")
    events = current.get("upcoming_events") or []
    if events:
        lines += ["", "| 예정일 | 발표 | 영향 영역 | 출처 |", "| --- | --- | --- | --- |"]
        for event in events[:8]:
            lines.append(
                f"| {_text(event.get('scheduled_at') or event.get('scheduled_date'))} "
                f"| {_text(event.get('event_type'))} | {_text(', '.join(event.get('affected_domains') or []))} "
                f"| {_source_link(event.get('source'), event.get('source_url'))} |"
            )
    lines.append("")


def build_regime_quantitative_markdown(current: dict[str, Any]) -> str:
    """Render a bounded decision brief without full histories or raw rows."""

    lines: list[str] = []
    _append_regime_summary(lines, current)
    _append_macro_environment(lines, current)
    _append_financial_conditions(lines, current)
    _append_ai_thesis(lines, current)
    _append_quality_and_events(lines, current)
    return "\n".join(lines).rstrip() + "\n"
