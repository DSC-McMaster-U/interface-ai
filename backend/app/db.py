"""
PostgreSQL database connection and profile helpers.

Uses psycopg (v3) connection pool.
"""

import os
import json
import logging
import uuid
from contextlib import contextmanager
from typing import Any
from urllib.parse import quote

import psycopg
from psycopg.rows import dict_row

logger = logging.getLogger(__name__)

_USER_ID_NAMESPACE = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")

_HARDCODED_DB_HOST = "34.130.177.250"
_HARDCODED_DB_PORT = 5432
_HARDCODED_DB_NAME = "interfaceai-db"
_HARDCODED_DB_USER = "postgres"
_HARDCODED_DB_PASSWORD = "=JVO7L6=@>qYO$m,"
_HARDCODED_DB_SSLMODE = "require"
_LOCAL_DOCKER_DB_URL = "postgresql://user:password@postgres:5432/interfaceai"


def _hardcoded_db_url() -> str:
    encoded_password = quote(_HARDCODED_DB_PASSWORD, safe="")
    return (
        f"postgresql://{_HARDCODED_DB_USER}:{encoded_password}"
        f"@{_HARDCODED_DB_HOST}:{_HARDCODED_DB_PORT}/{_HARDCODED_DB_NAME}"
        f"?sslmode={_HARDCODED_DB_SSLMODE}"
    )


def _resolve_database_url() -> str:
    memory_db_url = os.getenv("MEMORY_DATABASE_URL", "").strip()
    direct_db_url = os.getenv("DATABASE_URL", "").strip()

    if memory_db_url:
        return memory_db_url
    if direct_db_url and direct_db_url != _LOCAL_DOCKER_DB_URL:
        return direct_db_url
    return _hardcoded_db_url()


DATABASE_URL = _resolve_database_url()

_pool: psycopg.Connection | None = None


def _get_conn() -> psycopg.Connection:
    """Return a reusable connection (simple single-connection approach)."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True)
    return _pool


def _reset_conn() -> psycopg.Connection:
    global _pool
    try:
        if _pool is not None and not _pool.closed:
            _pool.close()
    except Exception:
        pass
    _pool = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True)
    return _pool


@contextmanager
def get_cursor():
    """Yield a dict-row cursor, auto-closing after use."""
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            yield cur
    except psycopg.OperationalError:
        logger.warning("DB connection dropped; reconnecting and retrying once.")
        conn = _reset_conn()
        with conn.cursor() as cur:
            yield cur


def _table_exists(table_name: str) -> bool:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
            ) AS exists
            """,
            (table_name,),
        )
        row = cur.fetchone() or {}
        return bool(row.get("exists"))


def _table_has_column(table_name: str, column_name: str) -> bool:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = %s
                  AND column_name = %s
            ) AS exists
            """,
            (table_name, column_name),
        )
        row = cur.fetchone() or {}
        return bool(row.get("exists"))


def _table_column_udt(table_name: str, column_name: str) -> str:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
            """,
            (table_name, column_name),
        )
        row = cur.fetchone() or {}
        return str(row.get("udt_name") or "").strip().lower()


def normalize_user_id(user_id: str) -> str:
    normalized = (user_id or "").strip()
    if not normalized:
        return ""

    profiles_user_id_type = _table_column_udt("profiles", "user_id")
    if profiles_user_id_type != "uuid":
        return normalized

    try:
        return str(uuid.UUID(normalized))
    except ValueError:
        return str(uuid.uuid5(_USER_ID_NAMESPACE, normalized))


# ---------------------------------------------------------------------------
# Table initialisation
# ---------------------------------------------------------------------------


def init_tables() -> None:
    """Create lightweight tables when absent without breaking older schemas."""
    conn = _get_conn()
    with conn.cursor() as cur:
        if not _table_exists("profiles"):
            cur.execute("""
                CREATE TABLE profiles (
                    user_id     TEXT PRIMARY KEY,
                    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                );
            """)
        elif _table_has_column("profiles", "preferences"):
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_profiles_user_id
                ON profiles (user_id);
            """)
    logger.info("Database tables initialised.")


# ---------------------------------------------------------------------------
# Profile helpers
# ---------------------------------------------------------------------------


def get_profile(user_id: str) -> dict[str, Any]:
    """Return the profile row for *user_id*, or a default empty one."""
    canonical_user_id = normalize_user_id(user_id)
    if not canonical_user_id:
        return {"user_id": "", "preferences": {}}

    with get_cursor() as cur:
        if _table_has_column("profiles", "preferences"):
            cur.execute(
                "SELECT user_id, preferences FROM profiles WHERE user_id = %s",
                (canonical_user_id,),
            )
            row = cur.fetchone()
            if row:
                prefs = row.get("preferences") or {}
                return {
                    "user_id": row.get("user_id", canonical_user_id),
                    "preferences": prefs,
                }

        if _table_has_column("profiles", "field_key") and _table_has_column(
            "profiles", "fact"
        ):
            cur.execute(
                """
                SELECT field_key, fact
                FROM profiles
                WHERE user_id = %s
                ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
                """,
                (canonical_user_id,),
            )
            rows = cur.fetchall() or []
            preferences = {
                str(row.get("field_key") or "").strip(): str(row.get("fact") or "").strip()
                for row in rows
                if str(row.get("field_key") or "").strip()
                and str(row.get("fact") or "").strip()
            }
            if preferences:
                return {"user_id": canonical_user_id, "preferences": preferences}

    return {"user_id": canonical_user_id, "preferences": {}}


def upsert_profile(user_id: str, preferences: dict[str, Any]) -> dict[str, Any]:
    """Insert or update the preferences JSON for *user_id*."""
    normalized_user_id = normalize_user_id(user_id)
    if not normalized_user_id:
        return {"user_id": "", "preferences": {}}

    normalized_preferences = {
        str(key).strip(): value
        for key, value in (preferences or {}).items()
        if str(key).strip()
    }

    if _table_has_column("profiles", "preferences"):
        prefs_json = json.dumps(normalized_preferences)
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO profiles (user_id, preferences, created_at, updated_at)
                VALUES (%s, %s::jsonb, now(), now())
                ON CONFLICT (user_id)
                DO UPDATE SET preferences = %s::jsonb,
                              updated_at  = now()
                RETURNING user_id, preferences;
                """,
                (normalized_user_id, prefs_json, prefs_json),
            )
            row = cur.fetchone()
            if row:
                return {
                    "user_id": row.get("user_id", normalized_user_id),
                    "preferences": row.get("preferences") or {},
                }
        return {"user_id": normalized_user_id, "preferences": normalized_preferences}

    if _table_has_column("profiles", "field_key") and _table_has_column(
        "profiles", "fact"
    ):
        existing = get_profile(normalized_user_id).get("preferences", {})
        merged_preferences = {**existing, **normalized_preferences}
        with get_cursor() as cur:
            for key, value in merged_preferences.items():
                cur.execute(
                    """
                    INSERT INTO profiles (
                        user_id,
                        field_key,
                        fact,
                        source,
                        metadata,
                        created_at,
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s::jsonb, now(), now())
                    ON CONFLICT (user_id, field_key)
                    DO UPDATE SET
                        fact = EXCLUDED.fact,
                        source = EXCLUDED.source,
                        metadata = EXCLUDED.metadata,
                        updated_at = now()
                    """,
                    (
                        normalized_user_id,
                        key,
                        str(value),
                        "profile_preferences",
                        json.dumps({}),
                    ),
                )
        return {"user_id": normalized_user_id, "preferences": merged_preferences}

    logger.warning("profiles table schema is not recognized; returning in-memory profile")
    return {"user_id": normalized_user_id, "preferences": normalized_preferences}


def update_profile_field(user_id: str, key: str, value: Any) -> dict[str, Any]:
    """Set a single key inside the preferences JSONB for *user_id*."""
    if _table_has_column("profiles", "field_key") and _table_has_column(
        "profiles", "fact"
    ):
        return upsert_profile(user_id, {str(key).strip(): value})

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
    if _table_has_column("profiles", "field_key") and _table_has_column(
        "profiles", "fact"
    ):
        return get_profile(user_id)

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
