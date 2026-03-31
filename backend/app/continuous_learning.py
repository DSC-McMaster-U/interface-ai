import os
from typing import Any
from urllib.parse import urlparse

from app.db import get_database_url, normalize_user_id


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


class Mem0MemoryStore:
    def __init__(self, agent_id: str = "") -> None:
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

        api_key = (
            os.getenv("GEMINI_API_KEY", "").strip()
            or os.getenv("GOOGLE_API_KEY", "").strip()
        )
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY (or GOOGLE_API_KEY) env var.")

        llm_model = os.getenv("MEM0_LLM_MODEL", "gemini-2.5-flash").strip()
        embed_model = os.getenv(
            "MEMORY_EMBEDDING_MODEL", "models/gemini-embedding-001"
        ).strip()
        db_url = get_database_url()
        if not db_url:
            raise RuntimeError("Missing MEMORY_DATABASE_URL or DATABASE_URL env var.")

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
        return "mem0"

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
            normalized_field_key = str(item.get("field_key") or "").strip().lower()
            fact = str(item.get("fact") or "").strip()
            if not fact:
                continue
            dedupe_key = normalized_field_key or fact.lower()
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
        if not self.agent_id or not fact:
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
            value += float(
                min(len(_keywords(goal) & _keywords(item.get("fact", ""))), 3)
            )
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
        response = self.agent_client.get_all(
            agent_id=self.agent_id, limit=max(limit, 20)
        )
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

    def delete_agent_memory(
        self,
        *,
        memory_id: str,
    ) -> int:
        normalized_memory_id = (memory_id or "").strip()
        if not normalized_memory_id:
            return 0
        self.agent_client.delete(memory_id=normalized_memory_id)
        return 1
