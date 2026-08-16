"""
API 의존성 주입 냥~ 🐱
"""
from typing import Annotated
from fastapi import Depends
from app.db.supabase import get_supabase_client
from app.db.sqlite_client import SQLiteClient

# Supabase 클라이언트 의존성
SupabaseDep = Annotated[SQLiteClient, Depends(get_supabase_client)]
