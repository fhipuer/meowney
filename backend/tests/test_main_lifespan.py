import asyncio

import pytest

import app.main as main_module


@pytest.mark.asyncio
async def test_startup_warms_regime_feeds_without_blocking_lifespan(monkeypatch):
    calls: list[str] = []

    async def refresh():
        await asyncio.sleep(0)
        calls.append("refresh")

    monkeypatch.setattr(main_module, "start_scheduler", lambda: calls.append("start"))
    monkeypatch.setattr(main_module, "shutdown_scheduler", lambda: calls.append("stop"))
    monkeypatch.setattr(main_module, "refresh_regime_sources", refresh)

    async with main_module.lifespan(main_module.app):
        await asyncio.sleep(0.01)

    assert calls == ["start", "refresh", "stop"]
