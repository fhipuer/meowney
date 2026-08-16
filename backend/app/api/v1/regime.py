"""투자 레짐 조회, 갱신, Snapshot 및 Export API."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.services.regime_service import RegimeService


router = APIRouter()


class SnapshotRequest(BaseModel):
    user_regime: Literal["유지", "경계", "약화", "전환"] | None = None
    user_note: str | None = None
    review_completed: bool = False


class ReviewCompleteRequest(BaseModel):
    note: str | None = None


@router.get("")
async def get_current_regime():
    return RegimeService().current()


@router.post("/refresh")
async def refresh_regime_data(force: bool = False):
    try:
        return await RegimeService().refresh(force=force)
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
    return RegimeService().create_snapshot(request.user_regime, request.user_note, request.review_completed)


@router.put("/snapshots/{snapshot_id}")
async def update_regime_snapshot(snapshot_id: str, request: SnapshotRequest):
    try:
        return RegimeService().update_judgment(snapshot_id, request.user_regime, request.user_note)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Snapshot을 찾을 수 없습니다.") from exc


@router.get("/export")
async def export_regime_data(format: Literal["markdown", "json"] = "markdown"):
    service = RegimeService()
    if format == "json":
        return {"current": service.current(), "history": service.history()}
    return Response(
        content=service.export_markdown(),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=meowney-regime.md"},
    )
