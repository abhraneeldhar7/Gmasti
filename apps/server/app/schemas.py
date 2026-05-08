from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ThemeLiteral = Literal[
    "medieval_victorian_english",
    "genz_slop",
    "caveman",
    "anime_kitten_uwu",
    "hood_lingo",
]

PlatformLiteral = Literal["x", "linkedin"]


class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    joined: datetime


class GoogleExchangeRequest(BaseModel):
    code: str = Field(min_length=10)
    redirect_uri: str = Field(min_length=10)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserResponse


class IncomingPost(BaseModel):
    platform: PlatformLiteral
    original: str = Field(min_length=1, max_length=5000)
    post_url: str = Field(min_length=1, max_length=300)
    theme: ThemeLiteral


class RewriteRequest(BaseModel):
    posts: list[IncomingPost] = Field(min_length=1, max_length=10)


class RewriteResult(BaseModel):
    platform: PlatformLiteral
    post_url: str
    theme: ThemeLiteral
    generated: str
    source: Literal["database", "generated"]


class RewriteResponse(BaseModel):
    results: list[RewriteResult]
    processed_count: int
    usage_today: int
    remaining_today: int


class UsageResponse(BaseModel):
    used_today: int
    remaining_today: int
    limit: int

