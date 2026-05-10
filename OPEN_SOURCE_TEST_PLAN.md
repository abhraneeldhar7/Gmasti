# Gmasti Test Plan

No automated test suite yet. This is a practical release checklist for local verification before open-sourcing or publishing.

## Scope

- Google auth end to end
- X post rewriting
- LinkedIn post rewriting
- Custom themes (hash-based, deterministic)
- Long posts preserve readable paragraph breaks
- Native feed controls still work after rewrite
- Cache behavior (localStorage + DB + eviction)
- Daily rate limiting at 100 rewrites per calendar day
- Random theme picks only from pre-made themes (not custom)
- No excessive API calls on popup open/close
- Admin cleanup endpoint

## Environment Setup

1. Start server: `cd apps/server && uvicorn app.main:app --reload`
2. Build extension: `cd apps/extension && npm run build`
3. Load `apps/extension/dist` as unpacked extension in Chrome
4. Sign in with a Google account allowed by the configured OAuth app

## Manual Tests

### 1. Server Health

- Open `http://127.0.0.1:8000/health`
- Expect `{"status":"we cooking"}`

### 2. Extension Loads Cleanly

- Open `chrome://extensions`
- Load unpacked from `apps/extension/dist`
- No extension errors in `chrome://extensions` or background console
- Open popup — UI renders without console errors

### 3. Google Login

- Click "Continue with Google"
- Complete OAuth flow
- Popup shows signed-in user name and masked email
- Usage bar displays with correct daily count
- Close and reopen popup — state persists (no re-fetch flash, no loading spinner)

### 4. X Rewrite

- Open `https://x.com/`
- Visible tweets get rewritten with loader briefly appearing
- Text is replaced with the selected theme's style
- Scrolling triggers rewrites on new tweets
- Same tweet across scrolls gets consistent theme (deterministic for "random")

### 5. LinkedIn Rewrite

- Open `https://www.linkedin.com/feed/`
- Visible feed posts rewrite
- Promoted posts (marked "Promoted") are skipped
- Card layout is not broken after rewrite

### 6. Custom Theme

- Open popup, click "Custom", write a prompt (e.g. "write like shakespeare")
- Save — popup shows "Custom" as selected theme
- Feed posts rewrite using the custom instruction
- Change custom prompt text — hash changes, old cached rewrites are not reused
- Re-selecting the same prompt text — same hash, cached rewrites are reused

### 7. Multiple Themes

- Select "Medieval" — posts rewrite in old-world English
- Select "Random" — each post gets a deterministic theme from the 5 pre-made themes (never "Custom")
- Custom selected means only that specific hashed custom theme

### 8. Long Post Newlines

- Find a long X post with paragraphs
- Find a long LinkedIn post with paragraphs
- Rewritten result renders readable line breaks in DOM (not one collapsed wall of text)

### 9. LinkedIn Native Controls

- On a long LinkedIn post, click "...more" — post expands after rewrite
- Inline links, mentions, and hashtags in rewritten posts still work

### 10. Cache Behavior — localStorage

- Rewrite a post once
- Refresh the page — post loads from local cache (no loader flash, instant rewrite)
- Verify in `chrome.storage.local` that old cache entries get pruned when count exceeds 500

### 11. Cache Behavior — Server DB

- Server returns cached DB content for repeated `(post_url, theme)` lookups
- DB response includes `source: "database"` in the API response
- Freshly generated posts return `source: "generated"`

### 12. Daily Rate Limit

- Trigger rewrites until usage hits 100
- Server returns 429 with `"Daily post limit reached. Limit: 100"`
- Extension surfaces the error (rate limit cooldown, no silent break)
- Usage resets next calendar day

### 13. Popup State Persistence

- Open popup — session loads (mild loading state)
- Close popup, reopen — no re-fetch of usage from API unless day changed
- Close popup, reopen — settings and custom prompt persist from session cache
- Verify in DevTools network tab that `/usage/today` is NOT called on subsequent popup opens

### 14. Popup Profile Link

- Click settings gear → Profile
- Opens webapp at `http://localhost:3000/dashboard` in new tab

### 15. Extension Toggle On/Off

- Disable extension via the toggle switch
- All rewritten text restores to original
- Re-enable — posts rewrite again
- No double rewriting on re-enable

## API Checks

### `GET /health`

- Returns `{"status":"we cooking"}`

### `GET /usage/today`

- Returns `used_today`, `remaining_today`, `limit`
- `limit` is `100`
- Values reflect calendar-day usage (midnight-to-midnight), not rolling hour
- Test at day boundary: usage resets correctly

### `POST /rewrite`

- Accepts up to 10 posts in one request
- Returns `results`, `processed_count`, `usage_today`, `remaining_today`
- Repeated requests for same `(post_url, theme)` reuse DB cached content
- Theme accepts any string (including hashes for custom themes)
- `custom_prompt` max 100 chars — server rejects longer with 422
- Request without `custom_prompt` uses built-in theme explanations

### `POST /admin/cleanup`

- Requires `X-Cron-Secret` header
- Returns `{"deleted_usage_logs": N, "deleted_posts": N}`
- Invalid secret returns 401
- Test by inserting old rows manually, calling endpoint, confirming deletion

## Regression Checks Before Publish

- Remove or replace all real credentials from `.env` files
- Rebuild extension with production `VITE_API_BASE_URL`
- Confirm `apps/extension/public/manifest.json` does not point at localhost for production
- Confirm no absolute personal file paths in public-facing docs
- Confirm README mentions daily limit (100/day), not hourly
- Confirm `cron_secret` is set in production `.env` and GitHub Secrets

## Future Automated Tests Worth Adding

- FastAPI route tests for `/health`, `/rewrite`, `/usage/today`, `/admin/cleanup`
- Unit tests for `count_usage_today()` and daily limit enforcement
- Unit tests for Groq response parsing and normalization
- Unit tests for custom theme hash consistency (same input → same hash)
- Browser-level tests for X/LinkedIn DOM rewriting using Playwright
