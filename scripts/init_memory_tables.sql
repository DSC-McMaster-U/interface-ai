-- Optional schema bootstrap for MEMORY_BACKEND=postgres.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(preferences) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_updated
ON profiles (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS memories (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    thread_id TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(data) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_memories_user_kind_created
ON memories (user_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_thread_kind_created
ON memories (thread_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_data_gin
ON memories USING GIN (data);

-- pgvector is NOT required for this integration.
-- For large-scale semantic retrieval, enable it with:
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE memories ADD COLUMN IF NOT EXISTS embedding vector(768);
-- CREATE INDEX IF NOT EXISTS idx_memories_embedding_ivfflat
-- ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
