import os
from typing import Any
from urllib.parse import urlparse

from mem0 import MemoryClient


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


class BrowserMemoryStore:
    def __init__(self, agent_id: str = "") -> None:
        self.app_id = os.getenv("MEM0_APP_ID", "").strip()
        self.agent_id = (agent_id or os.getenv("MEM0_AGENT_ID", "")).strip()
        self.client = self._build_client()

    def _scope_kwargs(
        self,
        *,
        user_id: str = "",
        agent_id: str = "",
    ) -> dict[str, Any]:
        kwargs: dict[str, Any] = {}
        if user_id:
            kwargs["user_id"] = user_id
        if agent_id:
            kwargs["agent_id"] = agent_id
        if self.app_id:
            kwargs["app_id"] = self.app_id
        return kwargs

    def _scope_filters(
        self,
        *,
        user_id: str = "",
        agent_id: str = "",
    ) -> dict[str, Any]:
        filters = []
        if user_id:
            filters.append({"user_id": user_id})
        if agent_id:
            filters.append({"agent_id": agent_id})
        if self.app_id:
            filters.append({"app_id": self.app_id})
        if not filters:
            return {}
        if len(filters) == 1:
            return filters[0]
        return {"AND": filters}

    def _build_client(self):
        api_key = os.getenv("MEM0_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("Missing MEM0_API_KEY env var.")
        if not self.agent_id:
            raise RuntimeError("Missing MEM0_AGENT_ID env var.")

        kwargs: dict[str, Any] = {"api_key": api_key}
        org_id = os.getenv("MEM0_ORG_ID", "").strip()
        project_id = os.getenv("MEM0_PROJECT_ID", "").strip()
        if org_id:
            kwargs["org_id"] = org_id
        if project_id:
            kwargs["project_id"] = project_id
        return MemoryClient(**kwargs)

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
        response = self.client.get_all(
            filters=self._scope_filters(user_id=user_id.strip()),
            version="v2",
        )
        return [
            item
            for item in self._normalize_results(response)
            if item.get("field_key") == field_key
        ]

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
        normalized_user_id = user_id.strip()
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
                primary = existing[0]
                primary_id = str(primary.get("id") or "").strip()
                if primary_id:
                    self.client.update(
                        memory_id=primary_id,
                        text=normalized_fact,
                        metadata=metadata,
                    )
                for duplicate in existing[1:]:
                    duplicate_id = str(duplicate.get("id") or "").strip()
                    if duplicate_id:
                        self.client.delete(memory_id=duplicate_id)
                return

        self.client.add(
            [{"role": "user", "content": normalized_fact}],
            **self._scope_kwargs(user_id=normalized_user_id),
            metadata=metadata,
            version="v2",
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
        response = self.client.search(
            query or "What do you know about this user?",
            version="v2",
            filters=self._scope_filters(user_id=user_id.strip()),
        )
        results = self._normalize_results(response)
        if field_key:
            results = [item for item in results if item.get("field_key") == field_key]
        return results[:limit]

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
        if not fact:
            return
        self.client.add(
            [{"role": "user", "content": fact.strip()}],
            **self._scope_kwargs(agent_id=self.agent_id),
            metadata={
                "memory_kind": "agent_playbook",
                "domain": domain.strip().lower(),
                "target_domain": target_domain.strip().lower(),
                "task_type": task_type.strip(),
                "source": source,
                "confidence": confidence,
            },
            version="v2",
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
        response = self.client.search(
            goal or "Shared browser-agent knowledge",
            version="v2",
            filters=self._scope_filters(agent_id=self.agent_id),
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
