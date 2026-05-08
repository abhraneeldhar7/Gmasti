import httpx
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from app.config import settings


def exchange_google_code(code: str, redirect_uri: str) -> dict:
    response = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=settings.request_timeout_seconds,
    )
    response.raise_for_status()
    return response.json()


def verify_google_id_token(token_value: str) -> dict:
    return id_token.verify_oauth2_token(
        token_value,
        Request(),
        settings.google_client_id,
    )

