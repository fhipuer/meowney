"""
pytest 설정 및 fixtures 냥~ 🐱
"""
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture
async def client():
    """비동기 테스트 클라이언트 냥~"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
