"""pytest 설정과 격리된 테스트 데이터베이스 fixture."""
import os
import tempfile
from pathlib import Path

# app/config가 import될 때 DB 경로가 고정되므로 애플리케이션보다 먼저 설정한다.
_TEST_DATA_DIR = Path(tempfile.mkdtemp(prefix="meowney-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DATA_DIR / 'meowney-test.db'}"

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture
async def client():
    """비동기 테스트 클라이언트 냥~"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
