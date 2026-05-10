from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.db import get_db
from app.security import get_current_user
from app.services.usage import count_usage_today, get_daily_limit

router = APIRouter(prefix="/usage", tags=["usage"])


class UsageResponse(BaseModel):
    used_today: int
    remaining_today: int
    limit: int


class UsageBucket(BaseModel):
    timestamp: str
    count: int


class UsageHistoryResponse(BaseModel):
    buckets: list[UsageBucket]
    total: int


@router.get("/today", response_model=UsageResponse)
def usage_today(current_user=Depends(get_current_user)):
    daily_limit = get_daily_limit(current_user["plan"])

    with get_db() as connection:
        used_today = count_usage_today(connection, current_user["user_id"])

    return UsageResponse(
        used_today=used_today,
        remaining_today=max(0, daily_limit - used_today),
        limit=daily_limit,
    )


@router.get("/history", response_model=UsageHistoryResponse)
def usage_history(
    range: str = Query("24h", pattern="^(24h|7d)$"),
    current_user=Depends(get_current_user),
):
    with get_db() as connection:
        with connection.cursor() as cursor:
            if range == "7d":
                cursor.execute(
                    """
                    SELECT TO_CHAR(occurred_at, 'YYYY-MM-DD') AS timestamp,
                           COUNT(*) AS count
                    FROM usage_logs
                    WHERE user_id = %s
                      AND occurred_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                    GROUP BY TO_CHAR(occurred_at, 'YYYY-MM-DD')
                    ORDER BY timestamp
                    """,
                    (current_user["user_id"],),
                )
            else:
                cursor.execute(
                    """
                    SELECT TO_CHAR(occurred_at, 'YYYY-MM-DD HH24:00') AS timestamp,
                           COUNT(*) AS count
                    FROM usage_logs
                    WHERE user_id = %s
                      AND occurred_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                    GROUP BY TO_CHAR(occurred_at, 'YYYY-MM-DD HH24:00')
                    ORDER BY timestamp
                    """,
                    (current_user["user_id"],),
                )

            rows = cursor.fetchall()
            total = sum(row["count"] for row in rows)
            buckets = [UsageBucket(timestamp=row["timestamp"], count=row["count"]) for row in rows]

    return UsageHistoryResponse(buckets=buckets, total=total)
