"""
Scheduler Service - 백그라운드 작업 스케줄러 냥~ 🐱
매일 밤 11시에 자산 스냅샷 및 벤치마크 데이터 저장
"""
import pytz
from datetime import datetime, date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.db.supabase import get_supabase_client
from app.services.asset_service import AssetService
from app.services.finance_service import FinanceService


# 벤치마크 티커 목록 냥~
BENCHMARK_TICKERS = [
    "^KS11",   # KOSPI
    "^GSPC",   # S&P 500
    "^IXIC",   # NASDAQ
]


# 스케줄러 인스턴스
scheduler: AsyncIOScheduler | None = None


async def take_daily_snapshot():
    """
    일일 자산 스냅샷 저장 냥~ 🐱

    모든 포트폴리오에 대해:
    1. 현재 자산 조회
    2. 실시간 가격 조회
    3. 요약 계산
    4. asset_history에 저장
    """
    print(f"📸 [{datetime.now()}] 일일 스냅샷 시작 냥~!")

    try:
        db = get_supabase_client()
        asset_service = AssetService(db)
        finance_service = FinanceService()

        # 모든 포트폴리오 조회
        portfolio_ids = await asset_service.get_all_portfolio_ids()

        # 현재 환율 조회 (모든 포트폴리오에 동일하게 적용)
        from decimal import Decimal
        exchange_rate = await finance_service.get_exchange_rate()

        for portfolio_id in portfolio_ids:
            try:
                # 자산 조회 및 가격 조회
                assets = await asset_service.get_assets(portfolio_id)
                enriched_assets = await finance_service.enrich_assets_with_prices(assets)

                # 요약 계산 (환율 전달)
                summary = await asset_service.calculate_summary(
                    enriched_assets, portfolio_id, Decimal(str(exchange_rate))
                )

                # 스냅샷 저장
                await asset_service.save_snapshot(portfolio_id, summary)

                print(f"✅ 포트폴리오 {portfolio_id} 스냅샷 완료!")
                print(f"   총 자산: {summary.total_value:,.0f}원")
                print(f"   수익률: {summary.profit_rate:+.2f}%")

            except Exception as e:
                print(f"❌ 포트폴리오 {portfolio_id} 스냅샷 실패 냥: {e}")

        print(f"🎉 [{datetime.now()}] 모든 스냅샷 완료 냥~!")

    except Exception as e:
        print(f"🙀 스냅샷 작업 전체 실패 냥: {e}")


def start_scheduler():
    """
    스케줄러 시작 냥~
    설정된 시간(기본 23:00)에 스냅샷 작업 실행
    """
    global scheduler

    if scheduler is not None:
        print("⚠️ 스케줄러가 이미 실행 중이다옹!")
        return

    tz = pytz.timezone(settings.timezone)

    scheduler = AsyncIOScheduler(timezone=tz)

    # 매일 지정 시간에 스냅샷 작업 실행
    trigger = CronTrigger(
        hour=settings.snapshot_hour,
        minute=settings.snapshot_minute,
        timezone=tz,
    )

    scheduler.add_job(
        take_all_snapshots,
        trigger=trigger,
        id="daily_snapshot",
        name="일일 자산/벤치마크 스냅샷 냥~",
        replace_existing=True,
    )

    scheduler.start()
    print(f"⏰ 스케줄러 시작! 매일 {settings.snapshot_hour}:{settings.snapshot_minute:02d}에 스냅샷 저장 냥~")


def shutdown_scheduler():
    """스케줄러 종료 냥~"""
    global scheduler

    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
        print("💤 스케줄러 종료 냥~")


async def run_snapshot_now():
    """
    수동으로 스냅샷 실행 (테스트/디버그용)
    """
    print("🖐️ 수동 스냅샷 실행 냥~")
    await take_daily_snapshot()


async def take_benchmark_snapshot():
    """
    벤치마크 일별 종가 스냅샷 저장 냥~ 📊

    KOSPI, S&P 500, NASDAQ의 당일 종가를 benchmark_history 테이블에 저장
    """
    print(f"📊 [{datetime.now()}] 벤치마크 스냅샷 시작 냥~!")

    try:
        db = get_supabase_client()
        finance_service = FinanceService()

        today = date.today()

        for ticker in BENCHMARK_TICKERS:
            try:
                # 현재 종가 조회
                result = await finance_service.get_stock_price(ticker)

                if result.get("valid") and result.get("current_price"):
                    close_price = float(result["current_price"])

                    # DB에 저장 (upsert)
                    db.table("benchmark_history").upsert(
                        {
                            "ticker": ticker,
                            "snapshot_date": today.isoformat(),
                            "close_price": close_price,
                        },
                        on_conflict="ticker,snapshot_date"
                    ).execute()

                    print(f"✅ {ticker} 종가 저장: {close_price:,.2f}")
                else:
                    print(f"⚠️ {ticker} 가격 조회 실패 냥")

            except Exception as e:
                print(f"❌ {ticker} 스냅샷 실패 냥: {e}")

        print(f"🎉 [{datetime.now()}] 벤치마크 스냅샷 완료 냥~!")

    except Exception as e:
        print(f"🙀 벤치마크 스냅샷 전체 실패 냥: {e}")


async def take_all_snapshots():
    """
    자산 스냅샷 + 벤치마크 스냅샷 모두 실행 냥~
    """
    await take_daily_snapshot()
    await take_benchmark_snapshot()
