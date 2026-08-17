"""
Meowney 환경 설정 냥~ 🐱
고양이 집사의 비밀 설정 파일
"""
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict
from functools import lru_cache
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """앱 설정 - 환경변수에서 자동으로 읽어옴"""

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", PROJECT_ROOT / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 로컬 SQLite 설정
    database_url: str = "sqlite:///./data/meowney.db"
    fred_api_key: str | None = None
    kosis_api_key: str | None = None
    data_go_kr_service_key: str | None = None
    opendart_api_key: str | None = None
    eia_api_key: str | None = None
    sec_user_agent: str = "Meowney personal portfolio app contact@example.com"

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

@lru_cache
def get_settings() -> Settings:
    """설정 싱글톤 - 한 번만 로드하면 돼 냥~"""
    return Settings()


# 편의를 위한 설정 인스턴스
settings = get_settings()
