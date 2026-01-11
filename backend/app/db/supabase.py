"""
Supabase 클라이언트 냥~ 🐱
데이터베이스 연결을 담당하는 모듈
"""
from functools import lru_cache
from supabase import create_client, Client
from app.config import settings


@lru_cache
def get_supabase_client() -> Client:
    """
    Supabase 클라이언트 싱글톤
    한 번 연결하면 계속 쓰는 게 효율적이지 냥~
    """
    return create_client(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_anon_key
    )


# 편의를 위한 클라이언트 인스턴스
supabase: Client = get_supabase_client()
