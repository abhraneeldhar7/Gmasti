from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db import get_db
from app.security import get_current_user
from app.services.usage import DAILY_POST_LIMIT, count_usage_today

router = APIRouter(prefix="/usage", tags=["usage"])


class UsageResponse(BaseModel):
    used_today: int
    remaining_today: int
    limit: int


@router.get("/today", response_model=UsageResponse)
def usage_today(current_user=Depends(get_current_user)):
    with get_db() as connection:
        used_today = count_usage_today(connection, current_user["user_id"])

    return UsageResponse(
        used_today=used_today,
        remaining_today=max(0, DAILY_POST_LIMIT - used_today),
        limit=DAILY_POST_LIMIT,
    )
