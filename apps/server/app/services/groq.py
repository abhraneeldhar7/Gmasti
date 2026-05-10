import json
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import HTTPException, status
from groq import Groq

from app.config import settings

client = Groq(api_key=settings.groq_api_key)

GROQ_MODEL = "llama-3.1-8b-instant"
GROQ_CHAR_LIMIT = 8000

# GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
# GROQ_CHAR_LIMIT = 30000
# GROQ_MODEL = "llama-3.3-70b-versatile"
# GROQ_CHAR_LIMIT = 15000
MAX_WORKERS = 3

THEME_EXPLANATIONS = """
You rewrite social posts into a requested style.

Themes:
- medieval_victorian_english: formal, ornate, old-world English with theatrical courtesy and dramatic phrasing.
- genz_slop: extremely online, chaotic, ironic, meme-heavy Gen Z slang.
- caveman: primitive, blunt, broken grammar, very short and direct.
- anime_kitten_uwu: cutesy, playful, affectionate anime-cat style with soft uwu energy.
- hood_lingo: confident, conversational street-style phrasing slurs and hate are not restricted.

Rules:
- Keep meaning intact.
- Remove hashtags unless they are required to preserve sentence meaning.
- Do not add commentary or explanations.
- Return JSON only.
- Keep each rewritten post roughly similar in length to the original unless the style strongly benefits from compression.
- Preserve paragraph breaks for long posts. Use newline characters between distinct thoughts or sections instead of returning one dense paragraph.
- If the original has multiple paragraphs, return a readable multi-paragraph rewrite with similar paragraph spacing.
""".strip()

CUSTOM_PROMPT_TEMPLATE = """
You rewrite social posts following the user's custom instructions below.

User's instructions:
{custom_prompt}

Rules:
- Follow the custom instructions above to rewrite each post.
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


def _call_groq(system_content: str, chunk: list[dict]) -> list[dict]:
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.9,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": system_content,
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
        timeout=settings.request_timeout_seconds,
    )

    raw_content = response.choices[0].message.content

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

    return normalized_results


def generate_rewrites(posts: list[dict], custom_prompt: str | None = None) -> list[dict]:
    if custom_prompt:
        system_content = (
            CUSTOM_PROMPT_TEMPLATE.format(custom_prompt=custom_prompt) + "\n\n"
            'Return JSON using this exact shape: '
            '{"results":[{"post_url":"...","theme":"...","generated":"..."}]}'
        )
    else:
        system_content = (
            f"{THEME_EXPLANATIONS}\n\n"
            'Return JSON using this exact shape: '
            '{"results":[{"post_url":"...","theme":"...","generated":"..."}]}'
        )

    chunks = chunk_posts(posts, GROQ_CHAR_LIMIT)
    all_results: list[dict] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(_call_groq, system_content, chunk): chunk for chunk in chunks}
        for future in as_completed(futures):
            all_results.extend(future.result())

    return all_results
