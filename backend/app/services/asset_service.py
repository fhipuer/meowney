"""
Asset Service - 자산 관리 비즈니스 로직 냥~ 🐱
"""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from typing import Optional, Any

from supabase import Client

from app.models.schemas import (
    AssetCreate,
    AssetUpdate,
    DashboardSummary,
    CategoryAllocation,
    AssetHistoryResponse,
    RebalanceTarget,
    RebalanceResponse,
    RebalanceSuggestion,
)
from app.config import settings


class AssetService:
    """
    자산 관리 서비스 냥~ 🐱
    DB 조회 및 비즈니스 로직 담당
    """

    def __init__(self, db: Client):
        self.db = db

    async def _get_default_portfolio_id(self) -> UUID:
        """기본 포트폴리오 ID 조회"""
        result = self.db.table("portfolios").select("id").limit(1).execute()
        if result.data:
            return UUID(result.data[0]["id"])
        raise ValueError("기본 포트폴리오가 없다옹! DB 초기화 필요 🙀")

    async def get_assets(
        self,
        portfolio_id: Optional[UUID] = None,
        include_inactive: bool = False,
    ) -> list[dict]:
        """
        자산 목록 조회 냥~
        카테고리 정보도 함께 조인
        """
        if not portfolio_id:
            portfolio_id = await self._get_default_portfolio_id()

        query = (
            self.db.table("assets")
            .select("*, asset_categories(name, color, icon)")
            .eq("portfolio_id", str(portfolio_id))
        )

        if not include_inactive:
            query = query.eq("is_active", True)

        result = query.order("created_at", desc=False).execute()

        # 카테고리 정보 평탄화
        assets = []
        for row in result.data:
            asset = dict(row)
            category = asset.pop("asset_categories", None)
            if category:
                asset["category_name"] = category.get("name")
                asset["category_color"] = category.get("color")
                asset["category_icon"] = category.get("icon")
            assets.append(asset)

        return assets

    async def get_asset(self, asset_id: UUID) -> Optional[dict]:
        """특정 자산 조회"""
        result = (
            self.db.table("assets")
            .select("*, asset_categories(name, color, icon)")
            .eq("id", str(asset_id))
            .single()
            .execute()
        )

        if result.data:
            asset = dict(result.data)
            category = asset.pop("asset_categories", None)
            if category:
                asset["category_name"] = category.get("name")
                asset["category_color"] = category.get("color")
            return asset
        return None

    async def create_asset(self, data: AssetCreate) -> dict:
        """새 자산 생성 냥~"""
        portfolio_id = data.portfolio_id
        if not portfolio_id:
            portfolio_id = await self._get_default_portfolio_id()

        insert_data = {
            "portfolio_id": str(portfolio_id),
            "name": data.name,
            "ticker": data.ticker,
            "asset_type": data.asset_type,
            "quantity": str(data.quantity),
            "average_price": str(data.average_price),
            "currency": data.currency,
            "notes": data.notes,
        }

        if data.category_id:
            insert_data["category_id"] = str(data.category_id)
        if data.current_value is not None:
            insert_data["current_value"] = str(data.current_value)

        result = self.db.table("assets").insert(insert_data).execute()
        return result.data[0]

    async def update_asset(self, asset_id: UUID, data: AssetUpdate) -> Optional[dict]:
        """자산 정보 수정 냥~"""
        update_data = data.model_dump(exclude_unset=True)

        # Decimal -> str 변환 냥~
        for key in ["quantity", "average_price", "current_value", "purchase_exchange_rate"]:
            if key in update_data and update_data[key] is not None:
                update_data[key] = str(update_data[key])

        if "category_id" in update_data and update_data["category_id"]:
            update_data["category_id"] = str(update_data["category_id"])

        result = (
            self.db.table("assets")
            .update(update_data)
            .eq("id", str(asset_id))
            .execute()
        )

        return result.data[0] if result.data else None

    async def soft_delete_asset(self, asset_id: UUID) -> bool:
        """자산 비활성화 (소프트 삭제)"""
        result = (
            self.db.table("assets")
            .update({"is_active": False})
            .eq("id", str(asset_id))
            .execute()
        )
        return len(result.data) > 0

    async def hard_delete_asset(self, asset_id: UUID) -> bool:
        """자산 완전 삭제"""
        result = (
            self.db.table("assets")
            .delete()
            .eq("id", str(asset_id))
            .execute()
        )
        return len(result.data) > 0

    async def calculate_summary(
        self,
        enriched_assets: list[dict],
        portfolio_id: Optional[UUID] = None,
        exchange_rate: Optional[Decimal] = None,
    ) -> DashboardSummary:
        """
        대시보드 요약 계산 냥~ 🐱
        USD 자산은 전달받은 환율로 원화 환산하여 합산

        Args:
            enriched_assets: 현재가가 포함된 자산 목록 (finance_service에서 이미 원화 환산됨)
            portfolio_id: 포트폴리오 ID
            exchange_rate: USD/KRW 현재 환율 (폴백용)
        """
        # 기본 환율 설정 (settings에서 가져옴)
        current_rate = exchange_rate if exchange_rate else Decimal(str(settings.default_usd_krw_rate))

        total_value = Decimal("0")
        total_principal = Decimal("0")
        category_totals: dict[str, dict] = {}
        unavailable_asset_count = 0
        stale_asset_count = 0

        for asset in enriched_assets:
            # finance_service.enrich_assets_with_prices()에서 이미 원화 환산된 market_value 사용
            market_value_raw = asset.get("market_value")
            if market_value_raw is None:
                unavailable_asset_count += 1
                continue
            market_value = Decimal(str(market_value_raw))
            if asset.get("price_status") == "stale":
                stale_asset_count += 1
            quantity = Decimal(str(asset.get("quantity", 0)))
            avg_price = Decimal(str(asset.get("average_price", 0)))
            currency = asset.get("currency", "KRW")

            # 단일 평가 엔진이 계산한 원화 원금을 최우선으로 사용한다.
            if asset.get("cost_basis_krw") is not None:
                principal = Decimal(str(asset["cost_basis_krw"]))
            elif asset.get("asset_type") == "cash":
                principal = market_value
            elif currency == "USD":
                # 매수시점 환율, 없으면 현재 환율로 폴백
                purchase_rate = asset.get("purchase_exchange_rate")
                if purchase_rate:
                    purchase_rate = Decimal(str(purchase_rate))
                else:
                    purchase_rate = current_rate
                principal = quantity * avg_price * purchase_rate
            else:
                principal = quantity * avg_price

            total_value += market_value
            total_principal += principal

            # 카테고리별 집계
            cat_name = asset.get("category_name", "기타")
            cat_color = asset.get("category_color", "#6b7280")
            cat_id = asset.get("category_id")

            if cat_name not in category_totals:
                category_totals[cat_name] = {
                    "category_id": cat_id,
                    "color": cat_color,
                    "market_value": Decimal("0"),
                }
            category_totals[cat_name]["market_value"] += market_value

        # 수익률 계산
        total_profit = total_value - total_principal
        profit_rate = float((total_profit / total_principal * 100)) if total_principal > 0 else 0.0

        # 카테고리별 비율 계산
        allocations = []
        for cat_name, data in category_totals.items():
            percentage = float((data["market_value"] / total_value * 100)) if total_value > 0 else 0.0
            allocations.append(
                CategoryAllocation(
                    category_id=UUID(data["category_id"]) if data["category_id"] else None,
                    category_name=cat_name,
                    color=data["color"],
                    market_value=data["market_value"],
                    percentage=round(percentage, 2),
                )
            )

        # 비율 내림차순 정렬
        allocations.sort(key=lambda x: x.percentage, reverse=True)

        return DashboardSummary(
            total_value=total_value,
            total_principal=total_principal,
            total_profit=total_profit,
            profit_rate=round(profit_rate, 2),
            valuation_complete=unavailable_asset_count == 0,
            unavailable_asset_count=unavailable_asset_count,
            stale_asset_count=stale_asset_count,
            asset_count=len(enriched_assets),
            allocations=allocations,
            last_updated=datetime.now(),
        )

    async def get_asset_history(
        self,
        portfolio_id: Optional[UUID],
        start_date: date,
        end_date: date,
        limit: int = 30,
    ) -> list[dict]:
        """자산 히스토리 조회 (날짜 오름차순)"""
        if not portfolio_id:
            portfolio_id = await self._get_default_portfolio_id()

        result = (
            self.db.table("asset_history")
            .select("*")
            .eq("portfolio_id", str(portfolio_id))
            .gte("snapshot_date", start_date.isoformat())
            .lte("snapshot_date", end_date.isoformat())
            .order("snapshot_date", desc=False)
            .limit(limit)
            .execute()
        )

        # Decimal 변환
        history = []
        for row in result.data:
            item = dict(row)
            for key in ["total_value", "total_principal", "total_profit"]:
                if item.get(key):
                    item[key] = Decimal(str(item[key]))
            history.append(item)

        return history

    async def get_annual_asset_change(
        self,
        portfolio_id: Optional[UUID],
        current_value: Decimal,
        as_of: Optional[date] = None,
    ) -> tuple[Optional[float], Optional[Decimal], Optional[date]]:
        """연초에 가장 가까운 스냅샷 대비 현재 총자산 증감률을 계산한다."""
        if not portfolio_id:
            portfolio_id = await self._get_default_portfolio_id()

        as_of = as_of or date.today()
        year_start = date(as_of.year, 1, 1)
        search_start = date(as_of.year - 1, 12, 1)
        search_end = as_of

        result = (
            self.db.table("asset_history")
            .select("snapshot_date,total_value")
            .eq("portfolio_id", str(portfolio_id))
            .gte("snapshot_date", search_start.isoformat())
            .lte("snapshot_date", search_end.isoformat())
            .execute()
        )

        candidates = result.data or []
        if not candidates:
            return None, None, None

        baseline = min(
            candidates,
            key=lambda row: (
                abs((date.fromisoformat(row["snapshot_date"]) - year_start).days),
                date.fromisoformat(row["snapshot_date"]),
            ),
        )
        baseline_value = Decimal(str(baseline["total_value"]))
        baseline_date = date.fromisoformat(baseline["snapshot_date"])
        if baseline_value == 0:
            return None, baseline_value, baseline_date

        change_rate = (current_value - baseline_value) / baseline_value * 100
        return round(float(change_rate), 2), baseline_value, baseline_date

    async def save_snapshot(self, portfolio_id: UUID, summary: DashboardSummary) -> dict:
        """
        일일 스냅샷 저장 냥~ 🐱
        스케줄러에서 호출
        """
        today = date.today()

        # 카테고리별 금액 JSON
        category_breakdown = {
            alloc.category_name: float(alloc.market_value)
            for alloc in summary.allocations
        }

        snapshot_data = {
            "portfolio_id": str(portfolio_id),
            "snapshot_date": today.isoformat(),
            "total_value": str(summary.total_value),
            "total_principal": str(summary.total_principal),
            "total_profit": str(summary.total_profit),
            "profit_rate": summary.profit_rate,
            "category_breakdown": category_breakdown,
        }

        # UPSERT (같은 날짜면 업데이트)
        result = (
            self.db.table("asset_history")
            .upsert(snapshot_data, on_conflict="portfolio_id,snapshot_date")
            .execute()
        )

        return result.data[0] if result.data else {}

    async def calculate_rebalance(
        self,
        enriched_assets: list[dict],
        targets: list[RebalanceTarget],
    ) -> RebalanceResponse:
        """
        리밸런싱 계산 냥~ 🐱
        목표 비율에 맞추기 위한 매수/매도 금액 계산
        """
        # 총 자산가치 계산
        total_value = sum(
            Decimal(str(asset.get("market_value", 0)))
            for asset in enriched_assets
        )

        # 현재 카테고리별 금액 집계
        current_by_category: dict[str, Decimal] = {}
        category_names: dict[str, str] = {}  # category_id -> name 매핑

        for asset in enriched_assets:
            cat_id = asset.get("category_id")
            cat_name = asset.get("category_name", "기타")
            market_value = Decimal(str(asset.get("market_value", 0)))

            if cat_id:
                current_by_category[cat_id] = current_by_category.get(cat_id, Decimal("0")) + market_value
                category_names[cat_id] = cat_name

        # 리밸런싱 제안 생성
        suggestions = []
        for target in targets:
            cat_id = str(target.category_id)
            current_value = current_by_category.get(cat_id, Decimal("0"))
            current_pct = float(current_value / total_value * 100) if total_value > 0 else 0.0
            target_pct = target.target_percentage

            diff_pct = target_pct - current_pct
            suggested_amount = total_value * Decimal(str(diff_pct / 100))

            suggestions.append(
                RebalanceSuggestion(
                    category_name=category_names.get(cat_id, "알 수 없음"),
                    current_value=current_value,
                    current_percentage=round(current_pct, 2),
                    target_percentage=target_pct,
                    difference_percentage=round(diff_pct, 2),
                    suggested_amount=suggested_amount,
                )
            )

        return RebalanceResponse(
            total_value=total_value,
            suggestions=suggestions,
        )

    async def get_all_portfolio_ids(self) -> list[UUID]:
        """모든 포트폴리오 ID 조회 (스케줄러용)"""
        result = self.db.table("portfolios").select("id").execute()
        return [UUID(row["id"]) for row in result.data]

    async def get_portfolio(self, portfolio_id: Optional[UUID] = None) -> dict:
        """포트폴리오 정보 조회 냥~"""
        if not portfolio_id:
            portfolio_id = await self._get_default_portfolio_id()

        result = (
            self.db.table("portfolios")
            .select("*")
            .eq("id", str(portfolio_id))
            .single()
            .execute()
        )

        return result.data if result.data else {}

    async def update_portfolio(
        self,
        portfolio_id: UUID,
        update_data: dict,
    ) -> dict:
        """포트폴리오 정보 수정 냥~"""
        result = (
            self.db.table("portfolios")
            .update(update_data)
            .eq("id", str(portfolio_id))
            .execute()
        )

        return result.data[0] if result.data else {}

    async def get_target_allocations(self, portfolio_id: Optional[UUID] = None) -> list[dict]:
        """[DEPRECATED] 레거시 목표 배분 조회 냥~

        주의: 이 메서드는 폐기 예정입니다.
        대신 RebalanceService.get_main_plan()을 사용하세요.
        """
        import warnings
        warnings.warn(
            "get_target_allocations is deprecated. Use RebalanceService.get_main_plan() instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        if not portfolio_id:
            portfolio_id = await self._get_default_portfolio_id()

        try:
            result = (
                self.db.table("target_allocations")
                .select("*, asset_categories(name)")
                .eq("portfolio_id", str(portfolio_id))
                .execute()
            )
        except Exception:
            # 테이블이 폐기된 경우 빈 목록 반환
            return []

        # 카테고리명 평탄화
        allocations = []
        for row in result.data:
            allocation = dict(row)
            category = allocation.pop("asset_categories", None)
            if category:
                allocation["category_name"] = category.get("name")
            allocations.append(allocation)

        return allocations

    async def save_target_allocations(
        self,
        portfolio_id: UUID,
        targets: list[dict],
    ) -> list[dict]:
        """[DEPRECATED] 레거시 목표 배분 저장 냥~

        주의: 이 메서드는 폐기 예정입니다.
        대신 RebalanceService의 플랜 기반 배분을 사용하세요.
        """
        import warnings
        warnings.warn(
            "save_target_allocations is deprecated. Use RebalanceService plan-based allocation instead.",
            DeprecationWarning,
            stacklevel=2,
        )

        upsert_data = [
            {
                "portfolio_id": str(portfolio_id),
                "category_id": str(target["category_id"]),
                "target_percentage": target["target_percentage"],
            }
            for target in targets
        ]

        try:
            result = (
                self.db.table("target_allocations")
                .upsert(upsert_data, on_conflict="portfolio_id,category_id")
                .execute()
            )
            return result.data
        except Exception:
            # 테이블이 폐기된 경우 빈 목록 반환
            return []
