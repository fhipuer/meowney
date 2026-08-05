from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.services.decision_prompt_service import (
    DecisionPromptError,
    PROMPT_TEMPLATE_VERSION,
    build_snapshot_markdown,
)


def asset(asset_id="a1", name="삼성전자", **overrides):
    data = {
        "id": asset_id,
        "name": name,
        "ticker": "005930.KS",
        "asset_type": "stock",
        "category_name": "국내주식",
        "currency": "KRW",
        "quantity": 10,
        "average_price": 60000,
        "current_price": 70000,
        "cost_basis_krw": 600000,
        "market_value": 700000,
        "profit_loss": 100000,
        "profit_rate": 16.6667,
        "price_status": "live",
        "price_as_of": "2026-08-05T01:00:00+00:00",
    }
    data.update(overrides)
    return data


def matcher(item, assets):
    if item.get("asset_id"):
        return next((a for a in assets if a["id"] == item["asset_id"]), None)
    if item.get("ticker"):
        return next((a for a in assets if a.get("ticker") == item["ticker"] or a["name"] == item["ticker"]), None)
    if item.get("alias"):
        alias = item["alias"].lower()
        return next((a for a in assets if alias in a["name"].lower() or a["name"].lower() in alias), None)
    return None


def summary(assets):
    total_value = sum(a["market_value"] for a in assets if a["market_value"] is not None)
    total_principal = sum(a["cost_basis_krw"] for a in assets)
    return SimpleNamespace(
        total_value=total_value,
        total_principal=total_principal,
        total_profit=total_value - total_principal,
        profit_rate=(total_value - total_principal) / total_principal * 100 if total_principal else 0,
    )


def render(groups, assets, allocations=None, **plan_overrides):
    plan = {"id": "p1", "name": "한글 플랜", "strategy_prompt": None, "groups": groups, "allocations": allocations or []}
    plan.update(plan_overrides)
    return build_snapshot_markdown(
        plan,
        {"base_currency": "KRW"},
        assets,
        summary(assets),
        matcher,
        datetime(2026, 8, 5, 12, tzinfo=timezone.utc),
    )


def test_renders_multiple_assets_and_snapshot_totals():
    assets = [asset(), asset("a2", "미국 ETF", ticker="QQQ", currency="USD", quantity=2, average_price=400, current_price=450, cost_basis_krw=1100000, market_value=1250000, profit_loss=150000, profit_rate=13.636)]
    markdown = render([{"name": "성장 자산", "target_percentage": 100, "items": [{"asset_id": "a1"}, {"asset_id": "a2"}]}], assets)
    assert "현재 총평가금액: 1,950,000원" in markdown
    assert "| 성장 자산 | 1,950,000원 | 100.00% | 100.00% | 0.00%p |" in markdown
    assert "### 미국 ETF" in markdown
    assert f"템플릿 버전: {PROMPT_TEMPLATE_VERSION}" in markdown


def test_keeps_empty_target_group_and_zero_value_plan():
    markdown = render([{"name": "미국 시장 베타", "target_percentage": 100, "items": []}], [])
    assert "## 미국 시장 베타" in markdown
    assert "보유 자산: 없음" in markdown
    assert "현재 총평가금액: 0원" in markdown


def test_cash_omits_price_fields():
    cash = asset("cash", "예수금", ticker=None, asset_type="cash", quantity=0, average_price=0, current_price=None, cost_basis_krw=500000, market_value=500000, profit_loss=0, profit_rate=0, price_status="manual", price_as_of=None)
    markdown = render([{"name": "현금", "target_percentage": 100, "items": [{"asset_id": "cash"}]}], [cash])
    cash_section = markdown.split("### 예수금", 1)[1]
    assert "보유 수량" not in cash_section
    assert "현재 가격" not in cash_section
    assert "평가금액: 500,000원" in cash_section


def test_missing_price_blocks_download_instead_of_turning_it_into_zero():
    broken = asset(current_price=None, market_value=None, profit_loss=None, profit_rate=None, price_status="unavailable", price_as_of=None)
    with pytest.raises(DecisionPromptError, match="현재 가격을 확인할 수 없는 자산"):
        render([{"name": "주식", "target_percentage": 100, "items": [{"asset_id": "a1"}]}], [broken])


def test_warns_for_invalid_target_total_unassigned_asset_and_stale_price():
    assets = [asset(price_status="stale"), asset("a2", "미분류 자산", market_value=300000, cost_basis_krw=300000, profit_loss=0, profit_rate=0)]
    markdown = render([{"name": "주식", "target_percentage": 80, "items": [{"asset_id": "a1"}]}], assets)
    assert "목표 비중 합계가 100%가 아닙니다: 80.00%" in markdown
    assert "플랜 목표에 연결되지 않은 보유 자산" in markdown
    assert "마지막 정상 시세를 사용한 자산" in markdown
    assert "| 플랜 미분류 자산 | 300,000원 | 30.00% | 0.00% | +30.00%p |" in markdown


def test_large_loss_and_rounding_are_formatted_without_validation_failure():
    losing = asset(cost_basis_krw=1000000, market_value=333333, profit_loss=-666667, profit_rate=-66.6667)
    markdown = render([{"name": "손실 그룹", "target_percentage": 100, "items": [{"asset_id": "a1"}]}], [losing])
    assert "평가손익: -666,667원" in markdown
    assert "수익률: -66.67%" in markdown
    assert "실제 비중: 100.00%" in markdown


def test_duplicate_asset_across_groups_is_fatal():
    groups = [
        {"name": "그룹 A", "target_percentage": 50, "items": [{"asset_id": "a1"}]},
        {"name": "그룹 B", "target_percentage": 50, "items": [{"ticker": "005930.KS"}]},
    ]
    with pytest.raises(DecisionPromptError, match="여러 목표 항목"):
        render(groups, [asset()])


def test_markdown_characters_and_strategy_prompt_are_preserved_safely():
    special = asset(name="ETF | AI [Top] #1")
    markdown = render(
        [{"name": "성장 | 핵심", "target_percentage": 100, "items": [{"asset_id": "a1"}]}],
        [special],
        strategy_prompt="변동성이 커지면 현금 비중을 검토해줘.",
    )
    assert "ETF \\| AI \\[Top\\] \\#1" in markdown
    assert "## 사용자 전략 메모" in markdown
    assert "변동성이 커지면" in markdown


def test_individual_allocation_asset_is_included_in_detail():
    markdown = render([], [asset()], allocations=[{"asset_id": "a1", "display_name": "직접 보유", "target_percentage": 100}])
    assert "## 개별 목표 배분 상세" in markdown
    assert "## 직접 보유" in markdown
    assert "### 삼성전자" in markdown
    assert "플랜 미분류 자산" not in markdown
