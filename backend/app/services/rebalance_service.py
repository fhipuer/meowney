"""
리밸런싱 플랜 서비스 냥~ 🐱
플랜 관리 및 개별 자산 기준 리밸런싱 계산
"""
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.db.supabase import get_supabase_client
from app.services.finance_service import FinanceService


class RebalanceService:
    """리밸런싱 플랜 서비스 냥~"""

    def __init__(self):
        self.supabase = get_supabase_client()
        self.finance_service = FinanceService()

    async def get_plans(self, portfolio_id: Optional[UUID] = None) -> list[dict]:
        """플랜 목록 조회 냥~"""
        query = self.supabase.table("rebalance_plans").select(
            "*, plan_allocations(*)"
        ).eq("is_active", True)

        if portfolio_id:
            query = query.eq("portfolio_id", str(portfolio_id))

        response = query.order("created_at", desc=True).execute()
        return response.data or []

    async def get_plan(self, plan_id: UUID) -> Optional[dict]:
        """플랜 상세 조회 냥~"""
        response = (
            self.supabase.table("rebalance_plans")
            .select("*, plan_allocations(*)")
            .eq("id", str(plan_id))
            .single()
            .execute()
        )
        return response.data

    async def get_main_plan(self, portfolio_id: Optional[UUID] = None) -> Optional[dict]:
        """메인 플랜 조회 냥~"""
        query = self.supabase.table("rebalance_plans").select(
            "*, plan_allocations(*)"
        ).eq("is_main", True).eq("is_active", True)

        if portfolio_id:
            query = query.eq("portfolio_id", str(portfolio_id))

        response = query.limit(1).execute()
        return response.data[0] if response.data else None

    async def create_plan(self, data: dict) -> dict:
        """플랜 생성 냥~"""
        # 포트폴리오 ID 기본값 처리
        portfolio_id = data.get("portfolio_id")
        if not portfolio_id:
            # 기본 포트폴리오 조회
            portfolio_response = self.supabase.table("portfolios").select("id").limit(1).execute()
            if portfolio_response.data:
                portfolio_id = portfolio_response.data[0]["id"]
            else:
                raise ValueError("포트폴리오가 없다옹! 🙀")

        # 메인 플랜으로 설정하는 경우 기존 메인 플랜 해제
        if data.get("is_main"):
            await self._unset_main_plan(portfolio_id)

        # 플랜 생성
        plan_data = {
            "portfolio_id": str(portfolio_id),
            "name": data["name"],
            "description": data.get("description"),
            "is_main": data.get("is_main", False),
            "is_active": True,
        }

        response = self.supabase.table("rebalance_plans").insert(plan_data).execute()
        plan = response.data[0]

        # 배분 설정이 있으면 저장
        allocations = data.get("allocations", [])
        if allocations:
            await self.save_allocations(UUID(plan["id"]), allocations)

        return await self.get_plan(UUID(plan["id"]))

    async def update_plan(self, plan_id: UUID, data: dict) -> dict:
        """플랜 수정 냥~"""
        plan = await self.get_plan(plan_id)
        if not plan:
            raise ValueError("플랜을 찾을 수 없다옹! 🙀")

        # 메인 플랜으로 설정하는 경우 기존 메인 플랜 해제
        if data.get("is_main") and not plan.get("is_main"):
            await self._unset_main_plan(plan["portfolio_id"])

        update_data = {}
        if "name" in data:
            update_data["name"] = data["name"]
        if "description" in data:
            update_data["description"] = data["description"]
        if "is_main" in data:
            update_data["is_main"] = data["is_main"]
        if "is_active" in data:
            update_data["is_active"] = data["is_active"]

        if update_data:
            self.supabase.table("rebalance_plans").update(update_data).eq(
                "id", str(plan_id)
            ).execute()

        return await self.get_plan(plan_id)

    async def delete_plan(self, plan_id: UUID) -> bool:
        """플랜 삭제 (soft delete) 냥~"""
        self.supabase.table("rebalance_plans").update({"is_active": False}).eq(
            "id", str(plan_id)
        ).execute()
        return True

    async def set_main_plan(self, plan_id: UUID) -> dict:
        """메인 플랜 설정 냥~"""
        plan = await self.get_plan(plan_id)
        if not plan:
            raise ValueError("플랜을 찾을 수 없다옹! 🙀")

        # 기존 메인 플랜 해제
        await self._unset_main_plan(plan["portfolio_id"])

        # 새 메인 플랜 설정
        self.supabase.table("rebalance_plans").update({"is_main": True}).eq(
            "id", str(plan_id)
        ).execute()

        return await self.get_plan(plan_id)

    async def _unset_main_plan(self, portfolio_id: str):
        """기존 메인 플랜 해제 냥~"""
        self.supabase.table("rebalance_plans").update({"is_main": False}).eq(
            "portfolio_id", str(portfolio_id)
        ).eq("is_main", True).execute()

    async def save_allocations(
        self, plan_id: UUID, allocations: list[dict]
    ) -> list[dict]:
        """배분 설정 저장 냥~"""
        # 기존 배분 삭제
        self.supabase.table("plan_allocations").delete().eq(
            "plan_id", str(plan_id)
        ).execute()

        if not allocations:
            return []

        # 새 배분 삽입
        allocation_data = []
        for alloc in allocations:
            item = {
                "plan_id": str(plan_id),
                "target_percentage": alloc["target_percentage"],
            }
            if alloc.get("asset_id"):
                item["asset_id"] = str(alloc["asset_id"])
            if alloc.get("ticker"):
                item["ticker"] = alloc["ticker"]
            allocation_data.append(item)

        response = self.supabase.table("plan_allocations").insert(allocation_data).execute()
        return response.data or []

    async def calculate_rebalance_by_plan(
        self, plan_id: UUID, portfolio_id: Optional[UUID] = None
    ) -> dict:
        """플랜 기준 리밸런싱 계산 냥~"""
        from app.services.asset_service import AssetService

        # 플랜 조회
        plan = await self.get_plan(plan_id)
        if not plan:
            raise ValueError("플랜을 찾을 수 없다옹! 🙀")

        allocations = plan.get("plan_allocations", [])
        if not allocations:
            return {
                "plan_id": str(plan_id),
                "plan_name": plan["name"],
                "total_value": Decimal("0"),
                "suggestions": [],
            }

        # 현재 보유 자산 조회
        asset_service = AssetService(self.supabase)
        assets = await asset_service.get_assets(
            portfolio_id=portfolio_id or UUID(plan["portfolio_id"])
        )

        if not assets:
            return {
                "plan_id": str(plan_id),
                "plan_name": plan["name"],
                "total_value": Decimal("0"),
                "suggestions": [],
            }

        # 현재가 조회 및 시장 가치 계산
        total_value = Decimal("0")
        asset_values = {}

        for asset in assets:
            market_value = Decimal("0")
            current_price = None

            if asset.get("ticker"):
                price_data = await self.finance_service.get_stock_price(asset["ticker"])
                if price_data.get("current_price"):
                    current_price = Decimal(str(price_data["current_price"]))

                    # USD 자산의 경우 환율 적용
                    if asset.get("currency") == "USD":
                        exchange_rate = await self.finance_service.get_exchange_rate()
                        market_value = (
                            current_price
                            * Decimal(str(asset["quantity"]))
                            * Decimal(str(exchange_rate))
                        )
                    else:
                        market_value = current_price * Decimal(str(asset["quantity"]))
            elif asset.get("current_value"):
                market_value = Decimal(str(asset["current_value"]))

            asset_values[asset["id"]] = {
                "asset": asset,
                "market_value": market_value,
                "current_price": current_price,
            }
            total_value += market_value

        # 각 배분 목표에 대해 리밸런싱 제안 계산
        suggestions = []

        for alloc in allocations:
            target_pct = Decimal(str(alloc["target_percentage"]))
            target_value = total_value * target_pct / Decimal("100")

            # 해당하는 자산 찾기
            matched_asset = None
            current_value = Decimal("0")

            if alloc.get("asset_id"):
                asset_data = asset_values.get(alloc["asset_id"])
                if asset_data:
                    matched_asset = asset_data["asset"]
                    current_value = asset_data["market_value"]
            elif alloc.get("ticker"):
                # 티커로 매칭
                for asset_id, asset_data in asset_values.items():
                    if asset_data["asset"].get("ticker") == alloc["ticker"]:
                        matched_asset = asset_data["asset"]
                        current_value = asset_data["market_value"]
                        break

            current_pct = (
                (current_value / total_value * Decimal("100"))
                if total_value > 0
                else Decimal("0")
            )
            diff_pct = target_pct - current_pct
            suggested_amount = target_value - current_value

            # 매수/매도 수량 계산
            suggested_qty = None
            if matched_asset:
                current_price = asset_values.get(matched_asset["id"], {}).get(
                    "current_price"
                )
                if current_price and current_price > 0:
                    # USD 자산의 경우 환율 고려
                    if matched_asset.get("currency") == "USD":
                        exchange_rate = await self.finance_service.get_exchange_rate()
                        suggested_qty = suggested_amount / (
                            current_price * Decimal(str(exchange_rate))
                        )
                    else:
                        suggested_qty = suggested_amount / current_price

            suggestion = {
                "asset_id": matched_asset["id"] if matched_asset else None,
                "asset_name": matched_asset["name"] if matched_asset else (alloc.get("ticker") or "미확인 자산"),
                "ticker": matched_asset.get("ticker") if matched_asset else alloc.get("ticker"),
                "current_value": current_value,
                "current_percentage": float(current_pct),
                "target_percentage": float(target_pct),
                "difference_percentage": float(diff_pct),
                "suggested_amount": suggested_amount,
                "suggested_quantity": suggested_qty,
            }
            suggestions.append(suggestion)

        return {
            "plan_id": str(plan_id),
            "plan_name": plan["name"],
            "total_value": total_value,
            "suggestions": suggestions,
        }
