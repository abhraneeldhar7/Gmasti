from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import settings
from .db import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user_id: str, email: str) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(hours=settings.jwt_expires_in_hours)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token.",
        )

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    with get_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, email, name, plan, joined,
                       razorpay_subscription_id,
                       razorpay_current_period_end,
                       razorpay_cancel_at_period_end
                FROM users
                WHERE user_id = %s
                """,
                (user_id,),
            )
            user = cursor.fetchone()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    return user

