from fastapi import HTTPException, status

DAILY_POST_LIMIT = 100


def count_usage_today(connection, user_id: str) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM usage_logs
            WHERE user_id = %s
              AND occurred_at::date = CURRENT_DATE
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        return int(row["total"])


def enforce_daily_limit(current_count: int, requested_count: int) -> None:
    if current_count + requested_count > DAILY_POST_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily post limit reached. Limit: {DAILY_POST_LIMIT}",
        )


def log_usage(connection, user_id: str, posts: list[dict]) -> None:
    if not posts:
        return

    placeholders = ", ".join("(%s, %s, %s, %s)" for _ in posts)
    params = []
    for post in posts:
        params.extend([user_id, post["platform"], post["post_url"], post["theme"]])

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            INSERT INTO usage_logs (user_id, platform, post_url, theme)
            VALUES {placeholders}
            """,
            params,
        )
