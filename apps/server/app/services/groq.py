import json

import httpx
from fastapi import HTTPException, status

from app.config import settings

GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_CHAR_LIMIT = 15000

THEME_EXPLANATIONS = """
You rewrite social posts into a requested style.

Themes:
- medieval_victorian_english: formal, ornate, old-world English with theatrical courtesy and dramatic phrasing.
- genz_slop: extremely online, chaotic, ironic, meme-heavy Gen Z slang.
- caveman: primitive, blunt, broken grammar, very short and direct.
- anime_kitten_uwu: cutesy, playful, affectionate anime-cat style with soft uwu energy.
- hood_lingo: confident, conversational street-style phrasing without slurs or hate.

Rules:
- Keep meaning intact.
- Remove hashtags unless they are required to preserve sentence meaning.
- Do not add commentary or explanations.
- Return JSON only.
- Keep each rewritten post roughly similar in length to the original unless the style strongly benefits from compression.
- Preserve paragraph breaks for long posts. Use newline characters between distinct thoughts or sections instead of returning one dense paragraph.
- If the original has multiple paragraphs, return a readable multi-paragraph rewrite with similar paragraph spacing.
""".strip()


def chunk_posts(posts: list[dict], char_limit: int) -> list[list[dict]]:
    chunks: list[list[dict]] = []
    current_chunk: list[dict] = []
    current_size = 0

    for post in posts:
        estimated_size = len(post["original"]) + len(post["post_url"]) + len(post["theme"]) + 64
        if current_chunk and current_size + estimated_size > char_limit:
            chunks.append(current_chunk)
            current_chunk = []
            current_size = 0

        current_chunk.append(post)
        current_size += estimated_size

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def generate_rewrites(posts: list[dict]) -> list[dict]:
    all_results: list[dict] = []

    for chunk in chunk_posts(posts, GROQ_CHAR_LIMIT):
        payload = {
            "model": GROQ_MODEL,
            "temperature": 0.9,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        f"{THEME_EXPLANATIONS}\n\n"
                        "Return JSON using this exact shape: "
                        '{"results":[{"post_url":"...","theme":"...","generated":"..."}]}'
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "posts": [
                                {
                                    "post_url": post["post_url"],
                                    "original": post["original"],
                                    "theme": post["theme"],
                                }
                                for post in chunk
                            ]
                        },
                        ensure_ascii=True,
                    ),
                },
            ],
        }

        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=settings.request_timeout_seconds,
        )
        response.raise_for_status()

        body = response.json()
        raw_content = body["choices"][0]["message"]["content"]

        try:
            parsed = json.loads(raw_content)
            results = parsed["results"]
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Groq returned an invalid JSON payload.",
            ) from exc

        chunk_lookup = {(post["post_url"], post["theme"]) for post in chunk}
        normalized_results: list[dict] = []

        for item in results:
            key = (item.get("post_url"), item.get("theme"))
            generated = (item.get("generated") or "").strip()
            if key not in chunk_lookup or not generated:
                continue

            normalized_results.append(
                {
                    "post_url": item["post_url"],
                    "theme": item["theme"],
                    "generated": generated,
                }
            )

        if len(normalized_results) != len(chunk):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Groq did not return all rewritten posts.",
            )

        all_results.extend(normalized_results)

    return all_results
