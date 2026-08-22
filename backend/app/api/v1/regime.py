"""투자 레짐 조회, 갱신, Snapshot 및 Export API."""

import asyncio
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.regime_service import RegimeService
from app.services.regime_events import RegimeEventService
from app.services.regime_sec import SecCapexService
from app.services.regime_memory import MemoryPriceService
from app.services.regime_thesis import RegimeThesisDataService
from app.services.regime_treasury import TreasuryYieldService
from app.services.regime_energy import EnergyShockService


router = APIRouter()


class SnapshotRequest(BaseModel):
    user_regime: Literal["유지", "경계", "약화", "전환"] | None = None
    user_note: str | None = None


class ReviewCompleteRequest(BaseModel):
    note: str | None = None


@router.get("")
async def get_current_regime():
    return RegimeService().current()


@router.post("/refresh")
async def refresh_regime_data(force: bool = False):
    try:
        macro, treasury, events, ai_capex, memory_prices, thesis_data, energy = await asyncio.gather(
            RegimeService().refresh(force=force),
            TreasuryYieldService().refresh(force=force),
            RegimeEventService().refresh(),
            SecCapexService().refresh(force=force),
            MemoryPriceService().refresh(force=force),
            RegimeThesisDataService().refresh(force=force),
            EnergyShockService().refresh(force=force),
            return_exceptions=True,
        )
        def outcome(value):
            return {"status": "failed", "error": str(value)} if isinstance(value, Exception) else value
        macro, treasury, events, ai_capex, memory_prices, thesis_data, energy = map(
            outcome, (macro, treasury, events, ai_capex, memory_prices, thesis_data, energy)
        )
        # Both feeds refresh concurrently. Rebuild the composite once with the
        # memory result from this same request so the response cannot mix a new
        # KOSIS/export cache with the previous DRAM price state.
        if memory_prices.get("memory_cycle"):
            thesis_data["semiconductor_cycle"] = (
                RegimeThesisDataService().semiconductor_summary(
                    memory_prices["memory_cycle"]
                )
            )
        outcomes = (macro, treasury, events, ai_capex, memory_prices, thesis_data, energy)
        statuses = [item.get("status", "failed") for item in outcomes]
        healthy = {"success", "cached"}
        overall = (
            "success" if all(status in healthy for status in statuses)
            else "failed" if all(status not in healthy and status != "partial" for status in statuses)
            else "partial"
        )
        return {
            "macro": macro, "treasury": treasury, "events": events, "ai_capex": ai_capex,
            "memory_prices": memory_prices, "thesis_data": thesis_data, "energy": energy,
            "status": overall,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"외부 데이터 갱신 실패: {exc}") from exc


@router.get("/history")
async def get_regime_history():
    return RegimeService().history()


@router.post("/review-complete")
async def complete_regime_review(request: ReviewCompleteRequest):
    return RegimeService().complete_review(request.note)


@router.post("/snapshots", status_code=201)
async def create_regime_snapshot(request: SnapshotRequest):
    return RegimeService().create_snapshot(request.user_regime, request.user_note)


@router.put("/snapshots/{snapshot_id}")
async def update_regime_snapshot(snapshot_id: str, request: SnapshotRequest):
    try:
        return RegimeService().update_judgment(snapshot_id, request.user_regime, request.user_note)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Snapshot을 찾을 수 없습니다.") from exc
