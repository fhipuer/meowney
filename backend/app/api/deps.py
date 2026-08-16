"""
API 의존성 주입 냥~ 🐱
"""
from typing import Annotated
from fastapi import Depends
from app.db.database import get_database_client
from app.db.sqlite_client import SQLiteClient

# SQLite 데이터베이스 의존성
DatabaseDep = Annotated[SQLiteClient, Depends(get_database_client)]
