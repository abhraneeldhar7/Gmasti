# Gmasti

Gmasti is a monorepo with:

- `apps/extension`: a React-based Chrome extension that rewrites X and LinkedIn post text.
- `apps/server`: a FastAPI backend for Google auth, usage tracking, cached rewrites, and Groq generation.

## Structure

```text
apps/
  extension/
  server/
```

## Extension

```powershell
cd apps/extension
npm install
npm run build
```

Load `apps/extension/dist` as an unpacked Chrome extension.

## Server

```powershell
cd apps/server
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts\init_db.py
uvicorn app.main:app --reload
```

## Notes

- Fill in `apps/server/.env` and `apps/extension/.env` before running.
- The Groq model, Groq chunk limit, and daily post limit are set directly in server code.
- The Neon MCP available in this session is read-only, so schema setup is provided as SQL plus `scripts/init_db.py`.
