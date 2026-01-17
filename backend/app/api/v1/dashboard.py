"""
대시보드 API 냥~ 🐱
"""
from uuid import UUID
from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Query
from typing import Optional

from app.api.deps import SupabaseDep
from app.models.schemas import (
    DashboardSummary,
    AssetHistoryResponse,
    RebalanceTarget,
    RebalanceResponse,
    ExchangeRateResponse,
    BenchmarkResponse,
    PerformanceMetrics,
    PeriodReturn,
    RebalanceAlertsResponse,
    RebalanceAlert,
    GoalProgressResponse,
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
    - 총 자산가치, 수익률
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

    # 요약 정보 계산
    summary = await asset_service.calculate_summary(enriched_assets, portfolio_id)

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
    start_date: Optional[date] = Query(None, description="시작일"),
    end_date: Optional[date] = Query(None, description="종료일"),
    limit: int = Query(30, ge=1, le=365, description="조회 개수"),
):
    """
    자산 히스토리 조회 냥~ 🐱
    일별 자산 추이 데이터
    """
    asset_service = AssetService(db)

    # 기본값: 최근 30일
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=limit)

    history = await asset_service.get_asset_history(
        portfolio_id, start_date, end_date, limit
    )

    return [AssetHistoryResponse(**h) for h in history]


@router.post("/rebalance", response_model=RebalanceResponse)
async def calculate_rebalance(
    db: SupabaseDep,
    targets: list[RebalanceTarget],
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
):
    """
    리밸런싱 계산 냥~ 🐱
    목표 비율에 맞추기 위한 매수/매도 금액 계산
    """
    asset_service = AssetService(db)
    finance_service = FinanceService()

    # 현재 자산 조회
    assets = await asset_service.get_assets(portfolio_id)
    enriched_assets = await finance_service.enrich_assets_with_prices(assets)

    # 리밸런싱 계산
    result = await asset_service.calculate_rebalance(enriched_assets, targets)

    return result


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


@router.get("/benchmark/{ticker}", response_model=BenchmarkResponse)
async def get_benchmark_history(
    ticker: str,
    start_date: Optional[date] = Query(None, description="시작일"),
    end_date: Optional[date] = Query(None, description="종료일"),
    period: str = Query("3M", description="기간 (1M, 3M, 6M, YTD, 1Y)"),
):
    """
    벤치마크 수익률 히스토리 조회 냥~ 🐱

    - ^KS11: KOSPI
    - ^GSPC: S&P 500
    - ^IXIC: NASDAQ
    """
    finance_service = FinanceService()

    # 기본값 설정
    if not end_date:
        end_date = date.today()

    if not start_date:
        # 기간에 따른 시작일 계산
        period_days = {
            "1M": 30,
            "3M": 90,
            "6M": 180,
            "YTD": (date.today() - date(date.today().year, 1, 1)).days,
            "1Y": 365,
        }
        days = period_days.get(period, 90)
        start_date = end_date - timedelta(days=days)

    result = await finance_service.get_benchmark_history(ticker, start_date, end_date)

    return BenchmarkResponse(
        ticker=result["ticker"],
        name=result["name"],
        data=result["data"]
    )


@router.get("/performance", response_model=PerformanceMetrics)
async def get_performance_metrics(
    db: SupabaseDep,
    portfolio_id: Optional[UUID] = Query(None, description="포트폴리오 ID"),
):
    """
    기간별 수익률 및 드로우다운 분석 냥~ 🐱

    - 1M, 3M, 6M, YTD, 1Y 수익률
    - MDD (최대 드로우다운)
    """
    asset_service = AssetService(db)

    today = date.today()
    periods = [
        ("1M", 30),
        ("3M", 90),
        ("6M", 180),
        ("YTD", (today - date(today.year, 1, 1)).days),
        ("1Y", 365),
    ]

    period_returns = []

    for period_name, days in periods:
        start_date = today - timedelta(days=days)

        # 시작일과 현재 히스토리 조회
        history = await asset_service.get_asset_history(
            portfolio_id, start_date, today, limit=days + 1
        )

        if len(history) >= 2:
            start_value = history[0].get("total_value", Decimal("0"))
            end_value = history[-1].get("total_value", Decimal("0"))

            if start_value and start_value > 0:
                return_rate = float(((end_value - start_value) / start_value) * 100)
            else:
                return_rate = None
        else:
            start_value = None
            end_value = None
            return_rate = None

        period_returns.append(PeriodReturn(
            period=period_name,
            return_rate=round(return_rate, 2) if return_rate is not None else None,
            start_value=Decimal(str(start_value)) if start_value else None,
            end_value=Decimal(str(end_value)) if end_value else None,
        ))

    # MDD 계산 (최근 1년 기준)
    year_history = await asset_service.get_asset_history(
        portfolio_id, today - timedelta(days=365), today, limit=365
    )

    max_drawdown = None
    max_drawdown_period = None
    current_drawdown = None

    if year_history:
        peak = Decimal("0")
        max_dd = Decimal("0")
        peak_date = None
        trough_date = None

        values = [h.get("total_value", Decimal("0")) for h in year_history]
        dates = [h.get("snapshot_date") for h in year_history]

        for i, value in enumerate(values):
            if value > peak:
                peak = value
                peak_date = dates[i]

            if peak > 0:
                dd = (peak - value) / peak * 100
                if dd > max_dd:
                    max_dd = dd
                    trough_date = dates[i]

        max_drawdown = float(max_dd)

        if peak_date and trough_date:
            max_drawdown_period = f"{peak_date} ~ {trough_date}"

        # 현재 드로우다운
        if values and peak > 0:
            current_value = values[-1]
            current_drawdown = float((peak - current_value) / peak * 100)

    return PerformanceMetrics(
        period_returns=period_returns,
        max_drawdown=round(max_drawdown, 2) if max_drawdown else None,
        max_drawdown_period=max_drawdown_period,
        current_drawdown=round(current_drawdown, 2) if current_drawdown else None,
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

    # 요약 정보 계산 (현재 배분 포함)
    summary = await asset_service.calculate_summary(enriched_assets, portfolio_id)

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
    summary = await asset_service.calculate_summary(enriched_assets, portfolio_id)

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
    """
    finance_service = FinanceService()

    # 주요 지표 목록
    indicators = [
        {"ticker": "^KS11", "name": "KOSPI", "currency": "KRW"},
        {"ticker": "^GSPC", "name": "S&P 500", "currency": "USD"},
        {"ticker": "^IXIC", "name": "NASDAQ", "currency": "USD"},
        {"ticker": "^VIX", "name": "VIX", "currency": ""},
    ]

    results = []

    for indicator in indicators:
        try:
            data = await finance_service.get_ticker_history(indicator["ticker"], 2)
            if data and data.get("data") and len(data["data"]) >= 1:
                latest = data["data"][-1]
                results.append({
                    "ticker": indicator["ticker"],
                    "name": indicator["name"],
                    "price": latest["close"],
                    "change_rate": data.get("change_rate", 0),
                    "currency": indicator["currency"],
                })
        except Exception:
            # 개별 지표 조회 실패 시 스킵
            pass

    # 환율 추가
    try:
        rate = await finance_service.get_exchange_rate()
        results.append({
            "ticker": "USDKRW=X",
            "name": "USD/KRW",
            "price": rate,
            "change_rate": 0,  # 환율은 별도 계산 필요
            "currency": "KRW",
        })
    except Exception:
        pass

    return {
        "indicators": results,
        "timestamp": datetime.now().isoformat()
    }
