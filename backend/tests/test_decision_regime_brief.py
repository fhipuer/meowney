from app.services.decision_regime_brief import (
    DECISION_BRIEF_SCHEMA_VERSION,
    build_regime_quantitative_markdown,
)


def trend(latest, *, yoy=None, yoy_3m_avg=None, mom=None, sequential_3m=None, unit="지수"):
    return {
        "latest": latest,
        "observation_date": "2026-07-01",
        "yoy": yoy,
        "yoy_3m_avg": yoy_3m_avg,
        "mom": mom,
        "sequential_3m": sequential_3m,
        "unit": unit,
        "history": [{"date": "2025-01-01", "value": 999999, "yoy": None}],
    }


def current_fixture():
    return {
        "evaluated_at": "2026-08-19T00:00:00+00:00",
        "automatic_regime": "유지",
        "candidate_regime": "경계",
        "rule_version": "rules-v3",
        "review_urgency": "watch",
        "review_reasons": ["장기금리 경보 확인"],
        "previous_snapshot": {"created_at": "2026-08-01T00:00:00+00:00"},
        "changes_since_snapshot": ["금리·실질금리: 중립 → 둔화"],
        "thesis_changes_since_snapshot": ["DRAM 수급 핵심축: 관찰 → 타이트"],
        "domains": [
            {"name": "성장·고용", "state": "중립", "reasons": []},
            {"name": "금리·실질금리", "state": "둔화", "reasons": ["30년물 부담"]},
        ],
        "triggers": [
            {
                "severity": "high",
                "domain": "rates",
                "summary": "30Y 실질금리 3.06% · 20관측일 +0.15%p",
                "rule_version": "rules-v3",
            }
        ],
        "data_quality": {
            "status": "제한",
            "overall_coverage": 0.92,
            "observation_range": {"from": "2026-04-01", "to": "2026-08-18"},
            "last_fetched_at": "2026-08-19T00:10:00+00:00",
            "stale": [{"name": "미국 GDP"}],
            "auxiliary_stale": [],
            "unavailable": ["시장 PER"],
        },
        "signals": [
            {
                "id": "market_gold",
                "name": "금 선물",
                "value": 3450.5,
                "unit": "달러/온스",
                "display_metrics": [{"label": "1개월", "value": 2.5, "unit": "%", "kind": "return"}],
                "status": "강함",
                "reason": "1개월 +2.5%",
                "observation_date": "2026-08-18",
                "source": "yfinance",
                "history": [{"date": "2025-01-01", "value": 999999}],
            },
            {
                "id": "core_cpi",
                "name": "미국 Core CPI",
                "value": 329.1,
                "unit": "지수",
                "display_metrics": [
                    {"label": "전년 대비", "value": 3.2, "unit": "%", "kind": "rate"},
                    {"label": "3개월 연율", "value": 2.6, "unit": "%", "kind": "rate"},
                ],
                "status": "중립",
                "reason": "3개월 연율 2.6%",
                "observation_date": "2026-07-01",
                "source": "fred",
            },
            {
                "id": "us30y",
                "name": "미국 국채 30Y",
                "value": 5.31,
                "unit": "%",
                "display_metrics": [{"label": "1개월", "value": 12, "unit": "bp", "kind": "delta"}],
                "status": "둔화",
                "reason": "3개월 +0.30%p",
                "observation_date": "2026-08-18",
                "source": "treasury",
            },
            {
                "id": "hy_oas",
                "name": "미국 HY OAS",
                "value": 2.71,
                "unit": "%p",
                "display_metrics": [],
                "status": "중립",
                "reason": "현재 2.71%p",
                "observation_date": "2026-08-18",
                "source": "fred",
            },
        ],
        "macro_quadrant": {
            "as_of_date": "2026-08-08",
            "environment_label": "완만한 확장·물가 부담 높음",
            "growth_level": {"label": "완만한 확장", "coverage": 1},
            "inflation_level": {"label": "물가 부담 높음", "coverage": 1},
            "pressure_vector": {"direction": "물가 둔화 쪽", "strength": "중간"},
            "financial_conditions": {
                "policy": {"label": "단기금리가 수요를 약하게 억제", "fed_funds": 3.63, "core_pce_yoy": 3.29, "real_policy_rate": 0.34},
                "long_rates": {"label": "투자·차입에 뚜렷한 부담", "nominal_10y": 4.72, "real_10y": 2.44, "breakeven_10y": 2.28, "term_premium": 0.83},
                "recent_shock": {
                    "label": "최근 금리 상승 충격 발생",
                    "change_20d": {"start_date": "2026-07-20", "end_date": "2026-08-18", "changes": {"us10y": 0.12, "tips10y": 0.09, "bei10y": 0.03}},
                    "change_63d": None,
                },
                "duration_stress": {"label": "30년물 장기금리 부담 경계", "nominal_30y": 5.31, "real_30y": 3.06, "spread_30y10y": 0.59, "confirmation_count_5d": 3, "driver": "30Y 실질금리 주도"},
                "yield_curve": {"label": "과거 역전 영향 관찰 중", "state": "역전 후 관찰", "monthly_average_10y3m": 0.79, "monthly_average_10y2y": 0.42, "recession_probability_12m": 15.1},
                "credit": {"label": "회사채 금융여건 양호", "hy_oas": 2.71, "ig_oas": 0.79, "nfci": -0.55},
            },
        },
        "ai_capex": {
            "state": "확대 지속",
            "reason": "4개사 모두 증가",
            "coverage": 1,
            "companies": [
                {"name": "Microsoft", "latest_period": "2026-Q2", "latest_capex": 25_000_000_000, "yoy": 45.2, "ttm": 82_000_000_000, "history": [{"period": "old", "value": 999999}], "fetch_status": {"status": "success"}}
            ],
        },
        "memory_cycle": {
            "state": "가격 상승",
            "reason": "DDR5 계약가격 상승",
            "nand_state": "NAND 관찰가격 상승",
            "nand_reason": "wafer spot 상승",
            "source": "TrendForce 공개 가격표",
            "source_url": "https://example.com/memory",
            "limitations": "직접 HBM 계약가격 아님",
            "series": [
                {"product_name": "DDR5 Contract", "market_type": "contract", "price_average": 6.25, "change_percent": 2.7, "observation_date": "2026-08-01", "history": [{"price_average": 999999}]}
            ],
        },
        "semiconductor_cycle": {
            "dram_bottleneck": {"state": "타이트 지속", "reason": "가격과 수출 동반 강세"},
            "hbm_server_proxy": {"state": "타이트 지속 신호", "reason": "RDIMM 가격과 수출 확인"},
            "demand": {
                "metrics": {
                    "dram": trend(8_000_000_000, yoy=420, yoy_3m_avg=380, mom=5, sequential_3m=22, unit="USD"),
                    "mcp": trend(2_000_000_000, yoy_3m_avg=55, unit="USD"),
                    "dram_module": trend(500_000_000, yoy_3m_avg=30, unit="USD"),
                    "dram_unit_value": trend(1200, yoy_3m_avg=40, unit="USD/kg"),
                }
            },
            "supply": {
                "metrics": {
                    "production": trend(150, yoy=20),
                    "shipments": trend(140, yoy=18),
                    "inventory": trend(92, yoy=9.8),
                },
                "context": {"inventory_percentile": 19, "inventory_shipments_ratio": 0.66, "inventory_shipments_ratio_percentile": 12, "inventory_shipments_ratio_change_3m": -4.2},
            },
            "company_confirmation": {
                "state": "확장 확인",
                "reason": "두 회사 매출 증가",
                "companies": [
                    {"name": "SK하이닉스", "latest_period": "2026-Q2", "revenue_yoy": 35, "operating_margin": 42, "operating_margin_change_yoy_pp": 7, "inventory_yoy": -5, "capex_yoy": 20, "histories": {"revenue": [{"value": 999999}]}}
                ],
            },
            "limitations": "직접 HBM 계약가격 없음",
        },
        "power_cycle": {
            "state": "수요 증가",
            "reason": "상업용 판매 증가",
            "source": "EIA",
            "source_url": "https://example.com/eia",
            "limitations": "전력망 연결 대기 직접 측정 아님",
            "metrics": {"commercial_sales": trend(120, yoy=7.5, unit="TWh")},
        },
        "feed_health": {
            "macro": {"status": "partial", "last_success_at": "2026-08-18T00:00:00Z", "error": "WTI unavailable"},
            "memory": {"status": "success"},
        },
        "upcoming_events": [
            {"scheduled_at": "2026-08-26T21:30:00+09:00", "event_type": "미국 GDP", "affected_domains": ["성장·고용"], "source": "BEA", "source_url": "https://example.com/bea"}
        ],
    }


def test_quantitative_brief_contains_decision_data_and_provenance_without_histories():
    markdown = build_regime_quantitative_markdown(current_fixture())

    assert f"정량 데이터 스키마: {DECISION_BRIEF_SCHEMA_VERSION}" in markdown
    assert "점검 필요도: 관찰 유지" in markdown
    assert "확정 자동 레짐: 유지" in markdown
    assert "최신 데이터 후보 레짐: 경계" in markdown
    assert "미국 Core CPI" in markdown
    assert "전년 대비 3.20%" in markdown
    assert "미국 국채 30Y" in markdown
    assert "30Y TIPS 3.06%" in markdown
    assert "Microsoft" in markdown and "$25.0B" in markdown
    assert "DRAM 칩 수출액" in markdown and "+420.0%" in markdown
    assert "SK하이닉스" in markdown and "+35.0%" in markdown
    assert "상업용 전력판매" in markdown
    assert "관측일" in markdown and "출처" in markdown
    assert "WTI unavailable" in markdown
    assert "999,999" not in markdown
    assert len(markdown) < 50_000


def test_quantitative_brief_handles_sparse_optional_sections():
    markdown = build_regime_quantitative_markdown(
        {
            "evaluated_at": "2026-08-19T00:00:00Z",
            "automatic_regime": "유지",
            "candidate_regime": "유지",
            "review_urgency": "not_needed",
            "data_quality": {"status": "충분", "overall_coverage": 1, "observation_range": {}},
            "domains": [],
            "signals": [],
            "macro_quadrant": {},
            "ai_capex": {},
            "memory_cycle": {},
            "semiconductor_cycle": {},
            "power_cycle": {},
            "feed_health": {},
            "upcoming_events": [],
        }
    )

    assert "점검 필요도: 신규 상세점검 사유 없음" in markdown
    assert "현재 문서에 포함한 핵심 데이터에서 별도 공백이 확인되지 않았습니다." in markdown
