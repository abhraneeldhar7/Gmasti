from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_db
from app.schemas import AuthResponse, GoogleExchangeRequest, UserResponse
from app.security import create_access_token, get_current_user
from app.services.google_auth import exchange_google_code, verify_google_id_token
from app.services.posts import get_or_create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google/exchange", response_model=AuthResponse)
def google_exchange(payload: GoogleExchangeRequest):
    try:
        google_tokens = exchange_google_code(payload.code, payload.redirect_uri)
        claims = verify_google_id_token(google_tokens["id_token"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication failed.",
        ) from exc

    with get_db() as connection:
        user = get_or_create_user(connection, claims)
        connection.commit()

    access_token, expires_at = create_access_token(user["user_id"], user["email"])
    return AuthResponse(
        access_token=access_token,
        expires_at=expires_at,
        user=UserResponse(**user),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return UserResponse(**current_user)
