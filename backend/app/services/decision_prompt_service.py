"""현재 평가 결과와 버전된 지침을 결합한 AI 의사결정 문서를 생성한다."""
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

from app.services.asset_service import AssetService
from app.services.rebalance_service import RebalanceService


PROMPT_TEMPLATE_VERSION = "1.0.0"
PROMPT_TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "portfolio_decision_prompt.md"
WEIGHT_TOLERANCE = Decimal("0.01")


class DecisionPromptError(ValueError):
    """다운로드를 중단해야 하는 스냅샷 오류."""


def _decimal(value: Any) -> Decimal:
    return Decimal(str(value))


def _money(value: Any, currency: str = "KRW", *, signed: bool = False) -> str:
    amount = _decimal(value)
    sign = "+" if signed and amount > 0 else ""
    suffix = "원" if currency == "KRW" else f" {currency}"
    return f"{sign}{amount:,.0f}{suffix}"


def _percent(value: Any, *, points: bool = False, signed: bool = False) -> str:
    number = _decimal(value)
    sign = "+" if signed and number > 0 else ""
    return f"{sign}{number:.2f}{'%p' if points else '%'}"


def _text(value: Any) -> str:
    text = str(value).replace("\r", " ").replace("\n", " ")
    for char in ("\\", "|", "*", "_", "[", "]", "#", "<", ">"):
        text = text.replace(char, f"\\{char}")
    return text


def _timestamp(value: Any) -> str:
    if not value:
        return "가격 기준일시 미확인"
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.astimezone().isoformat(timespec="seconds")
    except (TypeError, ValueError):
        return str(value)


def build_snapshot_markdown(
    plan: dict[str, Any],
    portfolio: dict[str, Any],
    assets: list[dict[str, Any]],
    summary: Any,
    matcher,
    generated_at: datetime,
) -> str:
    """이미 평가된 자산으로 스냅샷을 만든다. 가격·손익은 재계산하지 않는다."""
    if not plan:
        raise DecisionPromptError("선택된 플랜을 찾을 수 없습니다.")
    unavailable = [a for a in assets if a.get("market_value") is None or a.get("price_status") == "unavailable"]
    if unavailable:
        names = ", ".join(str(a.get("name") or a.get("ticker") or a.get("id")) for a in unavailable)
        raise DecisionPromptError(f"현재 가격을 확인할 수 없는 자산이 있어 다운로드할 수 없습니다: {names}")

    total_value = _decimal(summary.total_value)
    base_currency = str(portfolio.get("base_currency") or "KRW").upper()
    if base_currency != "KRW":
        raise DecisionPromptError("현재 평가 엔진은 KRW 기준 합계만 지원하므로 KRW 외 기준 통화 문서를 만들 수 없습니다.")

    groups = sorted(plan.get("groups") or [], key=lambda g: g.get("display_order", 0))
    allocations = plan.get("allocations") or []
    owners: dict[str, list[str]] = defaultdict(list)
    group_rows = []
    for group in groups:
        matched = []
        for item in group.get("items") or []:
            asset = matcher(item, assets)
            if asset and asset["id"] not in {a["id"] for a in matched}:
                matched.append(asset)
                owners[str(asset["id"])].append(str(group["name"]))
        value = sum((_decimal(a["market_value"]) for a in matched), Decimal("0"))
        actual = value / total_value * 100 if total_value else Decimal("0")
        target = _decimal(group.get("target_percentage", 0))
        group_rows.append({"name": group["name"], "target": target, "value": value, "actual": actual, "assets": matched})

    target_total = sum((row["target"] for row in group_rows), Decimal("0")) + sum(
        (_decimal(a.get("target_percentage", 0)) for a in allocations), Decimal("0")
    )
    assigned_ids = set(owners)
    for alloc in allocations:
        asset = matcher(alloc, assets)
        if asset:
            label = alloc.get("display_name") or alloc.get("ticker") or alloc.get("alias") or "개별 배분"
            owners[str(asset["id"])].append(str(label))
            assigned_ids.add(str(asset["id"]))
    duplicate = {asset_id: names for asset_id, names in owners.items() if len(names) > 1}
    if duplicate:
        asset_by_id = {str(a["id"]): a for a in assets}
        details = "; ".join(f"{asset_by_id[asset_id]['name']} ({', '.join(names)})" for asset_id, names in duplicate.items())
        raise DecisionPromptError(f"동일 자산이 여러 목표 항목에 연결되어 있어 다운로드할 수 없습니다: {details}")
    unassigned = [a for a in assets if str(a["id"]) not in assigned_ids]
    warnings = []
    if abs(target_total - 100) > WEIGHT_TOLERANCE:
        warnings.append(f"목표 비중 합계가 100%가 아닙니다: {_percent(target_total)}")
    if unassigned:
        warnings.append("플랜 목표에 연결되지 않은 보유 자산이 있습니다: " + ", ".join(str(a["name"]) for a in unassigned))
    stale = [a for a in assets if a.get("price_status") == "stale"]
    if stale:
        warnings.append("마지막 정상 시세를 사용한 자산이 있습니다: " + ", ".join(str(a["name"]) for a in stale))

    price_times = [a.get("price_as_of") for a in assets if a.get("price_as_of")]
    lines = [
        "# 실행 시점 포트폴리오 스냅샷", "",
        f"- 문서 생성 일시: {generated_at.astimezone().isoformat(timespec='seconds')}",
        f"- 포트폴리오 가격 기준일시: {_timestamp(min(price_times) if price_times else None)}",
        f"- 선택된 플랜 이름: {_text(plan['name'])}",
        f"- 기준 통화: {base_currency}",
        f"- 현재 총평가금액: {_money(summary.total_value, base_currency)}",
        f"- 총매입금액: {_money(summary.total_principal, base_currency)}",
        f"- 총평가손익: {_money(summary.total_profit, base_currency, signed=True)}",
        f"- 총수익률: {_percent(summary.profit_rate, signed=True)}",
        f"- 의사결정 프롬프트 템플릿 버전: {PROMPT_TEMPLATE_VERSION}", "",
    ]
    if warnings:
        lines += ["## 데이터 경고", ""] + [f"> ⚠️ {warning}" for warning in warnings] + [""]
    strategy_prompt = str(plan.get("strategy_prompt") or "")
    if strategy_prompt.strip():
        lines += ["## 플랜 전략 프롬프트", "", strategy_prompt, ""]
    else:
        lines += [PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8").strip(), ""]

    lines += ["## 현재 포트폴리오와 목표 포트폴리오 비교", "", "| 자산군 | 실제 평가금액 | 실제 비중 | 목표 비중 | 차이 |", "| --- | ---: | ---: | ---: | ---: |"]
    table_value = Decimal("0")
    table_actual = Decimal("0")
    for row in group_rows:
        lines.append(f"| {_text(row['name'])} | {_money(row['value'], base_currency)} | {_percent(row['actual'])} | {_percent(row['target'])} | {_percent(row['actual'] - row['target'], points=True, signed=True)} |")
        table_value += row["value"]
        table_actual += row["actual"]
    for alloc in allocations:
        asset = matcher(alloc, assets)
        value = _decimal(asset["market_value"]) if asset else Decimal("0")
        actual = value / total_value * 100 if total_value else Decimal("0")
        target = _decimal(alloc.get("target_percentage", 0))
        name = alloc.get("display_name") or (asset.get("name") if asset else None) or alloc.get("ticker") or alloc.get("alias") or "미확인 자산"
        lines.append(f"| {_text(name)} | {_money(value, base_currency)} | {_percent(actual)} | {_percent(target)} | {_percent(actual - target, points=True, signed=True)} |")
        table_value += value
        table_actual += actual
    unassigned_value = sum((_decimal(a["market_value"]) for a in unassigned), Decimal("0"))
    unassigned_pct = unassigned_value / total_value * 100 if total_value else Decimal("0")
    if unassigned:
        lines.append(f"| 플랜 미분류 자산 | {_money(unassigned_value, base_currency)} | {_percent(unassigned_pct)} | 0.00% | {_percent(unassigned_pct, points=True, signed=True)} |")
        table_value += unassigned_value
        table_actual += unassigned_pct
    lines.append(f"| **합계** | **{_money(table_value, base_currency)}** | **{_percent(table_actual)}** | **{_percent(target_total)}** | |")
    lines.append("")

    def add_asset(asset: dict[str, Any], group_name: str) -> None:
        lines.extend([f"### {_text(asset['name'])}", ""])
        fields = [("종목코드", asset.get("ticker")), ("자산 유형", asset.get("asset_type")), ("표시 통화", asset.get("currency"))]
        for label, value in fields:
            if value:
                lines.append(f"- {label}: {_text(value)}")
        if asset.get("ticker"):
            lines.extend([
                f"- 보유 수량: {_decimal(asset['quantity']):,.4f}".rstrip("0").rstrip("."),
                f"- 평균 구매가격: {_money(asset['average_price'], str(asset.get('currency') or base_currency))}",
                f"- 현재 가격: {_money(asset['current_price'], str(asset.get('currency') or base_currency)) if asset.get('current_price') is not None else '현재 가격 미확인'}",
            ])
        cost = asset.get("cost_basis_krw")
        lines.extend([
            f"- 매입금액: {_money(cost, base_currency) if cost is not None else '미확인'}",
            f"- 평가금액: {_money(asset['market_value'], base_currency)}",
            f"- 평가손익: {_money(asset['profit_loss'], base_currency, signed=True) if asset.get('profit_loss') is not None else '미확인'}",
            f"- 수익률: {_percent(asset['profit_rate'], signed=True) if asset.get('profit_rate') is not None else '미확인'}",
            f"- 전체 포트폴리오 비중: {_percent(_decimal(asset['market_value']) / total_value * 100 if total_value else 0)}",
            f"- 소속 그룹: {_text(group_name)}", "",
        ])

    lines += ["## 그룹별 상세", ""]
    for row in group_rows:
        lines += [f"## {_text(row['name'])}", "", f"- 현재 평가금액: {_money(row['value'], base_currency)}", f"- 현재 실제 비중: {_percent(row['actual'])}", f"- 목표 비중: {_percent(row['target'])}", f"- 목표 대비 차이: {_percent(row['actual'] - row['target'], points=True, signed=True)}", f"- 보유 자산 수: {len(row['assets'])}", ""]
        if not row["assets"]:
            lines += ["- 보유 자산: 없음", ""]
        for asset in row["assets"]:
            add_asset(asset, str(row["name"]))
    if allocations:
        lines += ["## 개별 목표 배분 상세", ""]
        for alloc in allocations:
            matched = matcher(alloc, assets)
            name = alloc.get("display_name") or (matched.get("name") if matched else None) or alloc.get("ticker") or alloc.get("alias") or "미확인 자산"
            lines += [f"## {_text(name)}", "", f"- 목표 비중: {_percent(alloc.get('target_percentage', 0))}", ""]
            if matched:
                add_asset(matched, "개별 목표 배분")
            else:
                lines += ["- 실제 보유 자산: 없음", ""]
    if unassigned:
        lines += ["## 플랜 미분류 자산", "", "아래 자산은 선택된 플랜의 그룹 또는 개별 목표에 연결되지 않았습니다.", ""]
        for asset in unassigned:
            add_asset(asset, "플랜 미분류")
    return "\n".join(lines).strip() + "\n"


class DecisionPromptService:
    def __init__(self) -> None:
        self.rebalance = RebalanceService()

    async def export_markdown(self, plan_id: UUID) -> tuple[str, str]:
        plan = await self.rebalance.get_plan(plan_id)
        if not plan:
            raise DecisionPromptError("선택된 플랜을 찾을 수 없습니다.")
        portfolio_id = UUID(str(plan["portfolio_id"]))
        asset_service = AssetService(self.rebalance.supabase)
        assets = await asset_service.get_assets(portfolio_id=portfolio_id)
        enriched = await self.rebalance.finance_service.enrich_assets_with_prices(assets)
        exchange_rate = await self.rebalance.finance_service.get_exchange_rate()
        summary = await asset_service.calculate_summary(enriched, portfolio_id, Decimal(str(exchange_rate)))
        result = self.rebalance.supabase.table("portfolios").select("name,base_currency").eq("id", str(portfolio_id)).limit(1).execute()
        portfolio = result.data[0] if result.data else {"base_currency": "KRW"}
        now = datetime.now().astimezone()
        snapshot = build_snapshot_markdown(plan, portfolio, enriched, summary, self.rebalance.match_item_to_asset, now)
        markdown = snapshot
        safe_name = "".join(c if c.isalnum() or c in "-_" else "-" for c in str(plan["name"])).strip("-") or "plan"
        return markdown, f"portfolio-decision-prompt_{safe_name}_{now:%Y-%m-%d}.md"
