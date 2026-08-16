"""
Supabase 클라이언트 냥~ 🐱
데이터베이스 연결을 담당하는 모듈
"""
from functools import lru_cache
from app.config import settings
from app.db.sqlite_client import SQLiteClient


@lru_cache
def get_supabase_client() -> SQLiteClient:
    """
    Supabase 클라이언트 싱글톤
    한 번 연결하면 계속 쓰는 게 효율적이지 냥~
    """
    return SQLiteClient.from_url(settings.database_url)


# 편의를 위한 클라이언트 인스턴스
supabase: SQLiteClient = get_supabase_client()
