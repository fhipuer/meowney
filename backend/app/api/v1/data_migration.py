"""
데이터 마이그레이션 API 냥~ 🐱
Import/Export 기능을 제공합니다
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import uuid4
from app.db.database import database
from app.services.asset_service import AssetService

router = APIRouter()

# 현재 스키마 버전 냥~
SCHEMA_VERSION = "1.1.0"


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


def _select_in_batches(table_name: str, column: str, values: list, batch_size: int = 500) -> list:
    """SQLite의 바인드 변수 한도를 넘지 않도록 IN 조회를 나눈다."""
    rows = []
    for start in range(0, len(values), batch_size):
        result = (
            database.table(table_name)
            .select("*")
            .in_(column, values[start:start + batch_size])
            .execute()
        )
        rows.extend(result.data or [])
    return rows


@router.get("/export")
async def export_data(portfolio_id: Optional[str] = None):
    """
    데이터 내보내기 냥~ 🐱
    전체 또는 특정 포트폴리오의 데이터를 JSON으로 내보냅니다
    """
    try:
        # 포트폴리오 조회
        if portfolio_id:
            portfolios_query = database.table("portfolios").select("*").eq("id", portfolio_id)
        else:
            portfolios_query = database.table("portfolios").select("*")

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
        assets = _select_in_batches("assets", "portfolio_id", portfolio_ids)

        # 리밸런싱 플랜 조회
        plans = _select_in_batches("rebalance_plans", "portfolio_id", portfolio_ids)

        # 플랜 ID 목록
        plan_ids = [p["id"] for p in plans]

        # 플랜 배분 조회
        allocations = []
        if plan_ids:
            allocations = _select_in_batches("plan_allocations", "plan_id", plan_ids)

        # 민감 정보 제거 및 정리
        clean_portfolios = []
        for p in portfolios:
            clean_portfolios.append({
                "_portfolio_key": p.get("id"),
                "name": p.get("name"),
                "description": p.get("description"),
                "base_currency": p.get("base_currency", "KRW"),
                "target_value": p.get("target_value")
            })

        clean_assets = []
        for a in assets:
            clean_assets.append({
                "_asset_key": a.get("id"),
                "_portfolio_key": a.get("portfolio_id"),
                "name": a.get("name"),
                "ticker": a.get("ticker"),
                "asset_type": a.get("asset_type", "stock"),
                "category_id": a.get("category_id"),
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
                "_plan_key": p.get("id"),
                "_portfolio_key": p.get("portfolio_id"),
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
                "_allocation_key": a.get("id"),
                "_plan_key": a.get("plan_id"),
                "asset_id": a.get("asset_id"),
                "ticker": a.get("ticker"),
                "target_percentage": float(a.get("target_percentage", 0)),
                "display_name": a.get("display_name"),
                "alias": a.get("alias"),
                "absolute_band": a.get("absolute_band"),
                "relative_band": a.get("relative_band"),
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
    """백업을 원자적으로 복원한다. 같은 백업의 반복 실행은 멱등적이다."""
    try:
        data = request.data
        merge_strategy = request.merge_strategy
        schema_version = data.get("schema_version", "0.0.0")
        if not schema_version.startswith("1."):
            raise HTTPException(status_code=400, detail=f"지원하지 않는 스키마 버전이다냥~ 😿: {schema_version}")
        if merge_strategy not in {"replace", "merge"}:
            raise HTTPException(status_code=400, detail="merge_strategy는 replace 또는 merge여야 합니다.")

        portfolios_data = data.get("portfolios", [])
        assets_data = data.get("assets", [])
        plans_data = data.get("rebalance_plans", [])
        allocations_data = data.get("plan_allocations", [])
        stats = {
            "portfolios_created": 0,
            "portfolios_updated": 0,
            "assets_created": 0,
            "plans_created": 0,
            "allocations_created": 0
        }

        if not portfolios_data and not assets_data and not plans_data and not allocations_data:
            return {"success": True, "message": "가져올 데이터가 없다냥~ 🐱", "stats": stats}

        portfolio_keys = [p.get("_portfolio_key") for p in portfolios_data]
        if any(not key for key in portfolio_keys):
            names = [p.get("name", "가져온 포트폴리오") for p in portfolios_data]
            if len(names) != len(set(names)):
                raise HTTPException(
                    status_code=400,
                    detail="동일한 이름의 포트폴리오가 있는 구형 백업은 안전하게 복원할 수 없습니다. 새 형식으로 다시 내보내세요.",
                )
        if len([k for k in portfolio_keys if k]) != len(set(k for k in portfolio_keys if k)):
            raise HTTPException(status_code=400, detail="백업에 중복된 포트폴리오 식별자가 있습니다.")

        with database._lock, database.connect() as conn:
            portfolio_map: dict[str, str] = {}
            name_map: dict[str, str] = {}
            for p_data in portfolios_data:
                source_key = p_data.get("_portfolio_key")
                portfolio_name = p_data.get("name", "가져온 포트폴리오")
                existing = conn.execute("SELECT id FROM portfolios WHERE id=?", (source_key,)).fetchone() if source_key else None
                if not existing and not source_key:
                    matches = conn.execute("SELECT id FROM portfolios WHERE name=?", (portfolio_name,)).fetchall()
                    if len(matches) > 1:
                        raise HTTPException(status_code=400, detail=f"'{portfolio_name}' 포트폴리오가 여러 개라 구형 백업을 매핑할 수 없습니다.")
                    existing = matches[0] if matches else None
                portfolio_id = existing["id"] if existing else (source_key or str(uuid4()))
                if existing:
                    stats["portfolios_updated"] += 1
                    if merge_strategy == "replace":
                        conn.execute("DELETE FROM rebalance_plans WHERE portfolio_id=?", (portfolio_id,))
                        conn.execute("DELETE FROM assets WHERE portfolio_id=?", (portfolio_id,))
                    conn.execute(
                        "UPDATE portfolios SET name=?,description=?,base_currency=?,target_value=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (portfolio_name, p_data.get("description"), p_data.get("base_currency", "KRW"), p_data.get("target_value"), portfolio_id),
                    )
                else:
                    conn.execute(
                        "INSERT INTO portfolios(id,name,description,base_currency,target_value) VALUES (?,?,?,?,?)",
                        (portfolio_id, portfolio_name, p_data.get("description"), p_data.get("base_currency", "KRW"), p_data.get("target_value")),
                    )
                    stats["portfolios_created"] += 1
                if source_key:
                    portfolio_map[source_key] = portfolio_id
                name_map[portfolio_name] = portfolio_id

            if not portfolio_map and not name_map:
                row = conn.execute("SELECT id,name FROM portfolios ORDER BY created_at LIMIT 1").fetchone()
                if not row:
                    portfolio_id = str(uuid4())
                    conn.execute("INSERT INTO portfolios(id,name,base_currency) VALUES (?,?,?)", (portfolio_id, "가져온 포트폴리오", "KRW"))
                    name_map["default"] = portfolio_id
                else:
                    name_map["default"] = row["id"]

            asset_map: dict[str, str] = {}
            for a_data in assets_data:
                source_key = a_data.get("_asset_key")
                asset_id = source_key or str(uuid4())
                portfolio_id = portfolio_map.get(a_data.get("_portfolio_key")) or name_map.get(a_data.get("_portfolio_name")) or next(iter(portfolio_map.values()), next(iter(name_map.values())))
                values = (
                    asset_id, portfolio_id, a_data.get("category_id"), a_data.get("name", "알 수 없는 자산"),
                    a_data.get("ticker"), a_data.get("asset_type", "stock"), a_data.get("quantity", 0),
                    a_data.get("average_price", 0), a_data.get("currency", "KRW"), a_data.get("current_value"),
                    a_data.get("purchase_exchange_rate"), a_data.get("notes"), int(a_data.get("is_active", True)),
                )
                conn.execute(
                    "INSERT INTO assets(id,portfolio_id,category_id,name,ticker,asset_type,quantity,average_price,currency,current_value,purchase_exchange_rate,notes,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) "
                    "ON CONFLICT(id) DO UPDATE SET portfolio_id=excluded.portfolio_id,category_id=excluded.category_id,name=excluded.name,ticker=excluded.ticker,asset_type=excluded.asset_type,quantity=excluded.quantity,average_price=excluded.average_price,currency=excluded.currency,current_value=excluded.current_value,purchase_exchange_rate=excluded.purchase_exchange_rate,notes=excluded.notes,is_active=excluded.is_active,updated_at=CURRENT_TIMESTAMP",
                    values,
                )
                if source_key:
                    asset_map[source_key] = asset_id
                stats["assets_created"] += 1

            plan_map: dict[str, str] = {}
            plan_name_map: dict[str, str] = {}
            for plan_data in plans_data:
                source_key = plan_data.get("_plan_key")
                plan_id = source_key or str(uuid4())
                portfolio_id = portfolio_map.get(plan_data.get("_portfolio_key")) or name_map.get(plan_data.get("_portfolio_name")) or next(iter(portfolio_map.values()), next(iter(name_map.values())))
                plan_name = plan_data.get("name", "가져온 플랜")
                conn.execute(
                    "INSERT INTO rebalance_plans(id,portfolio_id,name,description,strategy_prompt,is_main,is_active) VALUES (?,?,?,?,?,?,?) "
                    "ON CONFLICT(id) DO UPDATE SET portfolio_id=excluded.portfolio_id,name=excluded.name,description=excluded.description,strategy_prompt=excluded.strategy_prompt,is_main=excluded.is_main,is_active=excluded.is_active,updated_at=CURRENT_TIMESTAMP",
                    (plan_id, portfolio_id, plan_name, plan_data.get("description"), plan_data.get("strategy_prompt"), int(plan_data.get("is_main", False)), int(plan_data.get("is_active", True))),
                )
                if source_key:
                    plan_map[source_key] = plan_id
                plan_name_map[plan_name] = plan_id
                stats["plans_created"] += 1

            for alloc_data in allocations_data:
                plan_id = plan_map.get(alloc_data.get("_plan_key")) or plan_name_map.get(alloc_data.get("_plan_name"))
                if not plan_id:
                    continue
                allocation_id = alloc_data.get("_allocation_key") or str(uuid4())
                asset_id = asset_map.get(alloc_data.get("asset_id")) or alloc_data.get("asset_id")
                conn.execute(
                    "INSERT INTO plan_allocations(id,plan_id,asset_id,ticker,target_percentage,display_name,alias,absolute_band,relative_band) VALUES (?,?,?,?,?,?,?,?,?) "
                    "ON CONFLICT(id) DO UPDATE SET plan_id=excluded.plan_id,asset_id=excluded.asset_id,ticker=excluded.ticker,target_percentage=excluded.target_percentage,display_name=excluded.display_name,alias=excluded.alias,absolute_band=excluded.absolute_band,relative_band=excluded.relative_band,updated_at=CURRENT_TIMESTAMP",
                    (allocation_id, plan_id, asset_id, alloc_data.get("ticker"), alloc_data.get("target_percentage", 0), alloc_data.get("display_name"), alloc_data.get("alias"), alloc_data.get("absolute_band"), alloc_data.get("relative_band")),
                )
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
        "supported_versions": ["1.0.0", "1.1.0"],
        "fields": {
            "portfolios": ["name", "description", "base_currency", "target_value"],
            "assets": ["name", "ticker", "asset_type", "quantity", "average_price", "currency", "current_value", "purchase_exchange_rate", "notes", "is_active"],
            "rebalance_plans": ["name", "description", "strategy_prompt", "is_main", "is_active"],
            "plan_allocations": ["ticker", "target_percentage"]
        }
    }
