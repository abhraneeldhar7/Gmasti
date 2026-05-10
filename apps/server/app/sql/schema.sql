CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    joined TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
    post_url TEXT NOT NULL,
    theme TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin')),
    original TEXT NOT NULL,
    generated TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_url, theme)
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin')),
    post_url TEXT NOT NULL,
    theme TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_time
    ON usage_logs (user_id, occurred_at DESC);

