import os
import json
from typing import Any
from urllib.parse import quote, urlparse

import psycopg
from app.db import normalize_user_id

_HARDCODED_DB_HOST = "34.130.177.250"
_HARDCODED_DB_PORT = 5432
_HARDCODED_DB_NAME = "interfaceai-db"
_HARDCODED_DB_USER = "postgres"
_HARDCODED_DB_PASSWORD = "=JVO7L6=@>qYO$m,"
_HARDCODED_DB_SSLMODE = "require"


def _hardcoded_db_url() -> str:
    encoded_password = quote(_HARDCODED_DB_PASSWORD, safe="")
    return (
        f"postgresql://{_HARDCODED_DB_USER}:{encoded_password}"
        f"@{_HARDCODED_DB_HOST}:{_HARDCODED_DB_PORT}/{_HARDCODED_DB_NAME}"
        f"?sslmode={_HARDCODED_DB_SSLMODE}"
    )


def _user_id_variants(user_id: str) -> list[str]:
    raw_user_id = (user_id or "").strip()
    if not raw_user_id:
        return []
    canonical_user_id = normalize_user_id(raw_user_id)
    variants: list[str] = []
    for candidate in (canonical_user_id, raw_user_id):
        normalized = (candidate or "").strip()
        if normalized and normalized not in variants:
            variants.append(normalized)
    return variants


def _normalize_text(value: str) -> str:
    return " ".join((value or "").lower().split())


def _keywords(text: str) -> set[str]:
    normalized = _normalize_text(text).replace("-", " ").replace("_", " ")
    return {token for token in normalized.split() if len(token) >= 4}


def extract_domain_from_status(status: dict[str, Any] | None) -> str:
    if not isinstance(status, dict):
        return ""
    url = str(status.get("url") or "").strip()
    return urlparse(url).netloc.lower() if url else ""


def infer_target_domain(goal: str) -> str:
    for token in _normalize_text(goal).split():
        cleaned = token.strip(".,:;()[]{}<>\"'")
        if cleaned.startswith("www."):
            cleaned = cleaned[4:]
        if "." in cleaned and len(cleaned) >= 4:
            return cleaned.lower()
    return ""


def infer_task_type(goal: str) -> str:
    tokens = [
        token
        for token in _normalize_text(goal).replace("-", " ").replace("_", " ").split()
        if len(token) >= 4
    ]
    if not tokens:
        return "generic_browser_task"
    return "_".join(tokens[:3])


def summarize_params(params: dict[str, Any] | None) -> str:
    if not params:
        return ""
    parts = []
    for key, value in params.items():
        compact = str(value).strip()
        if not compact:
            continue
        if len(compact) > 40:
            compact = compact[:37] + "..."
        parts.append(f"{key}={compact}")
    return ", ".join(parts[:2])


def format_memory_lines(title: str, items: list[dict[str, Any]]) -> str:
    if not items:
        return ""
    lines = [title]
    for index, item in enumerate(items, start=1):
        fact = str(item.get("fact") or "").strip() or "No fact recorded."
        meta = item.get("metadata") or {}
        suffix = []
        if meta.get("domain"):
            suffix.append(f"domain={meta['domain']}")
        if meta.get("task_type"):
            suffix.append(f"task_type={meta['task_type']}")
        lines.append(f"{index}. {fact}" + (f" ({', '.join(suffix)})" if suffix else ""))
    return "\n".join(lines)


def normalize_user_memory_entries(payload: Any) -> list[dict[str, str]]:
    if not isinstance(payload, list):
        return []

    normalized: list[dict[str, str]] = []
    seen_keys: set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            continue
        field_key = str(item.get("field_key") or "").strip().lower()
        fact = str(item.get("fact") or "").strip()
        if not field_key or not fact:
            continue
        if len(field_key) > 80 or len(fact) > 300:
            continue
        if field_key in seen_keys:
            continue
        seen_keys.add(field_key)
        normalized.append({"field_key": field_key, "fact": fact})
    return normalized


def normalize_agent_memory_entries(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, list):
        return []

    normalized: list[dict[str, Any]] = []
    seen_facts: set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            continue
        fact = str(item.get("fact") or "").strip()
        if not fact or len(fact) > 400:
            continue
        key = fact.lower()
        if key in seen_facts:
            continue
        seen_facts.add(key)
        normalized.append(
            {
                "fact": fact,
                "domain": str(item.get("domain") or "").strip().lower(),
                "target_domain": str(item.get("target_domain") or "").strip().lower(),
                "task_type": str(item.get("task_type") or "").strip(),
                "confidence": float(item.get("confidence") or 0.6),
            }
        )
    return normalized


class Mem0MemoryStore:
    def __init__(self, agent_id: str = "") -> None:
        self.app_id = os.getenv("MEM0_APP_ID", "").strip()
        self.agent_id = (agent_id or os.getenv("MEM0_AGENT_ID", "")).strip()
        self.vector_dim = int(os.getenv("MEMORY_VECTOR_DIM", "768").strip() or "768")
        self.user_collection = (
            os.getenv("MEM0_USER_COLLECTION", "interfaceai_mem0_user").strip()
            or "interfaceai_mem0_user"
        )
        self.agent_collection = (
            os.getenv("MEM0_AGENT_COLLECTION", "interfaceai_mem0_agent").strip()
            or "interfaceai_mem0_agent"
        )
        self.user_client = self._build_client(self.user_collection)
        self.agent_client = self._build_client(self.agent_collection)

    def _build_client(self, collection_name: str):
        from mem0 import Memory

        api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv(
            "GOOGLE_API_KEY", ""
        ).strip()
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY (or GOOGLE_API_KEY) env var.")

        llm_model = os.getenv("MEM0_LLM_MODEL", "gemini-2.5-flash").strip()
        embed_model = os.getenv(
            "MEMORY_EMBEDDING_MODEL", "models/gemini-embedding-001"
        ).strip()
        db_url = (
            os.getenv("MEMORY_DATABASE_URL", "").strip()
            or _hardcoded_db_url()
            or os.getenv("DATABASE_URL", "").strip()
        )

        if not db_url:
            raise RuntimeError(
                "Missing MEMORY_DATABASE_URL (or DATABASE_URL) for local Mem0 PGVector."
            )

        config = {
            "llm": {
                "provider": "gemini",
                "config": {"api_key": api_key, "model": llm_model},
            },
            "embedder": {
                "provider": "gemini",
                "config": {
                    "api_key": api_key,
                    "model": embed_model,
                    "embedding_dims": self.vector_dim,
                },
            },
            "vector_store": {
                "provider": "pgvector",
                "config": {
                    "connection_string": db_url,
                    "collection_name": collection_name,
                    "embedding_model_dims": self.vector_dim,
                    "hnsw": True,
                },
            },
            "version": "v1.1",
        }
        return Memory.from_config(config)

    def backend_name(self) -> str:
        return "mem0-local"

    def _normalize_results(self, response: Any) -> list[dict[str, Any]]:
        items = response.get("results", []) if isinstance(response, dict) else response
        normalized = []
        for item in items or []:
            if not isinstance(item, dict):
                continue
            metadata = item.get("metadata") or {}
            normalized.append(
                {
                    "id": item.get("id") or "",
                    "fact": item.get("memory") or item.get("text") or "",
                    "metadata": metadata,
                    "field_key": metadata.get("field_key", ""),
                    "updated_at": item.get("updated_at") or "",
                }
            )
        return normalized

    def _get_user_memories_for_field(
        self,
        *,
        user_id: str,
        field_key: str,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for candidate_user_id in _user_id_variants(user_id):
            response = self.user_client.get_all(user_id=candidate_user_id, limit=200)
            for item in self._normalize_results(response):
                if item.get("field_key") != field_key:
                    continue
                item_id = str(item.get("id") or "").strip()
                if item_id and item_id in seen_ids:
                    continue
                if item_id:
                    seen_ids.add(item_id)
                results.append(item)
        return results

    def add_user_memory(
        self,
        *,
        user_id: str,
        fact: str,
        field_key: str = "",
        source: str = "conversation",
    ) -> None:
        if not user_id or not fact:
            return
        user_id_variants = _user_id_variants(user_id)
        normalized_user_id = user_id_variants[0] if user_id_variants else ""
        normalized_fact = fact.strip()
        normalized_field_key = field_key.strip()
        metadata = {
            "memory_kind": "user_profile",
            "field_key": normalized_field_key,
            "source": source,
        }

        if normalized_field_key:
            existing = self._get_user_memories_for_field(
                user_id=normalized_user_id,
                field_key=normalized_field_key,
            )
            if existing:
                for duplicate in existing:
                    duplicate_id = str(duplicate.get("id") or "").strip()
                    if duplicate_id:
                        self.user_client.delete(memory_id=duplicate_id)

        self.user_client.add(
            [{"role": "user", "content": normalized_fact}],
            metadata=metadata,
            user_id=normalized_user_id,
            infer=False,
        )

    def search_user_memories(
        self,
        *,
        user_id: str,
        query: str = "",
        field_key: str = "",
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        if not user_id:
            return []
        results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        seen_facts: set[str] = set()
        for candidate_user_id in _user_id_variants(user_id):
            response = self.user_client.search(
                query or "What do you know about this user?",
                user_id=candidate_user_id,
                limit=max(limit * 3, 20),
            )
            for item in self._normalize_results(response):
                item_id = str(item.get("id") or "").strip()
                fact_key = str(item.get("fact") or "").strip().lower()
                if item_id and item_id in seen_ids:
                    continue
                if fact_key and fact_key in seen_facts:
                    continue
                if item_id:
                    seen_ids.add(item_id)
                if fact_key:
                    seen_facts.add(fact_key)
                results.append(item)
        if field_key:
            results = [item for item in results if item.get("field_key") == field_key]
        return results[:limit]

    def list_user_memories(
        self,
        *,
        user_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        if not user_id:
            return []
        results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for candidate_user_id in _user_id_variants(user_id):
            response = self.user_client.get_all(
                user_id=candidate_user_id, limit=max(limit, 20)
            )
            for item in self._normalize_results(response):
                item_id = str(item.get("id") or "").strip()
                if item_id and item_id in seen_ids:
                    continue
                if item_id:
                    seen_ids.add(item_id)
                results.append(item)
        deduped: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        seen_facts: set[str] = set()
        for item in results:
            field_key = str(item.get("field_key") or "").strip().lower()
            fact = str(item.get("fact") or "").strip()
            if not fact:
                continue
            dedupe_key = field_key or fact.lower()
            if dedupe_key in seen_keys or fact.lower() in seen_facts:
                continue
            seen_keys.add(dedupe_key)
            seen_facts.add(fact.lower())
            deduped.append(item)
            if len(deduped) >= limit:
                break
        return deduped

    def delete_user_memory(
        self,
        *,
        user_id: str,
        field_key: str = "",
        memory_id: str = "",
    ) -> int:
        user_id_variants = _user_id_variants(user_id)
        normalized_user_id = user_id_variants[0] if user_id_variants else ""
        normalized_memory_id = (memory_id or "").strip()
        normalized_field_key = (field_key or "").strip().lower()
        if not normalized_user_id:
            return 0

        if normalized_memory_id:
            self.user_client.delete(memory_id=normalized_memory_id)
            return 1

        if not normalized_field_key:
            return 0

        deleted = 0
        for item in self._get_user_memories_for_field(
            user_id=normalized_user_id,
            field_key=normalized_field_key,
        ):
            candidate_id = str(item.get("id") or "").strip()
            if not candidate_id:
                continue
            self.user_client.delete(memory_id=candidate_id)
            deleted += 1
        return deleted

    def add_agent_memory(
        self,
        *,
        fact: str,
        domain: str = "",
        target_domain: str = "",
        task_type: str = "",
        source: str = "post_run_reflection",
        confidence: float = 0.6,
    ) -> None:
        if not self.agent_id:
            return
        if not fact:
            return
        self.agent_client.add(
            [{"role": "user", "content": fact.strip()}],
            metadata={
                "memory_kind": "agent_playbook",
                "domain": domain.strip().lower(),
                "target_domain": target_domain.strip().lower(),
                "task_type": task_type.strip(),
                "source": source,
                "confidence": confidence,
            },
            agent_id=self.agent_id,
            infer=False,
        )

    def search_agent_memories(
        self,
        *,
        goal: str,
        current_domain: str = "",
        target_domain: str = "",
        task_type: str = "",
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        if not self.agent_id:
            return []
        response = self.agent_client.search(
            goal or "Shared browser-agent knowledge",
            agent_id=self.agent_id,
            limit=max(limit * 4, 30),
        )
        results = self._normalize_results(response)

        def score(item: dict[str, Any]) -> tuple[float, str]:
            meta = item.get("metadata") or {}
            value = float(meta.get("confidence") or 0.0)
            if target_domain and (
                meta.get("target_domain") == target_domain
                or meta.get("domain") == target_domain
            ):
                value += 6.0
            if current_domain and meta.get("domain") == current_domain:
                value += 1.0
            if task_type and meta.get("task_type") == task_type:
                value += 2.0
            value += float(min(len(_keywords(goal) & _keywords(item.get("fact", ""))), 3))
            return value, str(item.get("updated_at") or "")

        results.sort(key=score, reverse=True)
        return results[:limit]

    def list_agent_memories(
        self,
        *,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        if not self.agent_id:
            return []
        response = self.agent_client.get_all(agent_id=self.agent_id, limit=max(limit, 20))
        results = self._normalize_results(response)
        deduped: list[dict[str, Any]] = []
        seen_facts: set[str] = set()
        for item in results:
            fact = str(item.get("fact") or "").strip()
            if not fact:
                continue
            fact_key = fact.lower()
            if fact_key in seen_facts:
                continue
            seen_facts.add(fact_key)
            deduped.append(item)
            if len(deduped) >= limit:
                break
        return deduped


class PostgresMemoryStore:
    def __init__(self, agent_id: str = "") -> None:
        self.agent_id = (agent_id or os.getenv("MEM0_AGENT_ID", "")).strip()
        self.agent_user_id = (
            os.getenv("MEMORY_AGENT_USER_ID", "__agent__").strip() or "__agent__"
        )
        self.database_url = (
            os.getenv("MEMORY_DATABASE_URL", "").strip()
            or _hardcoded_db_url()
            or os.getenv("DATABASE_URL", "").strip()
        )
        if not self.database_url:
            raise RuntimeError("Missing MEMORY_DATABASE_URL or DATABASE_URL env var.")
        self.use_pgvector = os.getenv("MEMORY_USE_PGVECTOR", "0").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        self.vector_dim = int(os.getenv("MEMORY_VECTOR_DIM", "768").strip() or "768")
        self.embedding_model_name = os.getenv(
            "MEMORY_EMBEDDING_MODEL", "models/text-embedding-004"
        ).strip()
        self.embedding_model = self._build_embedding_model() if self.use_pgvector else None
        if os.getenv("MEMORY_AUTO_MIGRATE", "1").strip().lower() not in {
            "0",
            "false",
            "no",
            "off",
        }:
            self._ensure_schema()

    def backend_name(self) -> str:
        return "postgres"

    def _connect(self):
        return psycopg.connect(self.database_url)

    def _build_embedding_model(self):
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "MEMORY_USE_PGVECTOR=1 requires GEMINI_API_KEY for embedding generation."
            )
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        return GoogleGenerativeAIEmbeddings(
            model=self.embedding_model_name, google_api_key=api_key
        )

    @staticmethod
    def _as_dict(value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                return {}
        return {}

    def _embed_text(self, text: str) -> list[float] | None:
        if not self.embedding_model:
            return None
        compact = (text or "").strip()
        if not compact:
            return None
        vector = self.embedding_model.embed_query(compact)
        if not isinstance(vector, list) or not vector:
            return None
        if len(vector) != self.vector_dim:
            raise RuntimeError(
                f"Embedding dim mismatch: expected {self.vector_dim}, got {len(vector)}."
            )
        return [float(v) for v in vector]

    @staticmethod
    def _vector_literal(vector: list[float] | None) -> str | None:
        if not vector:
            return None
        return "[" + ",".join(f"{v:.8f}" for v in vector) + "]"

    @staticmethod
    def _build_user_memory_text(field_key: str, fact: str) -> str:
        return f"user_profile {field_key}: {fact}".strip()

    @staticmethod
    def _build_agent_memory_text(
        fact: str, domain: str, target_domain: str, task_type: str
    ) -> str:
        parts = [fact]
        if domain:
            parts.append(f"domain={domain}")
        if target_domain:
            parts.append(f"target_domain={target_domain}")
        if task_type:
            parts.append(f"task_type={task_type}")
        return " | ".join(parts)

    def _ensure_schema(self) -> None:
        statements = [
            """
            CREATE TABLE IF NOT EXISTS profiles (
                user_id TEXT PRIMARY KEY,
                preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CHECK (jsonb_typeof(preferences) = 'object')
            )
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_profiles_user_updated
            ON profiles (user_id, updated_at DESC)
            """,
            """
            CREATE TABLE IF NOT EXISTS memories (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                data JSONB NOT NULL DEFAULT '{}'::jsonb,
                thread_id TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CHECK (jsonb_typeof(data) = 'object')
            )
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_memories_user_kind_created
            ON memories (user_id, kind, created_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_memories_thread_kind_created
            ON memories (thread_id, kind, created_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_memories_data_gin
            ON memories USING GIN (data)
            """,
        ]
        with self._connect() as conn:
            with conn.cursor() as cur:
                if self.use_pgvector:
                    cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
                for statement in statements:
                    cur.execute(statement)
                if self.use_pgvector:
                    cur.execute(
                        f"ALTER TABLE memories ADD COLUMN IF NOT EXISTS embedding vector({self.vector_dim})"
                    )
                    cur.execute(
                        """
                        CREATE INDEX IF NOT EXISTS idx_memories_embedding_ivfflat
                        ON memories USING ivfflat (embedding vector_cosine_ops)
                        WITH (lists = 100)
                        """
                    )
            conn.commit()

    def add_user_memory(
        self,
        *,
        user_id: str,
        fact: str,
        field_key: str = "",
        source: str = "conversation",
    ) -> None:
        normalized_user_id = (user_id or "").strip()
        normalized_fact = (fact or "").strip()
        normalized_field_key = (field_key or "").strip().lower()
        if not normalized_user_id or not normalized_fact:
            return
        if not normalized_field_key:
            normalized_field_key = "general"
        vector = None
        if self.use_pgvector:
            vector = self._embed_text(
                self._build_user_memory_text(normalized_field_key, normalized_fact)
            )
        vector_literal = self._vector_literal(vector)
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT preferences FROM profiles WHERE user_id = %s",
                    (normalized_user_id,),
                )
                row = cur.fetchone()
                preferences = self._as_dict(row[0]) if row else {}
                preferences[normalized_field_key] = normalized_fact
                cur.execute(
                    """
                    INSERT INTO profiles (user_id, preferences, created_at, updated_at)
                    VALUES (%s, %s::jsonb, NOW(), NOW())
                    ON CONFLICT (user_id)
                    DO UPDATE SET
                        preferences = EXCLUDED.preferences,
                        updated_at = NOW()
                    """,
                    (
                        normalized_user_id,
                        json.dumps(preferences),
                    ),
                )
                cur.execute(
                    (
                        """
                        INSERT INTO memories (user_id, kind, data, thread_id, embedding)
                        VALUES (%s, %s, %s::jsonb, %s, %s::vector)
                        """
                        if self.use_pgvector
                        else """
                        INSERT INTO memories (user_id, kind, data, thread_id)
                        VALUES (%s, %s, %s::jsonb, %s)
                        """
                    ),
                    (
                        (
                            normalized_user_id,
                            "user_profile",
                            json.dumps(
                                {
                                    "field_key": normalized_field_key,
                                    "fact": normalized_fact,
                                    "source": source,
                                }
                            ),
                            self.agent_id or "",
                            vector_literal,
                        )
                        if self.use_pgvector
                        else (
                            normalized_user_id,
                            "user_profile",
                            json.dumps(
                                {
                                    "field_key": normalized_field_key,
                                    "fact": normalized_fact,
                                    "source": source,
                                }
                            ),
                            self.agent_id or "",
                        )
                    ),
                )
            conn.commit()

    def search_user_memories(
        self,
        *,
        user_id: str,
        query: str = "",
        field_key: str = "",
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        normalized_user_id = (user_id or "").strip()
        normalized_field_key = (field_key or "").strip().lower()
        if not normalized_user_id:
            return []

        scanned_limit = max(limit * 12, 120)
        query_vector_literal = None
        if self.use_pgvector and query.strip():
            query_vector = self._embed_text(query)
            query_vector_literal = self._vector_literal(query_vector)
        with self._connect() as conn:
            with conn.cursor() as cur:
                if self.use_pgvector and query_vector_literal:
                    if normalized_field_key:
                        cur.execute(
                            """
                            SELECT id, data, created_at
                            FROM memories
                            WHERE user_id = %s
                              AND kind = 'user_profile'
                              AND data->>'field_key' = %s
                              AND embedding IS NOT NULL
                            ORDER BY embedding <=> %s::vector
                            LIMIT %s
                            """,
                            (
                                normalized_user_id,
                                normalized_field_key,
                                query_vector_literal,
                                scanned_limit,
                            ),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT id, data, created_at
                            FROM memories
                            WHERE user_id = %s
                              AND kind = 'user_profile'
                              AND embedding IS NOT NULL
                            ORDER BY embedding <=> %s::vector
                            LIMIT %s
                            """,
                            (normalized_user_id, query_vector_literal, scanned_limit),
                        )
                else:
                    if normalized_field_key:
                        cur.execute(
                            """
                            SELECT id, data, created_at
                            FROM memories
                            WHERE user_id = %s
                              AND kind = 'user_profile'
                              AND data->>'field_key' = %s
                            ORDER BY created_at DESC
                            LIMIT %s
                            """,
                            (normalized_user_id, normalized_field_key, scanned_limit),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT id, data, created_at
                            FROM memories
                            WHERE user_id = %s
                              AND kind = 'user_profile'
                            ORDER BY created_at DESC
                            LIMIT %s
                            """,
                            (normalized_user_id, scanned_limit),
                        )
                memory_rows = cur.fetchall()
                cur.execute(
                    "SELECT preferences, updated_at FROM profiles WHERE user_id = %s",
                    (normalized_user_id,),
                )
                profile_row = cur.fetchone()

        query_terms = _keywords(query or "")
        scored: list[tuple[float, dict[str, Any]]] = []
        seen: set[tuple[str, str]] = set()

        for row in memory_rows:
            payload = self._as_dict(row[1])
            fact = str(payload.get("fact") or "").strip()
            key = str(payload.get("field_key") or "").strip().lower()
            if not fact:
                continue
            dedupe_key = (key, fact.lower())
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            item = {
                "id": str(row[0]),
                "fact": fact,
                "metadata": {
                    "memory_kind": "user_profile",
                    "field_key": key,
                    "source": payload.get("source", "conversation"),
                },
                "field_key": key,
                "updated_at": row[2].isoformat() if row[2] else "",
            }
            score = 0.0
            if query_terms:
                score += float(len(query_terms & _keywords(item["fact"])))
            if item["field_key"] == normalized_field_key and normalized_field_key:
                score += 3.0
            scored.append((score, item))

        if profile_row:
            preferences = self._as_dict(profile_row[0])
            updated_at = profile_row[1].isoformat() if profile_row[1] else ""
            for key, value in preferences.items():
                key_s = str(key).strip().lower()
                fact = str(value).strip()
                if not key_s or not fact:
                    continue
                if normalized_field_key and key_s != normalized_field_key:
                    continue
                dedupe_key = (key_s, fact.lower())
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                item = {
                    "id": f"profile:{normalized_user_id}:{key_s}",
                    "fact": fact,
                    "metadata": {
                        "memory_kind": "user_profile",
                        "field_key": key_s,
                        "source": "profile_preferences",
                    },
                    "field_key": key_s,
                    "updated_at": updated_at,
                }
                score = 0.5
                if query_terms:
                    score += float(len(query_terms & _keywords(item["fact"])))
                if key_s == normalized_field_key and normalized_field_key:
                    score += 3.0
                scored.append((score, item))

        scored.sort(key=lambda pair: (pair[0], pair[1]["updated_at"]), reverse=True)
        return [item for _, item in scored[:limit]]

    def list_agent_memories(
        self,
        *,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        if not self.agent_id:
            return []
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, data, created_at
                    FROM memories
                    WHERE kind = 'agent_playbook'
                      AND thread_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (self.agent_id, max(limit * 3, 50)),
                )
                rows = cur.fetchall()

        deduped: list[dict[str, Any]] = []
        seen_facts: set[str] = set()
        for row in rows:
            metadata = self._as_dict(row[1])
            fact = str(metadata.get("fact") or "").strip()
            if not fact:
                continue
            fact_key = fact.lower()
            if fact_key in seen_facts:
                continue
            seen_facts.add(fact_key)
            metadata.setdefault("domain", "")
            metadata.setdefault("target_domain", "")
            metadata.setdefault("task_type", "")
            metadata.setdefault("confidence", 0.0)
            deduped.append(
                {
                    "id": str(row[0]),
                    "fact": fact,
                    "metadata": metadata,
                    "field_key": metadata.get("field_key", ""),
                    "updated_at": row[2].isoformat() if row[2] else "",
                }
            )
            if len(deduped) >= limit:
                break
        return deduped

    def list_user_memories(
        self,
        *,
        user_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        return self.search_user_memories(user_id=user_id, query="", limit=limit)

    def delete_user_memory(
        self,
        *,
        user_id: str,
        field_key: str = "",
        memory_id: str = "",
    ) -> int:
        normalized_user_id = (user_id or "").strip()
        normalized_field_key = (field_key or "").strip().lower()
        normalized_memory_id = (memory_id or "").strip()
        if not normalized_user_id:
            return 0

        deleted = 0
        with self._connect() as conn:
            with conn.cursor() as cur:
                if normalized_memory_id and normalized_memory_id.isdigit():
                    cur.execute(
                        """
                        DELETE FROM memories
                        WHERE id = %s
                          AND user_id = %s
                          AND kind = 'user_profile'
                        """,
                        (int(normalized_memory_id), normalized_user_id),
                    )
                    deleted += cur.rowcount or 0

                if normalized_field_key:
                    cur.execute(
                        "SELECT preferences FROM profiles WHERE user_id = %s",
                        (normalized_user_id,),
                    )
                    row = cur.fetchone()
                    preferences = self._as_dict(row[0]) if row else {}
                    if normalized_field_key in preferences:
                        preferences.pop(normalized_field_key, None)
                        cur.execute(
                            """
                            INSERT INTO profiles (user_id, preferences, created_at, updated_at)
                            VALUES (%s, %s::jsonb, NOW(), NOW())
                            ON CONFLICT (user_id)
                            DO UPDATE SET
                                preferences = EXCLUDED.preferences,
                                updated_at = NOW()
                            """,
                            (normalized_user_id, json.dumps(preferences)),
                        )

                    cur.execute(
                        """
                        DELETE FROM memories
                        WHERE user_id = %s
                          AND kind = 'user_profile'
                          AND data->>'field_key' = %s
                        """,
                        (normalized_user_id, normalized_field_key),
                    )
                    deleted += cur.rowcount or 0
            conn.commit()
        return deleted

    def add_agent_memory(
        self,
        *,
        fact: str,
        domain: str = "",
        target_domain: str = "",
        task_type: str = "",
        source: str = "post_run_reflection",
        confidence: float = 0.6,
    ) -> None:
        if not self.agent_id:
            return
        normalized_fact = (fact or "").strip()
        if not normalized_fact:
            return
        metadata = {
            "memory_kind": "agent_playbook",
            "fact": normalized_fact,
            "domain": (domain or "").strip().lower(),
            "target_domain": (target_domain or "").strip().lower(),
            "task_type": (task_type or "").strip(),
            "source": source,
            "confidence": float(confidence),
        }
        vector = None
        if self.use_pgvector:
            vector = self._embed_text(
                self._build_agent_memory_text(
                    metadata["fact"],
                    metadata["domain"],
                    metadata["target_domain"],
                    metadata["task_type"],
                )
            )
        vector_literal = self._vector_literal(vector)
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    (
                        """
                        INSERT INTO memories (user_id, kind, data, thread_id, embedding)
                        VALUES (%s, %s, %s::jsonb, %s, %s::vector)
                        """
                        if self.use_pgvector
                        else """
                        INSERT INTO memories (user_id, kind, data, thread_id)
                        VALUES (%s, %s, %s::jsonb, %s)
                        """
                    ),
                    (
                        (
                            self.agent_user_id,
                            "agent_playbook",
                            json.dumps(metadata),
                            self.agent_id,
                            vector_literal,
                        )
                        if self.use_pgvector
                        else (
                            self.agent_user_id,
                            "agent_playbook",
                            json.dumps(metadata),
                            self.agent_id,
                        )
                    ),
                )
            conn.commit()

    def search_agent_memories(
        self,
        *,
        goal: str,
        current_domain: str = "",
        target_domain: str = "",
        task_type: str = "",
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        if not self.agent_id:
            return []
        query_vector_literal = None
        if self.use_pgvector and goal.strip():
            query_vector = self._embed_text(goal)
            query_vector_literal = self._vector_literal(query_vector)
        with self._connect() as conn:
            with conn.cursor() as cur:
                if self.use_pgvector and query_vector_literal:
                    cur.execute(
                        """
                        SELECT id, data, created_at
                        FROM memories
                        WHERE kind = 'agent_playbook'
                          AND thread_id = %s
                          AND embedding IS NOT NULL
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s
                        """,
                        (self.agent_id, query_vector_literal, max(limit * 20, 120)),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, data, created_at
                        FROM memories
                        WHERE kind = 'agent_playbook'
                          AND thread_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (self.agent_id, max(limit * 20, 120)),
                    )
                rows = cur.fetchall()

        normalized_current = (current_domain or "").strip().lower()
        normalized_target = (target_domain or "").strip().lower()
        normalized_task_type = (task_type or "").strip()
        goal_terms = _keywords(goal or "")
        scored: list[tuple[float, dict[str, Any]]] = []

        for row in rows:
            metadata = self._as_dict(row[1])
            fact = str(metadata.get("fact") or "").strip()
            if not fact:
                continue
            metadata.setdefault("domain", "")
            metadata.setdefault("target_domain", "")
            metadata.setdefault("task_type", "")
            metadata.setdefault("confidence", 0.0)
            item = {
                "id": str(row[0]),
                "fact": fact,
                "metadata": metadata,
                "field_key": metadata.get("field_key", ""),
                "updated_at": row[2].isoformat() if row[2] else "",
            }
            value = float(metadata.get("confidence") or 0.0)
            if normalized_target and (
                metadata.get("target_domain") == normalized_target
                or metadata.get("domain") == normalized_target
            ):
                value += 6.0
            if normalized_current and metadata.get("domain") == normalized_current:
                value += 1.0
            if normalized_task_type and metadata.get("task_type") == normalized_task_type:
                value += 2.0
            value += float(min(len(goal_terms & _keywords(item["fact"])), 3))
            scored.append((value, item))

        scored.sort(key=lambda pair: (pair[0], pair[1]["updated_at"]), reverse=True)
        return [item for _, item in scored[:limit]]


class BrowserMemoryStore:
    def __init__(self, agent_id: str = "") -> None:
        backend = os.getenv("MEMORY_BACKEND", "mem0").strip().lower()
        if backend in {"postgres", "postgresql", "pg"}:
            self.impl = PostgresMemoryStore(agent_id=agent_id)
        else:
            self.impl = Mem0MemoryStore(agent_id=agent_id)

    def backend_name(self) -> str:
        return self.impl.backend_name()

    def add_user_memory(
        self,
        *,
        user_id: str,
        fact: str,
        field_key: str = "",
        source: str = "conversation",
    ) -> None:
        self.impl.add_user_memory(
            user_id=user_id,
            fact=fact,
            field_key=field_key,
            source=source,
        )

    def search_user_memories(
        self,
        *,
        user_id: str,
        query: str = "",
        field_key: str = "",
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        return self.impl.search_user_memories(
            user_id=user_id,
            query=query,
            field_key=field_key,
            limit=limit,
        )

    def list_user_memories(
        self,
        *,
        user_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        return self.impl.list_user_memories(
            user_id=user_id,
            limit=limit,
        )

    def delete_user_memory(
        self,
        *,
        user_id: str,
        field_key: str = "",
        memory_id: str = "",
    ) -> int:
        return self.impl.delete_user_memory(
            user_id=user_id,
            field_key=field_key,
            memory_id=memory_id,
        )

    def add_agent_memory(
        self,
        *,
        fact: str,
        domain: str = "",
        target_domain: str = "",
        task_type: str = "",
        source: str = "post_run_reflection",
        confidence: float = 0.6,
    ) -> None:
        self.impl.add_agent_memory(
            fact=fact,
            domain=domain,
            target_domain=target_domain,
            task_type=task_type,
            source=source,
            confidence=confidence,
        )

    def search_agent_memories(
        self,
        *,
        goal: str,
        current_domain: str = "",
        target_domain: str = "",
        task_type: str = "",
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        return self.impl.search_agent_memories(
            goal=goal,
            current_domain=current_domain,
            target_domain=target_domain,
            task_type=task_type,
            limit=limit,
        )

    def list_agent_memories(
        self,
        *,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        return self.impl.list_agent_memories(limit=limit)
