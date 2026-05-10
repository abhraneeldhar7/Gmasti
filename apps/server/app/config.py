from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    app_timezone: str = "Asia/Calcutta"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expires_in_hours: int = 168
    google_client_id: str
    google_client_secret: str
    groq_api_key: str
    request_timeout_seconds: int = 45
    cron_secret: str = ""
    allow_origin_regex: str = r"^chrome-extension://.*$|^http://localhost(:\d+)?$"
    allowed_web_origins: str = "http://localhost:3000"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_web_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
