"""
대시보드 API 냥~ 🐱
"""
import asyncio
from uuid import UUID
from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Query
from typing import Optional

from app.api.deps import SupabaseDep
from app.models.schemas import (
    DashboardSummary,
    AssetHistoryResponse,
    ExchangeRateResponse,
    RebalanceAlertsResponse,
    RebalanceAlert,
    GoalProgressResponse,
    ManualHistoryCreate,
    ManualHistoryResponse,
)
from app.services.asset_service import AssetService
from app.services.finance_service import FinanceService

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
):
    """
    대시보드 요약 정보 조회 냥~ 🐱
    - 총 자산가치, 수익률 (USD 자산은 원화 환산)
    - 카테고리별 배분 비율
    - 메인 플랜 정보 포함
    """
    from app.services.rebalance_service import RebalanceService

    asset_service = AssetService(db)
    finance_service = FinanceService()
    rebalance_service = RebalanceService()

    # 자산 목록 조회
    assets = await asset_service.get_assets(portfolio_id)

    # 현재가 조회 및 계산
    enriched_assets = await finance_service.enrich_assets_with_prices(assets)

    # 현재 환율 조회 (USD 자산 원화 환산용)
    exchange_rate = await finance_service.get_exchange_rate()
    print(f"[DEBUG] exchange_rate: {exchange_rate}")

    # 요약 정보 계산 (환율 전달)
    summary = await asset_service.calculate_summary(
        enriched_assets, portfolio_id, Decimal(str(exchange_rate))
    )
    print(f"[DEBUG] summary.total_value: {summary.total_value}")

    # 메인 플랜 정보 추가 냥~
    main_plan = await rebalance_service.get_main_plan(portfolio_id)
    if main_plan:
        summary.main_plan_id = UUID(main_plan["id"])
        summary.main_plan_name = main_plan["name"]

    return summary


@router.get("/history", response_model=list[AssetHistoryResponse])
async def get_asset_history(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
    period: Optional[str] = Query(None, description="기간 (1W, 1M, 3M, 6M, 1Y)"),
    start_date: Optional[date] = Query(None, description="시작일"),
    end_date: Optional[date] = Query(None, description="종료일"),
    limit: int = Query(365, ge=1, le=365, description="조회 개수"),
):
    """
    자산 히스토리 조회 냥~ 🐱
    일별 자산 추이 데이터

    - period 파라미터로 기간 지정 가능 (1W, 1M, 3M, 6M, 1Y)
    - 또는 start_date/end_date로 직접 지정
    """
    asset_service = AssetService(db)

    # 기간 매핑 (일 수)
    period_days = {
        "1W": 7,
        "1M": 30,
        "3M": 90,
        "6M": 180,
        "1Y": 365,
    }

    # 기본값: 최근 1개월
    if not end_date:
        end_date = date.today()

    if period and period in period_days:
        start_date = end_date - timedelta(days=period_days[period])
    elif not start_date:
        start_date = end_date - timedelta(days=30)  # 기본 1개월

    history = await asset_service.get_asset_history(
        portfolio_id, start_date, end_date, limit
    )

    return [AssetHistoryResponse(**h) for h in history]


@router.get("/exchange-rate", response_model=ExchangeRateResponse)
async def get_current_exchange_rate():
    """
    현재 USD/KRW 환율 조회 냥~ 🐱
    """
    finance_service = FinanceService()
    rate = await finance_service.get_exchange_rate()

    return ExchangeRateResponse(
        rate=Decimal(str(rate)),
        from_currency="USD",
        to_currency="KRW",
        timestamp=datetime.now()
    )


@router.get("/rebalance-alerts", response_model=RebalanceAlertsResponse)
async def get_rebalance_alerts(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
    threshold: float = Query(5.0, ge=0, le=100, description="이탈도 임계값 (%)"),
):
    """
    리밸런싱 알림 조회 냥~ 🐱

    메인 플랜 기반 목표 비율 대비 {threshold}% 이상 이탈 반환
    메인 플랜이 없으면 레거시 카테고리 기반 폴백
    """
    from app.services.rebalance_service import RebalanceService

    rebalance_service = RebalanceService()

    # 메인 플랜 조회
    main_plan = await rebalance_service.get_main_plan(portfolio_id)

    if main_plan:
        # 메인 플랜 기반 리밸런싱 알림
        return await _get_main_plan_alerts(main_plan, portfolio_id, threshold, rebalance_service)
    else:
        # 레거시 카테고리 기반 폴백
        return await _get_legacy_alerts(db, portfolio_id, threshold)


async def _get_main_plan_alerts(
    main_plan: dict,
    portfolio_id: Optional[UUID],
    threshold: float,
    rebalance_service,
) -> RebalanceAlertsResponse:
    """메인 플랜 기반 리밸런싱 알림 냥~"""
    # 리밸런싱 계산
    result = await rebalance_service.calculate_rebalance_by_plan(
        UUID(main_plan["id"]), portfolio_id
    )

    alerts = []

    # 개별 배분 알림
    for suggestion in result.get("suggestions", []):
        deviation = abs(suggestion["target_percentage"] - suggestion["current_percentage"])
        if deviation >= threshold:
            alerts.append(RebalanceAlert(
                category_name=suggestion["asset_name"],
                current_percentage=round(suggestion["current_percentage"], 2),
                target_percentage=round(suggestion["target_percentage"], 2),
                deviation=round(deviation, 2),
                direction="over" if suggestion["current_percentage"] > suggestion["target_percentage"] else "under",
            ))

    # 그룹 배분 알림
    for group_sugg in result.get("group_suggestions", []):
        deviation = abs(group_sugg["target_percentage"] - group_sugg["current_percentage"])
        if deviation >= threshold:
            alerts.append(RebalanceAlert(
                category_name=f"{group_sugg['group_name']}",
                current_percentage=round(group_sugg["current_percentage"], 2),
                target_percentage=round(group_sugg["target_percentage"], 2),
                deviation=round(deviation, 2),
                direction="over" if group_sugg["current_percentage"] > group_sugg["target_percentage"] else "under",
            ))

    # 이탈도가 큰 순으로 정렬
    alerts.sort(key=lambda x: x.deviation, reverse=True)

    return RebalanceAlertsResponse(
        alerts=alerts,
        threshold=threshold,
        needs_rebalancing=len(alerts) > 0,
    )


async def _get_legacy_alerts(
    db,
    portfolio_id: Optional[UUID],
    threshold: float,
) -> RebalanceAlertsResponse:
    """레거시 카테고리 기반 알림 (폴백) 냥~"""
    asset_service = AssetService(db)
    finance_service = FinanceService()

    # 현재 자산 조회
    assets = await asset_service.get_assets(portfolio_id)
    enriched_assets = await finance_service.enrich_assets_with_prices(assets)

    # 현재 환율 조회
    exchange_rate = await finance_service.get_exchange_rate()

    # 요약 정보 계산 (현재 배분 포함)
    summary = await asset_service.calculate_summary(
        enriched_assets, portfolio_id, Decimal(str(exchange_rate))
    )

    # 목표 배분 조회
    target_allocations = await asset_service.get_target_allocations(portfolio_id)

    alerts = []
    for allocation in summary.allocations:
        category_name = allocation.category_name
        current_pct = allocation.percentage

        # 해당 카테고리의 목표 비율 찾기
        target_pct = 0.0
        for target in target_allocations:
            if target.get("category_name") == category_name:
                target_pct = float(target.get("target_percentage", 0))
                break

        # 이탈도 계산
        deviation = current_pct - target_pct

        if abs(deviation) >= threshold:
            alerts.append(RebalanceAlert(
                category_name=category_name,
                current_percentage=round(current_pct, 2),
                target_percentage=round(target_pct, 2),
                deviation=round(abs(deviation), 2),
                direction="over" if deviation > 0 else "under",
            ))

    # 이탈도가 큰 순으로 정렬
    alerts.sort(key=lambda x: x.deviation, reverse=True)

    return RebalanceAlertsResponse(
        alerts=alerts,
        threshold=threshold,
        needs_rebalancing=len(alerts) > 0,
    )


@router.get("/goal-progress", response_model=GoalProgressResponse)
async def get_goal_progress(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
):
    """
    목표 진행률 조회 냥~ 🐱
    """
    asset_service = AssetService(db)
    finance_service = FinanceService()

    # 포트폴리오 목표 금액 조회
    portfolio = await asset_service.get_portfolio(portfolio_id)
    target_value = Decimal(str(portfolio.get("target_value", 0) or 0))

    # 현재 자산 가치 조회
    assets = await asset_service.get_assets(portfolio_id)
    enriched_assets = await finance_service.enrich_assets_with_prices(assets)

    # 현재 환율 조회
    exchange_rate = await finance_service.get_exchange_rate()

    summary = await asset_service.calculate_summary(
        enriched_assets, portfolio_id, Decimal(str(exchange_rate))
    )

    current_value = summary.total_value
    remaining = target_value - current_value if target_value > 0 else Decimal("0")
    progress = float((current_value / target_value) * 100) if target_value > 0 else 0.0

    return GoalProgressResponse(
        target_value=target_value,
        current_value=current_value,
        progress_percentage=round(progress, 2),
        remaining_amount=max(remaining, Decimal("0")),
        is_achieved=current_value >= target_value if target_value > 0 else False,
    )


@router.get("/ticker-history/{ticker}")
async def get_ticker_history(
    ticker: str,
    days: int = Query(30, ge=7, le=90, description="조회 일수 (7~90일)"),
):
    """
    티커 히스토리 조회 (Sparkline용) 냥~ 🐱

    최근 N일간의 종가 데이터와 변화율 반환
    """
    finance_service = FinanceService()
    result = await finance_service.get_ticker_history(ticker, days)

    return result


@router.get("/market-indicators")
async def get_market_indicators():
    """
    주요 시장 지표 조회 냥~ 🐱

    - KOSPI, S&P 500, NASDAQ
    - VIX (공포지수)
    - USD/KRW 환율
    - 금/은 현물 가격비
    - 주요 지수 PER (S&P 500, NASDAQ, KOSPI)
    """
    finance_service = FinanceService()

    # 주요 지표 목록
    indicators_meta = [
        {"ticker": "^KS11", "name": "KOSPI", "currency": "KRW"},
        {"ticker": "^GSPC", "name": "S&P 500", "currency": "USD"},
        {"ticker": "^IXIC", "name": "NASDAQ", "currency": "USD"},
        {"ticker": "^VIX", "name": "VIX", "currency": ""},
    ]

    # 지수 가격, 금/은 비율, PER 병렬 조회
    indicator_tasks = [
        finance_service.get_ticker_history(m["ticker"], 2) for m in indicators_meta
    ]
    exchange_task = finance_service.get_exchange_rate()
    gold_silver_task = finance_service.get_gold_silver_ratio()
    per_task = finance_service.get_index_per()

    (
        *indicator_results,
        exchange_rate,
        gold_silver,
        per_data,
    ) = await asyncio.gather(
        *indicator_tasks,
        exchange_task,
        gold_silver_task,
        per_task,
        return_exceptions=True,
    )

    results = []

    for meta, data in zip(indicators_meta, indicator_results):
        try:
            if isinstance(data, Exception):
                continue
            if data and data.get("data") and len(data["data"]) >= 1:
                latest = data["data"][-1]
                results.append({
                    "ticker": meta["ticker"],
                    "name": meta["name"],
                    "price": latest["close"],
                    "change_rate": data.get("change_rate", 0),
                    "currency": meta["currency"],
                })
        except Exception:
            pass

    # 환율 추가
    try:
        if not isinstance(exchange_rate, Exception):
            results.append({
                "ticker": "USDKRW=X",
                "name": "USD/KRW",
                "price": exchange_rate,
                "change_rate": 0,
                "currency": "KRW",
            })
    except Exception:
        pass

    # 금/은 비율
    gold_silver_result = None
    if not isinstance(gold_silver, Exception) and gold_silver.get("valid"):
        gold_silver_result = {
            "gold_price": gold_silver["gold_price"],
            "silver_price": gold_silver["silver_price"],
            "ratio": gold_silver["ratio"],
        }

    # PER 데이터
    per_result = None
    if not isinstance(per_data, Exception):
        per_result = per_data

    return {
        "indicators": results,
        "gold_silver_ratio": gold_silver_result,
        "index_per": per_result,
        "timestamp": datetime.now().isoformat(),
    }


@router.post("/asset-history/manual")
async def create_manual_history(
    db: SupabaseDep,
    request: ManualHistoryCreate,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
):
    """
    과거 데이터 수동 입력 냥~ 📝

    여러 날짜의 총자산/투자원금 데이터를 한 번에 입력
    기존 데이터가 있으면 덮어쓰기
    """
    asset_service = AssetService(db)

    # 포트폴리오 ID 확인
    if not portfolio_id:
        portfolios = await asset_service.get_all_portfolio_ids()
        portfolio_id = portfolios[0] if portfolios else None

    if not portfolio_id:
        return {"success": False, "message": "포트폴리오가 없다옹! 🙀"}

    created_entries = []

    for entry in request.entries:
        total_profit = entry.total_value - entry.total_principal
        profit_rate = float((total_profit / entry.total_principal) * 100) if entry.total_principal > 0 else 0.0

        # upsert로 저장 (기존 데이터 덮어쓰기)
        result = db.table("asset_history").upsert(
            {
                "portfolio_id": str(portfolio_id),
                "snapshot_date": entry.snapshot_date.isoformat(),
                "total_value": float(entry.total_value),
                "total_principal": float(entry.total_principal),
                "total_profit": float(total_profit),
                "profit_rate": profit_rate,
                "category_breakdown": None,  # 수동 입력은 카테고리 없음
            },
            on_conflict="portfolio_id,snapshot_date"
        ).execute()

        if result.data:
            created_entries.append(result.data[0])

    return {
        "success": True,
        "message": f"냥~ {len(created_entries)}개의 데이터가 저장되었다옹! 🐱",
        "entries": created_entries
    }


@router.get("/asset-history/manual", response_model=list[ManualHistoryResponse])
async def get_manual_history(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
):
    """
    수동 입력된 과거 데이터 조회 냥~ 📋
    """
    asset_service = AssetService(db)

    # 포트폴리오 ID 확인
    if not portfolio_id:
        portfolios = await asset_service.get_all_portfolio_ids()
        portfolio_id = portfolios[0] if portfolios else None

    if not portfolio_id:
        return []

    result = db.table("asset_history").select("*").eq(
        "portfolio_id", str(portfolio_id)
    ).order("snapshot_date", desc=True).execute()

    return [
        ManualHistoryResponse(
            id=row["id"],
            portfolio_id=row["portfolio_id"],
            snapshot_date=row["snapshot_date"],
            total_value=Decimal(str(row["total_value"])),
            total_principal=Decimal(str(row["total_principal"])),
            total_profit=Decimal(str(row["total_profit"])),
            profit_rate=row.get("profit_rate"),
            is_manual=row.get("category_breakdown") is None,  # 카테고리 없으면 수동 입력
            created_at=row["created_at"]
        )
        for row in (result.data or [])
    ]


@router.delete("/asset-history/{history_id}")
async def delete_asset_history(
    db: SupabaseDep,
    history_id: UUID,
):
    """
    자산 히스토리 삭제 냥~ 🗑️
    """
    result = db.table("asset_history").delete().eq("id", str(history_id)).execute()

    if result.data:
        return {"success": True, "message": "냥~ 삭제 완료다옹! 🐱"}
    else:
        return {"success": False, "message": "삭제할 데이터가 없다옹! 🙀"}
