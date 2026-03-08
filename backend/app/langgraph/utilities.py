import json
import time
from typing import Any

from langchain_core.messages import BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI


def content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
                else:
                    parts.append(json.dumps(item, ensure_ascii=True))
            else:
                parts.append(str(item))
        return " ".join(p.strip() for p in parts if p).strip()
    if isinstance(content, dict):
        text = content.get("text")
        if isinstance(text, str):
            return text.strip()
        return json.dumps(content, ensure_ascii=True)
    return str(content).strip()


def parse_verdict_json(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        pass
    if "```" in raw:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except Exception:
                return {}
    return {}


def invoke_with_retry(
    model: ChatGoogleGenerativeAI,
    messages: list[BaseMessage],
    retries: int = 2,
):
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return model.invoke(messages)
        except Exception as exc:
            last_exc = exc
            if attempt >= retries:
                raise
            time.sleep(0.75 * (attempt + 1))
    raise last_exc if last_exc else RuntimeError("invoke failed")
