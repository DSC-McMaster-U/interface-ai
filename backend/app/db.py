"""
PostgreSQL database connection and profile helpers.

Uses psycopg (v3) connection pool.
"""

import os
import json
import logging
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:=JVO7L6=@>qYO$m,@34.130.177.250:5432/interfaceai-db",
)

_pool: psycopg.Connection | None = None


def _get_conn() -> psycopg.Connection:
    """Return a reusable connection (simple single-connection approach)."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True)
    return _pool


@contextmanager
def get_cursor():
    """Yield a dict-row cursor, auto-closing after use."""
    conn = _get_conn()
    with conn.cursor() as cur:
        yield cur


# ---------------------------------------------------------------------------
# Table initialisation
# ---------------------------------------------------------------------------

def init_tables() -> None:
    """Create the profiles and memories tables if they do not exist."""
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                user_id     TEXT PRIMARY KEY,
                preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id          SERIAL PRIMARY KEY,
                userid      TEXT NOT NULL,
                kind        TEXT NOT NULL DEFAULT 'general',
                data        JSONB NOT NULL DEFAULT '{}'::jsonb,
                thread_id   TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_memories_userid ON memories (userid);
        """)
    logger.info("Database tables initialised.")


# ---------------------------------------------------------------------------
# Profile helpers
# ---------------------------------------------------------------------------

def get_profile(user_id: str) -> dict[str, Any]:
    """Return the profile row for *user_id*, or a default empty one."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM profiles WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        if row:
            return dict(row)
    # Return a sensible default if no row exists yet
    return {"user_id": user_id, "preferences": {}}


def upsert_profile(user_id: str, preferences: dict[str, Any]) -> dict[str, Any]:
    """Insert or update the preferences JSON for *user_id*."""
    prefs_json = json.dumps(preferences)
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO profiles (user_id, preferences, created_at, updated_at)
            VALUES (%s, %s::jsonb, now(), now())
            ON CONFLICT (user_id)
            DO UPDATE SET preferences = %s::jsonb,
                          updated_at  = now()
            RETURNING *;
            """,
            (user_id, prefs_json, prefs_json),
        )
        row = cur.fetchone()
        return dict(row) if row else {"user_id": user_id, "preferences": preferences}


def update_profile_field(user_id: str, key: str, value: Any) -> dict[str, Any]:
    """Set a single key inside the preferences JSONB for *user_id*."""
    # Ensure the row exists first
    get_or_create_profile(user_id)
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE profiles
            SET preferences = jsonb_set(
                    COALESCE(preferences, '{}'::jsonb),
                    %s::text[],
                    %s::jsonb
                ),
                updated_at = now()
            WHERE user_id = %s
            RETURNING *;
            """,
            ([key], json.dumps(value), user_id),
        )
        row = cur.fetchone()
        return dict(row) if row else get_profile(user_id)


def get_or_create_profile(user_id: str) -> dict[str, Any]:
    """Return existing profile or create a blank one."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO profiles (user_id, preferences)
            VALUES (%s, '{}'::jsonb)
            ON CONFLICT (user_id) DO NOTHING;
            """,
            (user_id,),
        )
    return get_profile(user_id)
