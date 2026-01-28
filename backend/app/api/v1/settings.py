"""
사용자 설정 API 냥~ 🐱
리밸런싱 허용 오차 등 사용자 설정 관리
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException

from app.api.deps import SupabaseDep
from app.models.schemas import UserSettingsResponse, UserSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

# 단일 사용자 고정 ID 냥~
DEFAULT_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


@router.get("", response_model=UserSettingsResponse)
async def get_settings(db: SupabaseDep):
    """
    사용자 설정 조회 냥~ 🐱
    설정이 없으면 기본값으로 자동 생성
    """
    # 설정 조회
    result = db.table("user_settings").select("*").eq("user_id", str(DEFAULT_USER_ID)).execute()

    if result.data:
        return result.data[0]

    # 설정이 없으면 기본값으로 생성
    new_settings = {
        "user_id": str(DEFAULT_USER_ID),
        "alert_threshold": 5.0,
        "calculator_tolerance": 5.0,
    }

    insert_result = db.table("user_settings").insert(new_settings).execute()

    if not insert_result.data:
        raise HTTPException(status_code=500, detail="냥? 설정 생성에 실패했다옹! 🙀")

    return insert_result.data[0]


@router.put("", response_model=UserSettingsResponse)
async def update_settings(settings: UserSettingsUpdate, db: SupabaseDep):
    """
    사용자 설정 업데이트 냥~ 🐱
    """
    # 업데이트할 필드만 추출
    update_data = settings.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="냥? 변경할 설정이 없다옹!")

    # 설정이 없으면 먼저 생성
    existing = db.table("user_settings").select("id").eq("user_id", str(DEFAULT_USER_ID)).execute()

    if not existing.data:
        # 기본값으로 생성 후 업데이트
        new_settings = {
            "user_id": str(DEFAULT_USER_ID),
            "alert_threshold": 5.0,
            "calculator_tolerance": 5.0,
            **update_data,
        }
        result = db.table("user_settings").insert(new_settings).execute()
    else:
        # 기존 설정 업데이트
        result = (
            db.table("user_settings")
            .update(update_data)
            .eq("user_id", str(DEFAULT_USER_ID))
            .execute()
        )

    if not result.data:
        raise HTTPException(status_code=500, detail="냥? 설정 저장에 실패했다옹! 🙀")

    return result.data[0]
