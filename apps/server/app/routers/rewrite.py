from fastapi import APIRouter, Depends

from app.db import get_db
from app.schemas import RewriteRequest, RewriteResponse, RewriteResult
from app.security import get_current_user
from app.services.groq import generate_rewrites
from app.services.posts import (
    HOURLY_POST_LIMIT,
    count_usage_this_hour,
    enforce_hourly_limit,
    get_cached_posts,
    log_usage,
    upsert_generated_posts,
)

router = APIRouter(tags=["rewrite"])


@router.post("/rewrite", response_model=RewriteResponse)
def rewrite_posts(payload: RewriteRequest, current_user=Depends(get_current_user)):
    posts = [post.model_dump() for post in payload.posts]

    with get_db() as connection:
        usage_before = count_usage_this_hour(connection, current_user["user_id"])
        enforce_hourly_limit(usage_before, len(posts))

        cached_posts = get_cached_posts(connection, posts)
        missing_posts = [
            post
            for post in posts
            if (post["post_url"], post["theme"]) not in cached_posts
        ]

        generated_posts = []
        if missing_posts:
            generated_lookup = {
                (item["post_url"], item["theme"]): item
                for item in generate_rewrites(missing_posts)
            }
            for post in missing_posts:
                generated_item = generated_lookup[(post["post_url"], post["theme"])]
                generated_posts.append(
                    {
                        **post,
                        "generated": generated_item["generated"],
                    }
                )

            upsert_generated_posts(connection, generated_posts)

        log_usage(connection, current_user["user_id"], posts)
        connection.commit()

    generated_lookup = {
        (post["post_url"], post["theme"]): post
        for post in generated_posts
    }

    results: list[RewriteResult] = []
    for post in posts:
        cache_key = (post["post_url"], post["theme"])
        cached = cached_posts.get(cache_key)
        if cached:
            results.append(
                RewriteResult(
                    platform=post["platform"],
                    post_url=post["post_url"],
                    theme=post["theme"],
                    generated=cached["generated"],
                    source="database",
                )
            )
            continue

        generated = generated_lookup[cache_key]
        results.append(
            RewriteResult(
                platform=post["platform"],
                post_url=post["post_url"],
                theme=post["theme"],
                generated=generated["generated"],
                source="generated",
            )
        )

    usage_this_hour = usage_before + len(posts)
    return RewriteResponse(
        results=results,
        processed_count=len(posts),
        usage_today=usage_this_hour,
        remaining_today=max(0, HOURLY_POST_LIMIT - usage_this_hour),
    )
