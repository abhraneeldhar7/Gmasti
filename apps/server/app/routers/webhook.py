import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.config import settings
from app.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhook"])

SUPPORTED_EVENTS = {
    "subscription.activated",
    "subscription.charged",
    "subscription.cancelled",
    "subscription.halted",
}


@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    secret = settings.razorpay_webhook_secret.encode("utf-8")
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()

    received_sig = signature
    if received_sig.startswith("sha256="):
        received_sig = received_sig[7:]

    logger.info(
        "Webhook: received_sig=%s... computed_sig=%s... match=%s body_len=%d",
        received_sig[:20] if received_sig else "(empty)",
        expected[:20],
        hmac.compare_digest(expected, received_sig),
        len(body),
    )

    if not hmac.compare_digest(expected, received_sig):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    payload = json.loads(body.decode("utf-8"))
    event = payload.get("event", "")
    logger.info("Received Razorpay webhook event: %s", event)

    if event not in SUPPORTED_EVENTS:
        return {"status": "ignored"}

    sub_payload = payload.get("payload", {}).get("subscription", {})
    entity = sub_payload.get("entity", {})
    subscription_id = entity.get("id", "")

    if not subscription_id:
        return {"status": "ignored", "reason": "no subscription id"}

    current_period_end = entity.get("current_end")

    with get_db() as connection:
        with connection.cursor() as cursor:
            if event in ("subscription.activated", "subscription.charged"):
                if current_period_end is not None:
                    cursor.execute(
                        """
                        UPDATE users
                        SET plan = 'pro',
                            razorpay_current_period_end = to_timestamp(%s),
                            razorpay_cancel_at_period_end = FALSE
                        WHERE razorpay_subscription_id = %s
                        """,
                        (current_period_end, subscription_id),
                    )
                else:
                    cursor.execute(
                        """
                        UPDATE users
                        SET plan = 'pro',
                            razorpay_cancel_at_period_end = FALSE
                        WHERE razorpay_subscription_id = %s
                        """,
                        (subscription_id,),
                    )

            elif event == "subscription.cancelled":
                if current_period_end is not None:
                    cursor.execute(
                        """
                        UPDATE users
                        SET razorpay_cancel_at_period_end = TRUE,
                            razorpay_current_period_end = to_timestamp(%s)
                        WHERE razorpay_subscription_id = %s
                        """,
                        (current_period_end, subscription_id),
                    )
                else:
                    cursor.execute(
                        """
                        UPDATE users
                        SET razorpay_cancel_at_period_end = TRUE
                        WHERE razorpay_subscription_id = %s
                        """,
                        (subscription_id,),
                    )

            elif event == "subscription.halted":
                cursor.execute(
                    """
                    UPDATE users
                    SET plan = 'free',
                        razorpay_subscription_id = NULL,
                        razorpay_current_period_end = NULL,
                        razorpay_cancel_at_period_end = FALSE
                    WHERE razorpay_subscription_id = %s
                    """,
                    (subscription_id,),
                )

        connection.commit()

    logger.info("Processed webhook event %s for subscription %s", event, subscription_id)
    return {"status": "ok"}
