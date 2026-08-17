import pytest

import app.services.scheduler_service as scheduler


@pytest.mark.asyncio
async def test_event_failure_does_not_skip_sec_or_memory(monkeypatch):
    called = []

    class Macro:
        async def refresh(self):
            called.append("macro")
            return {"status": "success"}

    class Events:
        async def refresh(self):
            called.append("events")
            raise RuntimeError("BLS 403")

    class Sec:
        async def refresh(self):
            called.append("sec")
            return {"status": "success"}

    class Memory:
        async def refresh(self):
            called.append("memory")
            return {"status": "success"}

    class Thesis:
        async def refresh(self):
            called.append("thesis")
            return {"status": "success"}

    monkeypatch.setattr(scheduler, "RegimeService", Macro)
    monkeypatch.setattr(scheduler, "RegimeEventService", Events)
    monkeypatch.setattr(scheduler, "SecCapexService", Sec)
    monkeypatch.setattr(scheduler, "MemoryPriceService", Memory)
    monkeypatch.setattr(scheduler, "RegimeThesisDataService", Thesis)

    result = await scheduler.refresh_regime_sources()

    assert set(called) == {"macro", "events", "sec", "memory", "thesis"}
    assert isinstance(result["일정"], RuntimeError)
    assert result["SEC CAPEX"]["status"] == "success"
    assert result["메모리"]["status"] == "success"
    assert result["반도체·전력"]["status"] == "success"
