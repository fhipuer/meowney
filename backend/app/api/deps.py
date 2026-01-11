"""
API 의존성 주입 냥~ 🐱
"""
from typing import Annotated
from fastapi import Depends
from supabase import Client
from app.db.supabase import get_supabase_client

# Supabase 클라이언트 의존성
SupabaseDep = Annotated[Client, Depends(get_supabase_client)]
