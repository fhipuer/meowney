"""
데이터 마이그레이션 API 냥~ 🐱
Import/Export 기능을 제공합니다
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db.supabase import supabase
from app.services.asset_service import AssetService

router = APIRouter()

# 현재 스키마 버전 냥~
SCHEMA_VERSION = "1.0.0"


class ExportData(BaseModel):
    """내보내기 데이터 구조"""
    schema_version: str
    export_date: str
    portfolios: list
    assets: list
    rebalance_plans: list
    plan_allocations: list


class ImportRequest(BaseModel):
    """가져오기 요청"""
    data: dict
    merge_strategy: str = "replace"  # replace: 기존 데이터 삭제 후 가져오기, merge: 병합


@router.get("/export")
async def export_data(portfolio_id: Optional[str] = None):
    """
    데이터 내보내기 냥~ 🐱
    전체 또는 특정 포트폴리오의 데이터를 JSON으로 내보냅니다
    """
    try:
        # 포트폴리오 조회
        if portfolio_id:
            portfolios_query = supabase.table("portfolios").select("*").eq("id", portfolio_id)
        else:
            portfolios_query = supabase.table("portfolios").select("*")

        portfolios_result = portfolios_query.execute()
        portfolios = portfolios_result.data or []

        # 포트폴리오 ID 목록
        portfolio_ids = [p["id"] for p in portfolios]

        if not portfolio_ids:
            # 포트폴리오가 없으면 빈 데이터 반환
            return {
                "schema_version": SCHEMA_VERSION,
                "export_date": datetime.now().isoformat(),
                "portfolios": [],
                "assets": [],
                "rebalance_plans": [],
                "plan_allocations": []
            }

        # 자산 조회
        assets_result = supabase.table("assets").select("*").in_("portfolio_id", portfolio_ids).execute()
        assets = assets_result.data or []

        # 리밸런싱 플랜 조회
        plans_result = supabase.table("rebalance_plans").select("*").in_("portfolio_id", portfolio_ids).execute()
        plans = plans_result.data or []

        # 플랜 ID 목록
        plan_ids = [p["id"] for p in plans]

        # 플랜 배분 조회
        allocations = []
        if plan_ids:
            allocations_result = supabase.table("plan_allocations").select("*").in_("plan_id", plan_ids).execute()
            allocations = allocations_result.data or []

        # 민감 정보 제거 및 정리
        clean_portfolios = []
        for p in portfolios:
            clean_portfolios.append({
                "name": p.get("name"),
                "description": p.get("description"),
                "base_currency": p.get("base_currency", "KRW"),
                "target_value": p.get("target_value")
            })

        clean_assets = []
        for a in assets:
            clean_assets.append({
                "name": a.get("name"),
                "ticker": a.get("ticker"),
                "asset_type": a.get("asset_type", "stock"),
                "quantity": float(a.get("quantity", 0)),
                "average_price": float(a.get("average_price", 0)),
                "currency": a.get("currency", "KRW"),
                "current_value": float(a.get("current_value")) if a.get("current_value") else None,
                "purchase_exchange_rate": float(a.get("purchase_exchange_rate")) if a.get("purchase_exchange_rate") else None,
                "notes": a.get("notes"),
                "is_active": a.get("is_active", True),
                "_portfolio_name": next((p["name"] for p in portfolios if p["id"] == a.get("portfolio_id")), None)
            })

        clean_plans = []
        for p in plans:
            clean_plans.append({
                "name": p.get("name"),
                "description": p.get("description"),
                "strategy_prompt": p.get("strategy_prompt"),
                "is_main": p.get("is_main", False),
                "is_active": p.get("is_active", True),
                "_portfolio_name": next((pf["name"] for pf in portfolios if pf["id"] == p.get("portfolio_id")), None),
                "_original_id": p.get("id")  # 배분 매핑용
            })

        clean_allocations = []
        for a in allocations:
            plan = next((p for p in plans if p["id"] == a.get("plan_id")), None)
            clean_allocations.append({
                "ticker": a.get("ticker"),
                "target_percentage": float(a.get("target_percentage", 0)),
                "_plan_name": plan.get("name") if plan else None
            })

        return {
            "schema_version": SCHEMA_VERSION,
            "export_date": datetime.now().isoformat(),
            "portfolios": clean_portfolios,
            "assets": clean_assets,
            "rebalance_plans": clean_plans,
            "plan_allocations": clean_allocations
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"내보내기 실패 냥~ 😿: {str(e)}")


@router.post("/import")
async def import_data(request: ImportRequest):
    """
    데이터 가져오기 냥~ 🐱
    JSON 데이터를 가져와 저장합니다
    """
    try:
        data = request.data
        merge_strategy = request.merge_strategy

        # 스키마 버전 확인
        schema_version = data.get("schema_version", "0.0.0")
        if not schema_version.startswith("1."):
            raise HTTPException(status_code=400, detail=f"지원하지 않는 스키마 버전이다냥~ 😿: {schema_version}")

        portfolios_data = data.get("portfolios", [])
        assets_data = data.get("assets", [])
        plans_data = data.get("rebalance_plans", [])
        allocations_data = data.get("plan_allocations", [])

        created_portfolios = {}
        created_plans = {}

        stats = {
            "portfolios_created": 0,
            "portfolios_updated": 0,
            "assets_created": 0,
            "plans_created": 0,
            "allocations_created": 0
        }

        # 데이터가 모두 비어있으면 바로 성공 반환
        if not portfolios_data and not assets_data and not plans_data and not allocations_data:
            return {
                "success": True,
                "message": "가져올 데이터가 없다냥~ 🐱",
                "stats": stats
            }

        # 1. 포트폴리오 생성
        for p_data in portfolios_data:
            portfolio_name = p_data.get("name", "가져온 포트폴리오")

            # 기존 포트폴리오 확인
            existing = supabase.table("portfolios").select("*").eq("name", portfolio_name).execute()

            if existing.data:
                if merge_strategy == "replace":
                    # 기존 데이터 삭제 후 새로 생성
                    portfolio_id = existing.data[0]["id"]
                    supabase.table("assets").delete().eq("portfolio_id", portfolio_id).execute()
                    # 플랜 배분 먼저 삭제
                    plans_to_delete = supabase.table("rebalance_plans").select("id").eq("portfolio_id", portfolio_id).execute()
                    for plan in (plans_to_delete.data or []):
                        supabase.table("plan_allocations").delete().eq("plan_id", plan["id"]).execute()
                    supabase.table("rebalance_plans").delete().eq("portfolio_id", portfolio_id).execute()
                    supabase.table("portfolios").delete().eq("id", portfolio_id).execute()

                    # 새 포트폴리오 생성
                    new_portfolio = supabase.table("portfolios").insert({
                        "name": portfolio_name,
                        "description": p_data.get("description"),
                        "base_currency": p_data.get("base_currency", "KRW"),
                        "target_value": p_data.get("target_value")
                    }).execute()
                    if new_portfolio.data:
                        created_portfolios[portfolio_name] = new_portfolio.data[0]["id"]
                        stats["portfolios_created"] += 1
                else:
                    # merge 모드: 기존 포트폴리오 ID 사용
                    created_portfolios[portfolio_name] = existing.data[0]["id"]
                    stats["portfolios_updated"] += 1
            else:
                # 새 포트폴리오 생성
                new_portfolio = supabase.table("portfolios").insert({
                    "name": portfolio_name,
                    "description": p_data.get("description"),
                    "base_currency": p_data.get("base_currency", "KRW"),
                    "target_value": p_data.get("target_value")
                }).execute()

                if new_portfolio.data:
                    created_portfolios[portfolio_name] = new_portfolio.data[0]["id"]
                    stats["portfolios_created"] += 1

        # 포트폴리오가 없으면 기본 생성
        if not created_portfolios:
            default_portfolio = supabase.table("portfolios").select("*").limit(1).execute()
            if default_portfolio.data:
                created_portfolios["default"] = default_portfolio.data[0]["id"]
            else:
                new_default = supabase.table("portfolios").insert({
                    "name": "가져온 포트폴리오",
                    "base_currency": "KRW"
                }).execute()
                created_portfolios["default"] = new_default.data[0]["id"]

        # 2. 자산 생성
        for a_data in assets_data:
            portfolio_name = a_data.get("_portfolio_name", "default")
            portfolio_id = created_portfolios.get(portfolio_name) or list(created_portfolios.values())[0]

            supabase.table("assets").insert({
                "portfolio_id": portfolio_id,
                "name": a_data.get("name", "알 수 없는 자산"),
                "ticker": a_data.get("ticker"),
                "asset_type": a_data.get("asset_type", "stock"),
                "quantity": a_data.get("quantity", 0),
                "average_price": a_data.get("average_price", 0),
                "currency": a_data.get("currency", "KRW"),
                "current_value": a_data.get("current_value"),
                "purchase_exchange_rate": a_data.get("purchase_exchange_rate"),
                "notes": a_data.get("notes"),
                "is_active": a_data.get("is_active", True)
            }).execute()
            stats["assets_created"] += 1

        # 3. 리밸런싱 플랜 생성
        for plan_data in plans_data:
            portfolio_name = plan_data.get("_portfolio_name", "default")
            portfolio_id = created_portfolios.get(portfolio_name) or list(created_portfolios.values())[0]
            plan_name = plan_data.get("name", "가져온 플랜")

            new_plan = supabase.table("rebalance_plans").insert({
                "portfolio_id": portfolio_id,
                "name": plan_name,
                "description": plan_data.get("description"),
                "strategy_prompt": plan_data.get("strategy_prompt"),
                "is_main": plan_data.get("is_main", False),
                "is_active": plan_data.get("is_active", True)
            }).execute()

            if new_plan.data:
                created_plans[plan_name] = new_plan.data[0]["id"]
                stats["plans_created"] += 1

        # 4. 플랜 배분 생성
        for alloc_data in allocations_data:
            plan_name = alloc_data.get("_plan_name")
            plan_id = created_plans.get(plan_name)

            if plan_id:
                supabase.table("plan_allocations").insert({
                    "plan_id": plan_id,
                    "ticker": alloc_data.get("ticker"),
                    "target_percentage": alloc_data.get("target_percentage", 0)
                }).execute()
                stats["allocations_created"] += 1

        return {
            "success": True,
            "message": "데이터 가져오기 성공이다냥~ 🎉",
            "stats": stats
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"가져오기 실패 냥~ 😿: {str(e)}")


@router.get("/schema-info")
async def get_schema_info():
    """
    현재 스키마 정보 조회 냥~ 🐱
    """
    return {
        "current_version": SCHEMA_VERSION,
        "supported_versions": ["1.0.0"],
        "fields": {
            "portfolios": ["name", "description", "base_currency", "target_value"],
            "assets": ["name", "ticker", "asset_type", "quantity", "average_price", "currency", "current_value", "purchase_exchange_rate", "notes", "is_active"],
            "rebalance_plans": ["name", "description", "strategy_prompt", "is_main", "is_active"],
            "plan_allocations": ["ticker", "target_percentage"]
        }
    }
