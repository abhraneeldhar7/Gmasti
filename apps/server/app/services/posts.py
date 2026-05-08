from uuid import uuid4

from fastapi import HTTPException, status

HOURLY_POST_LIMIT = 100


def count_usage_this_hour(connection, user_id: str) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM usage_logs
            WHERE user_id = %s
              AND occurred_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        return int(row["total"])


def get_or_create_user(connection, google_claims: dict) -> dict:
    google_sub = google_claims["sub"]
    email = google_claims.get("email") or ""
    name = google_claims.get("name") or email or "Gmasti User"

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT user_id, email, name, joined
            FROM users
            WHERE google_sub = %s
            """,
            (google_sub,),
        )
        existing = cursor.fetchone()
        if existing:
            cursor.execute(
                """
                UPDATE users
                SET email = %s,
                    name = %s
                WHERE user_id = %s
                """,
                (email, name, existing["user_id"]),
            )
            existing["email"] = email
            existing["name"] = name
            return existing

        user_id = uuid4().hex
        cursor.execute(
            """
            INSERT INTO users (user_id, google_sub, email, name)
            VALUES (%s, %s, %s, %s)
            RETURNING user_id, email, name, joined
            """,
            (user_id, google_sub, email, name),
        )
        return cursor.fetchone()


def get_cached_posts(connection, posts: list[dict]) -> dict[tuple[str, str], dict]:
    cached: dict[tuple[str, str], dict] = {}

    with connection.cursor() as cursor:
        for post in posts:
            cursor.execute(
                """
                SELECT platform, post_url, theme, original, generated
                FROM posts
                WHERE post_url = %s AND theme = %s
                """,
                (post["post_url"], post["theme"]),
            )
            row = cursor.fetchone()
            if row:
                cached[(row["post_url"], row["theme"])] = row

    return cached


def upsert_generated_posts(connection, posts: list[dict]) -> None:
    if not posts:
        return

    with connection.cursor() as cursor:
        for post in posts:
            cursor.execute(
                """
                INSERT INTO posts (platform, post_url, theme, original, generated)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (post_url, theme)
                DO UPDATE SET
                    platform = EXCLUDED.platform,
                    original = EXCLUDED.original,
                    generated = EXCLUDED.generated,
                    updated_at = NOW()
                """,
                (
                    post["platform"],
                    post["post_url"],
                    post["theme"],
                    post["original"],
                    post["generated"],
                ),
            )


def log_usage(connection, user_id: str, posts: list[dict]) -> None:
    with connection.cursor() as cursor:
        for post in posts:
            cursor.execute(
                """
                INSERT INTO usage_logs (user_id, platform, post_url, theme)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, post["platform"], post["post_url"], post["theme"]),
            )


def enforce_hourly_limit(current_count: int, requested_count: int) -> None:
    if current_count + requested_count > HOURLY_POST_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Hourly post limit reached. Limit: {HOURLY_POST_LIMIT}",
        )
