from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.db import get_db
from app.security import get_current_user
from app.services.groq import generate_rewrites
from app.services.posts import get_cached_posts, upsert_generated_posts
from app.services.usage import (
    count_usage_today,
    enforce_daily_limit,
    get_daily_limit,
    log_usage,
)

router = APIRouter(tags=["rewrite"])

PlatformLiteral = Literal["x", "linkedin"]


class IncomingPost(BaseModel):
    platform: PlatformLiteral
    original: str = Field(min_length=1, max_length=5000)
    post_url: str = Field(min_length=1, max_length=300)
    theme: str = Field(min_length=1, max_length=64)


class RewriteRequest(BaseModel):
    posts: list[IncomingPost] = Field(min_length=1, max_length=10)
    custom_prompt: str | None = Field(None, max_length=100)


class RewriteResult(BaseModel):
    platform: PlatformLiteral
    post_url: str
    theme: str
    generated: str
    source: Literal["database", "generated"]


class RewriteResponse(BaseModel):
    results: list[RewriteResult]
    processed_count: int
    usage_today: int
    remaining_today: int
    limit: int


@router.post("/rewrite", response_model=RewriteResponse)
def rewrite_posts(payload: RewriteRequest, current_user=Depends(get_current_user)):
    posts = [post.model_dump() for post in payload.posts]
    daily_limit = get_daily_limit(current_user["plan"])

    with get_db() as connection:
        usage_before = count_usage_today(connection, current_user["user_id"])
        enforce_daily_limit(usage_before, len(posts), daily_limit)

        cached = get_cached_posts(connection, posts)
        cached_keys = set(cached.keys())
        to_generate = [p for p in posts if (p["post_url"], p["theme"]) not in cached_keys]

        if to_generate:
            generated = generate_rewrites(to_generate, payload.custom_prompt)
            generated_lookup = {(g["post_url"], g["theme"]): g for g in generated}
            enriched = [
                {**post, "generated": generated_lookup[(post["post_url"], post["theme"])]["generated"]}
                for post in to_generate
            ]
            upsert_generated_posts(connection, enriched)
            for g in enriched:
                cached[(g["post_url"], g["theme"])] = g

        log_usage(connection, current_user["user_id"], posts)
        connection.commit()

    results = [
        RewriteResult(
            platform=post["platform"],
            post_url=post["post_url"],
            theme=post["theme"],
            generated=cached[(post["post_url"], post["theme"])]["generated"],
            source="database" if (post["post_url"], post["theme"]) in cached_keys else "generated",
        )
        for post in posts
    ]

    used_today = usage_before + len(posts)
    return RewriteResponse(
        results=results,
        processed_count=len(posts),
        usage_today=used_today,
        remaining_today=max(0, daily_limit - used_today),
        limit=daily_limit,
    )
