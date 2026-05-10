from uuid import uuid4


def get_or_create_user(connection, google_claims: dict) -> dict:
    google_sub = google_claims["sub"]
    email = google_claims.get("email") or ""
    name = google_claims.get("name") or email or "Gmasti User"

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT user_id, email, name, plan, joined
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
            RETURNING user_id, email, name, plan, joined
            """,
            (user_id, google_sub, email, name),
        )
        return cursor.fetchone()


def get_cached_posts(connection, posts: list[dict]) -> dict[tuple[str, str], dict]:
    if not posts:
        return {}

    placeholders = ", ".join("(%s, %s)" for _ in posts)
    params = []
    for post in posts:
        params.append(post["post_url"])
        params.append(post["theme"])

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT platform, post_url, theme, original, generated
            FROM posts
            WHERE (post_url, theme) IN (VALUES {placeholders})
            """,
            params,
        )
        return {(row["post_url"], row["theme"]): row for row in cursor.fetchall()}


def upsert_generated_posts(connection, posts: list[dict]) -> None:
    if not posts:
        return

    placeholders = ", ".join("(%s, %s, %s, %s, %s)" for _ in posts)
    params = []
    for post in posts:
        params.extend([post["platform"], post["post_url"], post["theme"], post["original"], post["generated"]])

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            INSERT INTO posts (platform, post_url, theme, original, generated)
            VALUES {placeholders}
            ON CONFLICT (post_url, theme)
            DO UPDATE SET
                platform = EXCLUDED.platform,
                original = EXCLUDED.original,
                generated = EXCLUDED.generated,
                updated_at = NOW()
            """,
            params,
        )
