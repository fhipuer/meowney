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
        plans = response.data or []

        # 각 플랜의 필드명 정리 및 그룹 정보 추가
        for plan in plans:
            # plan_allocations -> allocations 키 변환
            plan["allocations"] = plan.pop("plan_allocations", [])
            plan["groups"] = await self.get_groups(UUID(plan["id"]))

        return plans

    async def get_plan(self, plan_id: UUID) -> Optional[dict]:
        """플랜 상세 조회 냥~"""
        response = (
            self.supabase.table("rebalance_plans")
            .select("*, plan_allocations(*)")
            .eq("id", str(plan_id))
            .execute()
        )
        if not response.data:
            return None

        plan = response.data[0]
        # plan_allocations -> allocations 키 변환
        plan["allocations"] = plan.pop("plan_allocations", [])
        plan["groups"] = await self.get_groups(plan_id)
        return plan

    async def get_main_plan(self, portfolio_id: Optional[UUID] = None) -> Optional[dict]:
        """메인 플랜 조회 냥~"""
        query = self.supabase.table("rebalance_plans").select(
            "*, plan_allocations(*)"
        ).eq("is_main", True).eq("is_active", True)

        if portfolio_id:
            query = query.eq("portfolio_id", str(portfolio_id))

        response = query.limit(1).execute()
        if response.data:
            plan = response.data[0]
            portfolio_id = UUID(plan["portfolio_id"])
            # plan_allocations -> allocations 키 변환 (current_value 포함)
            allocations = plan.pop("plan_allocations", [])
            plan["allocations"] = await self.get_allocations_with_values(
                allocations, portfolio_id
            )
            # groups도 조회해서 추가 (current_value 포함) 냥~
            plan["groups"] = await self.get_groups_with_values(
                UUID(plan["id"]), portfolio_id
            )
            return plan
        return None

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
            "strategy_prompt": data.get("strategy_prompt"),
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
        if "strategy_prompt" in data:
            update_data["strategy_prompt"] = data["strategy_prompt"]
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
            if alloc.get("alias"):
                item["alias"] = alloc["alias"]
            if alloc.get("display_name"):
                item["display_name"] = alloc["display_name"]
            if alloc.get("absolute_band") is not None:
                item["absolute_band"] = alloc["absolute_band"]
            if alloc.get("relative_band") is not None:
                item["relative_band"] = alloc["relative_band"]
            allocation_data.append(item)

        response = self.supabase.table("plan_allocations").insert(allocation_data).execute()
        return response.data or []

    # ============================================
    # 배분 그룹 관련 메서드 냥~
    # ============================================

    async def get_groups(self, plan_id: UUID) -> list[dict]:
        """플랜의 배분 그룹 목록 조회 냥~"""
        response = (
            self.supabase.table("allocation_groups")
            .select("*, allocation_group_items(*)")
            .eq("plan_id", str(plan_id))
            .order("display_order")
            .execute()
        )
        groups = response.data or []

        # 그룹 아이템 키 이름 정리
        for group in groups:
            group["items"] = group.pop("allocation_group_items", [])

        return groups

    async def get_groups_with_values(
        self, plan_id: UUID, portfolio_id: UUID
    ) -> list[dict]:
        """플랜의 배분 그룹 목록 조회 (current_value 포함) 냥~"""
        from app.services.asset_service import AssetService

        # 기존 그룹 조회
        groups = await self.get_groups(plan_id)
        if not groups:
            return groups

        # 자산 데이터 조회
        asset_service = AssetService(self.supabase)
        assets = await asset_service.get_assets(portfolio_id=portfolio_id)
        if not assets:
            # 자산이 없으면 모든 그룹의 current_value를 0으로 설정
            for group in groups:
                group["current_value"] = 0.0
                group["current_percentage"] = 0.0
            return groups

        # 자산 시가 계산
        total_value, asset_values = await self._get_asset_values(assets)

        # 각 그룹의 current_value 계산
        for group in groups:
            group_value = Decimal("0")
            for item in group.get("items", []):
                matched_asset = self.match_item_to_asset(item, assets)
                if matched_asset:
                    asset_data = asset_values.get(str(matched_asset["id"]))
                    if asset_data:
                        group_value += asset_data["market_value"]

            group["current_value"] = float(group_value)
            group["current_percentage"] = (
                float(group_value / total_value * 100) if total_value > 0 else 0.0
            )

        return groups

    async def get_allocations_with_values(
        self, allocations: list[dict], portfolio_id: UUID
    ) -> list[dict]:
        """개별 배분 항목에 current_value 추가 냥~"""
        from app.services.asset_service import AssetService

        if not allocations:
            return allocations

        # 자산 데이터 조회
        asset_service = AssetService(self.supabase)
        assets = await asset_service.get_assets(portfolio_id=portfolio_id)
        if not assets:
            for alloc in allocations:
                alloc["current_value"] = 0.0
                alloc["current_percentage"] = 0.0
            return allocations

        # 자산 시가 계산
        total_value, asset_values = await self._get_asset_values(assets)

        # 각 배분 항목의 current_value 계산
        for alloc in allocations:
            matched_asset = self.match_item_to_asset(alloc, assets)
            current_value = Decimal("0")

            if matched_asset:
                asset_data = asset_values.get(str(matched_asset["id"]))
                if asset_data:
                    current_value = asset_data["market_value"]
                alloc["matched_asset_name"] = matched_asset.get("name")

            alloc["current_value"] = float(current_value)
            alloc["current_percentage"] = (
                float(current_value / total_value * 100) if total_value > 0 else 0.0
            )

        return allocations

    async def save_groups(self, plan_id: UUID, groups: list[dict]) -> list[dict]:
        """배분 그룹 저장 냥~"""
        # 기존 그룹 삭제 (CASCADE로 아이템도 삭제됨)
        self.supabase.table("allocation_groups").delete().eq(
            "plan_id", str(plan_id)
        ).execute()

        if not groups:
            return []

        saved_groups = []
        for idx, group in enumerate(groups):
            # 그룹 생성
            group_data = {
                "plan_id": str(plan_id),
                "name": group["name"],
                "target_percentage": group["target_percentage"],
                "display_order": group.get("display_order", idx),
            }
            group_response = self.supabase.table("allocation_groups").insert(group_data).execute()
            saved_group = group_response.data[0]

            # 그룹 아이템 생성 (weight 없이 단순 소속 관계만)
            items = group.get("items", [])
            saved_items = []
            if items:
                items_data = []
                for item in items:
                    item_data = {
                        "group_id": saved_group["id"],
                        # weight는 더 이상 사용하지 않음 냥~
                    }
                    if item.get("asset_id"):
                        item_data["asset_id"] = str(item["asset_id"])
                    if item.get("ticker"):
                        item_data["ticker"] = item["ticker"]
                    if item.get("alias"):
                        item_data["alias"] = item["alias"]
                    items_data.append(item_data)

                items_response = self.supabase.table("allocation_group_items").insert(items_data).execute()
                saved_items = items_response.data or []

            saved_group["items"] = saved_items
            saved_groups.append(saved_group)

        return saved_groups

    # ============================================
    # 매칭 로직 냥~
    # ============================================

    def match_item_to_asset(self, item: dict, assets: list[dict]) -> Optional[dict]:
        """배분 항목을 실제 자산에 매칭 냥~

        매칭 우선순위:
        1. asset_id - 직접 참조
        2. ticker - 티커 매칭
        3. alias - 이름 기반 fuzzy match
        """
        # 1. asset_id 매칭
        if item.get("asset_id"):
            asset_id = str(item["asset_id"])
            for asset in assets:
                if str(asset.get("id")) == asset_id:
                    return asset

        # 2. ticker 매칭
        if item.get("ticker"):
            ticker = item["ticker"]
            for asset in assets:
                if asset.get("ticker") == ticker:
                    return asset

            # 2-1. ticker 값이 실제로는 name일 수 있음 (사용자 입력 오류 대응)
            # 예: 사용자가 그룹 아이템에 '국내 금현물'을 ticker로 입력
            for asset in assets:
                if asset.get("name") == ticker:
                    return asset

        # 3. alias 매칭 (이름 포함 검사)
        if item.get("alias"):
            alias_lower = item["alias"].lower()
            for asset in assets:
                asset_name = asset.get("name", "").lower()
                if alias_lower in asset_name or asset_name in alias_lower:
                    return asset

        return None

    async def _get_asset_values(
        self, assets: list[dict]
    ) -> tuple[Decimal, dict[str, dict]]:
        """자산들의 현재가 및 시장 가치 계산 냥~"""
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

            # 키를 문자열로 통일 (UUID 객체 대응) 냥~
            asset_id_str = str(asset["id"])
            asset_values[asset_id_str] = {
                "asset": asset,
                "market_value": market_value,
                "current_price": current_price,
            }
            total_value += market_value

        return total_value, asset_values

    async def calculate_rebalance_by_plan(
        self, plan_id: UUID, portfolio_id: Optional[UUID] = None
    ) -> dict:
        """플랜 기준 리밸런싱 계산 냥~"""
        from app.services.asset_service import AssetService

        # 플랜 조회
        plan = await self.get_plan(plan_id)
        if not plan:
            raise ValueError("플랜을 찾을 수 없다옹! 🙀")

        allocations = plan.get("allocations", [])
        groups = plan.get("groups", [])

        if not allocations and not groups:
            return {
                "plan_id": str(plan_id),
                "plan_name": plan["name"],
                "total_value": Decimal("0"),
                "suggestions": [],
                "group_suggestions": [],
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
                "group_suggestions": [],
            }

        # 자산 가치 계산
        total_value, asset_values = await self._get_asset_values(assets)

        # user_settings에서 기본 밴드값 조회 냥~
        DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"
        settings_result = self.supabase.table("user_settings").select(
            "default_absolute_band,default_relative_band"
        ).eq("user_id", DEFAULT_USER_ID).execute()
        settings_row = settings_result.data[0] if settings_result.data else {}
        default_abs_band = Decimal(str(settings_row.get("default_absolute_band") or 5))
        default_rel_band = Decimal(str(settings_row.get("default_relative_band") or 25))

        # 개별 배분 제안 계산
        suggestions = []
        for alloc in allocations:
            suggestion = await self._calculate_allocation_suggestion(
                alloc, assets, asset_values, total_value,
                default_abs_band, default_rel_band
            )
            suggestions.append(suggestion)

        # 그룹 배분 제안 계산
        group_suggestions = []
        for group in groups:
            group_suggestion = await self._calculate_group_suggestion(
                group, assets, asset_values, total_value,
                default_abs_band, default_rel_band
            )
            group_suggestions.append(group_suggestion)

        return {
            "plan_id": str(plan_id),
            "plan_name": plan["name"],
            "total_value": total_value,
            "suggestions": suggestions,
            "group_suggestions": group_suggestions,
        }

    async def _calculate_allocation_suggestion(
        self,
        alloc: dict,
        assets: list[dict],
        asset_values: dict,
        total_value: Decimal,
        default_absolute_band: Decimal = Decimal("5"),
        default_relative_band: Decimal = Decimal("25"),
    ) -> dict:
        """개별 배분 제안 계산 냥~"""
        target_pct = Decimal(str(alloc["target_percentage"]))
        target_value = total_value * target_pct / Decimal("100")

        # 매칭 로직 사용
        matched_asset = self.match_item_to_asset(alloc, assets)
        current_value = Decimal("0")

        if matched_asset:
            # 키를 문자열로 변환하여 조회 (UUID 객체 대응) 냥~
            asset_data = asset_values.get(str(matched_asset["id"]))
            if asset_data:
                current_value = asset_data["market_value"]

        current_pct = (
            (current_value / total_value * Decimal("100"))
            if total_value > 0
            else Decimal("0")
        )
        diff_pct = target_pct - current_pct
        suggested_amount = target_value - current_value

        # 5/25 밴드 계산: effective_band = min(절대, 목표 × 상대/100) 냥~
        abs_band = Decimal(str(alloc.get("absolute_band") or default_absolute_band))
        rel_band = Decimal(str(alloc.get("relative_band") or default_relative_band))
        effective_band = min(abs_band, target_pct * rel_band / Decimal("100"))
        if abs(diff_pct) <= effective_band:
            action = "hold"
        elif diff_pct > 0:
            action = "buy"
        else:
            action = "sell"

        # 매수/매도 수량 계산
        suggested_qty = None
        if matched_asset:
            # 키를 문자열로 변환하여 조회 냥~
            current_price = asset_values.get(str(matched_asset["id"]), {}).get("current_price")
            if current_price and current_price > 0:
                if matched_asset.get("currency") == "USD":
                    exchange_rate = await self.finance_service.get_exchange_rate()
                    suggested_qty = suggested_amount / (current_price * Decimal(str(exchange_rate)))
                else:
                    suggested_qty = suggested_amount / current_price

        # 표시명 결정
        display_name = alloc.get("display_name")
        if not display_name:
            if matched_asset:
                display_name = matched_asset["name"]
            elif alloc.get("ticker"):
                display_name = alloc["ticker"]
            elif alloc.get("alias"):
                display_name = alloc["alias"]
            else:
                display_name = "미확인 자산"

        return {
            "asset_id": matched_asset["id"] if matched_asset else None,
            "asset_name": display_name,
            "ticker": matched_asset.get("ticker") if matched_asset else alloc.get("ticker"),
            "alias": alloc.get("alias"),
            "current_value": current_value,
            "current_percentage": float(current_pct),
            "target_percentage": float(target_pct),
            "difference_percentage": float(diff_pct),
            "suggested_amount": suggested_amount,
            "suggested_quantity": suggested_qty,
            "is_matched": matched_asset is not None,
            "effective_band": float(effective_band),
            "action": action,
        }

    async def _calculate_group_suggestion(
        self,
        group: dict,
        assets: list[dict],
        asset_values: dict,
        total_value: Decimal,
        default_absolute_band: Decimal = Decimal("5"),
        default_relative_band: Decimal = Decimal("25"),
    ) -> dict:
        """그룹 배분 제안 계산 냥~ (단순화: weight 없이 합산만)"""
        target_pct = Decimal(str(group["target_percentage"]))
        target_value = total_value * target_pct / Decimal("100")

        items = group.get("items", [])
        group_current_value = Decimal("0")
        item_details = []

        # 그룹 내 모든 자산의 시가를 단순 합산
        for item in items:
            matched_asset = self.match_item_to_asset(item, assets)
            item_current_value = Decimal("0")
            asset_name = None

            if matched_asset:
                # 키를 문자열로 변환하여 조회 (UUID 객체 대응) 냥~
                asset_data = asset_values.get(str(matched_asset["id"]))
                if asset_data:
                    item_current_value = asset_data["market_value"]
                asset_name = matched_asset.get("name")

            group_current_value += item_current_value

            # 아이템 정보만 기록 (개별 목표 없음)
            item_details.append({
                "asset_id": matched_asset["id"] if matched_asset else None,
                "asset_name": asset_name,
                "ticker": item.get("ticker"),
                "alias": item.get("alias"),
                "current_value": item_current_value,
                "is_matched": matched_asset is not None,
            })

        current_pct = (
            (group_current_value / total_value * Decimal("100"))
            if total_value > 0
            else Decimal("0")
        )

        # 그룹에도 5/25 밴드 적용 냥~
        effective_band = min(default_absolute_band, target_pct * default_relative_band / Decimal("100"))
        diff_pct = target_pct - current_pct
        if abs(diff_pct) <= effective_band:
            action = "hold"
        elif diff_pct > 0:
            action = "buy"
        else:
            action = "sell"

        return {
            "group_id": group.get("id"),
            "group_name": group["name"],
            "target_percentage": float(target_pct),
            "current_percentage": float(current_pct),
            "current_value": group_current_value,
            "target_value": target_value,
            "suggested_amount": target_value - group_current_value,
            "items": item_details,
            "effective_band": float(effective_band),
            "action": action,
        }
