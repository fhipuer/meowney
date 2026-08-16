"""
API v1 라우터 통합 냥~ 🐱
"""
from fastapi import APIRouter
from app.api.v1 import assets, dashboard, rebalance, data_migration, regime, settings

api_router = APIRouter()

# 라우터 등록
api_router.include_router(
    assets.router,
    prefix="/assets",
    tags=["Assets - 자산 관리"]
)

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard - 대시보드"]
)

api_router.include_router(
    rebalance.router,
    tags=["Rebalance Plans - 리밸런싱 플랜"]
)

api_router.include_router(
    data_migration.router,
    prefix="/data",
    tags=["Data Migration - 데이터 이동"]
)

api_router.include_router(
    settings.router,
    tags=["Settings - 사용자 설정"]
)

api_router.include_router(
    regime.router,
    prefix="/regime",
    tags=["Regime - 투자 레짐"]
)
