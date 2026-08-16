"""
Meowney API 메인 엔트리포인트 냥~
고양이 집사의 자산 관리 서버
"""
import sys
import io
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.router import api_router
from app.services.scheduler_service import start_scheduler, shutdown_scheduler

# Windows 콘솔 인코딩 문제 해결
if sys.platform == "win32" and sys.stdout.isatty() and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    앱 생명주기 관리 냥~
    서버 시작 시 스케줄러 시작, 종료 시 정리
    """
    # 시작 시
    print("[Meowney] 서버가 기지개를 켜는 중이다옹...")
    start_scheduler()
    print("[Meowney] 스케줄러가 깨어났다옹! 매일 밤 자산 스냅샷을 찍을 거야~")

    yield

    # 종료 시
    print("[Meowney] 서버가 잠들 준비를 하는 중이다옹...")
    shutdown_scheduler()
    print("[Meowney] 안녕히 주무세요 냥~")


# FastAPI 앱 생성
app = FastAPI(
    title="Meowney API",
    description="🐱 고양이 집사의 자산 관리 API - 냥이와 함께하는 포트폴리오 관리",
    version="1.3.3",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health Check
@app.get("/health", tags=["Health"])
async def health_check():
    """서버 상태 확인 - 고양이가 살아있는지 체크 냥~"""
    return {
        "status": "healthy",
        "message": "🐱 야옹~ 서버가 잘 돌아가고 있다옹!",
        "app_name": settings.app_name,
    }


# API 라우터 등록
app.include_router(api_router, prefix=settings.api_v1_prefix)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )
