# Gmasti Test Plan

This repo does not yet have an automated test suite, so this file is a practical release checklist for local verification before open-sourcing or publishing.

## Scope

We want to verify:

- Google auth works end to end
- X post rewriting works
- LinkedIn post rewriting works
- Long posts preserve readable paragraph breaks
- Native feed controls still work after rewrite
- Cache behavior is sane
- Hourly rate limiting works at `100` rewrites per rolling hour

## Environment Setup

1. Start the server from `apps/server`
2. Build the extension from `apps/extension`
3. Load `apps/extension/dist` as an unpacked extension in Chrome
4. Sign in with a Google account that is allowed by the configured OAuth app

## Manual Tests

### 1. Server Health

- Open `http://localhost:8000/health`
- Expect `{"status":"ok"}`

### 2. Extension Loads Cleanly

- Open `chrome://extensions`
- Load the unpacked extension from `apps/extension/dist`
- Confirm there are no immediate extension errors
- Open the popup and confirm the UI renders

### 3. Google Login

- Click `Sign in with Google`
- Complete the OAuth flow
- Confirm the popup shows the signed-in user name and email
- Confirm usage is displayed in the popup

### 4. X Rewrite

- Open `https://x.com/`
- Find a few visible tweets with normal text content
- Confirm the loader appears briefly
- Confirm text is replaced with a rewritten version
- Confirm scrolling causes newly visible tweets to rewrite

### 5. LinkedIn Rewrite

- Open `https://www.linkedin.com/feed/`
- Confirm visible feed posts rewrite
- Confirm promoted posts are not rewritten
- Confirm rewriting does not break the card layout

### 6. Long Post Newlines

- Find a long X post with several paragraphs
- Find a long LinkedIn post with several paragraphs
- Confirm the rewritten result still renders as separate readable paragraphs
- Confirm the DOM visually shows line breaks rather than one collapsed wall of text

### 7. LinkedIn Native Controls

- On a long LinkedIn post, click `... more`
- Confirm the post can still expand after rewriting
- Click inline links, mentions, and hashtags in a rewritten LinkedIn post
- Confirm those controls still work

### 8. Theme Stability

- Leave the popup in `Randomize per post`
- Refresh a feed page
- Confirm the same post gets a stable theme when served from cache
- Switch to a specific theme and confirm new rewrites use that theme

### 9. Cache Behavior

- Rewrite a post once
- Refresh the page
- Confirm the same post loads quickly from cache
- Confirm cached rewrites still render with correct line breaks

### 10. Hourly Rate Limit

- Sign in with a test account
- Trigger rewrites until usage reaches the limit
- Confirm the server blocks requests above `100` rewrites in the last hour
- Confirm the extension surfaces the failure cleanly instead of silently breaking
- Confirm usage resets after the rolling one-hour window passes

## API Checks

These can be validated with the browser, extension logs, or a REST client.

### `GET /usage/today`

- Confirm it returns:
  - `used_today`
  - `remaining_today`
  - `limit`
- Confirm `limit` is `100`
- Confirm values reflect hourly usage, not calendar-day usage

### `POST /rewrite`

- Confirm it accepts up to `10` posts in one request
- Confirm it returns `results`, `processed_count`, `usage_today`, and `remaining_today`
- Confirm repeated requests for the same post reuse cached content when available

## Regression Checks Before Publish

- Remove or replace all real credentials from local `.env` files
- Rebuild the extension with the intended production API base URL
- Confirm `apps/extension/public/manifest.json` does not point at localhost for a production release build
- Confirm no absolute personal file paths remain in public-facing docs
- Confirm README language matches current behavior, especially the hourly limit

## Future Automated Tests Worth Adding

- FastAPI route tests for `/health`, `/rewrite`, and `/usage/today`
- Unit tests for `count_usage_this_hour()` and hourly limit enforcement
- Unit tests for rewrite normalization and paragraph preservation
- Browser-level tests for LinkedIn and X content rewriting using Playwright
