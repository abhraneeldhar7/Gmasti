import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.security import get_current_user
from app.schemas import UserResponse

router = APIRouter(prefix="/subscription", tags=["subscription"])


class CreateSubscriptionResponse(BaseModel):
    subscription_id: str
    razorpay_key_id: str


class CancelSubscriptionResponse(BaseModel):
    message: str


def _razorpay_auth() -> tuple[str, str]:
    return (settings.razorpay_key_id, settings.razorpay_key_secret)


@router.post("/create", response_model=CreateSubscriptionResponse)
def create_subscription(current_user=Depends(get_current_user)):
    if current_user["plan"] == "pro":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already on pro plan.",
        )

    payload = {
        "plan_id": settings.razorpay_plan_id,
        "total_count": 100,
        "customer_notify": 1,
        "notes": {
            "user_id": current_user["user_id"],
            "email": current_user["email"],
        },
    }

    with httpx.Client() as client:
        response = client.post(
            "https://api.razorpay.com/v1/subscriptions",
            json=payload,
            auth=_razorpay_auth(),
        )

    if response.status_code not in (200, 201):
        detail = response.json().get("error", {}).get("description", "Unknown error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Razorpay error: {detail}",
        )

    data = response.json()
    subscription_id = data["id"]

    with get_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE users
                SET razorpay_subscription_id = %s
                WHERE user_id = %s
                """,
                (subscription_id, current_user["user_id"]),
            )
        connection.commit()

    return CreateSubscriptionResponse(
        subscription_id=subscription_id,
        razorpay_key_id=settings.razorpay_key_id,
    )


@router.post("/cancel", response_model=CancelSubscriptionResponse)
def cancel_subscription(current_user=Depends(get_current_user)):
    sub_id = current_user["razorpay_subscription_id"]
    if not sub_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription found.",
        )

    with httpx.Client() as client:
        response = client.post(
            f"https://api.razorpay.com/v1/subscriptions/{sub_id}/cancel",
            auth=_razorpay_auth(),
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to cancel subscription with Razorpay.",
        )

    with get_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE users
                SET razorpay_cancel_at_period_end = TRUE
                WHERE user_id = %s
                """,
                (current_user["user_id"],),
            )
        connection.commit()

    return CancelSubscriptionResponse(
        message="Subscription will be cancelled at the end of the current billing period."
    )
