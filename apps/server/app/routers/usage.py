from fastapi import APIRouter, Depends

from app.db import get_db
from app.schemas import UsageResponse
from app.security import get_current_user
from app.services.posts import HOURLY_POST_LIMIT, count_usage_this_hour

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/today", response_model=UsageResponse)
def usage_today(current_user=Depends(get_current_user)):
    with get_db() as connection:
        used_this_hour = count_usage_this_hour(connection, current_user["user_id"])

    return UsageResponse(
        used_today=used_this_hour,
        remaining_today=max(0, HOURLY_POST_LIMIT - used_this_hour),
        limit=HOURLY_POST_LIMIT,
    )
