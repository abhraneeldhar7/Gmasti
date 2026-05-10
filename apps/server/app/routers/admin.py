from fastapi import APIRouter, Header, HTTPException, status

from app.config import settings
from app.db import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/cleanup")
def cleanup(x_cron_secret: str = Header(...)):
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cron secret.",
        )

    with get_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM usage_logs
                WHERE occurred_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
                """
            )
            deleted_logs = cursor.rowcount

            cursor.execute(
                """
                DELETE FROM posts
                WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
                """
            )
            deleted_posts = cursor.rowcount

        connection.commit()

    return {
        "deleted_usage_logs": deleted_logs,
        "deleted_posts": deleted_posts,
    }


@router.post("/downgrade-expired")
def downgrade_expired(x_cron_secret: str = Header(...)):
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cron secret.",
        )

    with get_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE users
                SET plan = 'free',
                    razorpay_subscription_id = NULL,
                    razorpay_current_period_end = NULL,
                    razorpay_cancel_at_period_end = FALSE
                WHERE plan = 'pro'
                  AND razorpay_cancel_at_period_end = TRUE
                  AND razorpay_current_period_end <= NOW()
                """
            )
            downgraded = cursor.rowcount
        connection.commit()

    return {"downgraded_users": downgraded}
