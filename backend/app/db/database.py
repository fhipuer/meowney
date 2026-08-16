"""애플리케이션 SQLite 데이터베이스 연결을 제공한다."""

from functools import lru_cache

from app.config import settings
from app.db.sqlite_client import SQLiteClient


@lru_cache
def get_database_client() -> SQLiteClient:
    """설정된 로컬 SQLite 클라이언트 싱글톤을 반환한다."""
    return SQLiteClient.from_url(settings.database_url)


database: SQLiteClient = get_database_client()
