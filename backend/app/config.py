"""
Meowney 환경 설정 냥~ 🐱
고양이 집사의 비밀 설정 파일
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """앱 설정 - 환경변수에서 자동으로 읽어옴"""

    # Supabase 설정
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str | None = None

    # 앱 설정
    debug: bool = False
    app_name: str = "Meowney"
    api_v1_prefix: str = "/api/v1"

    # 스케줄러 설정 (매일 밤 11시에 스냅샷 저장)
    snapshot_hour: int = 23
    snapshot_minute: int = 0
    timezone: str = "Asia/Seoul"

    # 환율 설정
    default_usd_krw_rate: float = 1350.0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """설정 싱글톤 - 한 번만 로드하면 돼 냥~"""
    return Settings()


# 편의를 위한 설정 인스턴스
settings = get_settings()
