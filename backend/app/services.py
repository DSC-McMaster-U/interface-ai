"""
Client helpers to call Vision-AI and Playwright service APIs.
Configure via env: VISION_AI_URL, PLAYWRIGHT_URL.
"""

import os
from typing import Any

import requests

VISION_AI_URL = os.getenv("VISION_AI_URL", "http://localhost:6000").rstrip("/")
PLAYWRIGHT_URL = os.getenv("PLAYWRIGHT_URL", "http://localhost:7000").rstrip("/")
REQUEST_TIMEOUT = int(os.getenv("SERVICE_REQUEST_TIMEOUT", "30"))


def _get(url: str, **kwargs) -> requests.Response:
    return requests.get(url, timeout=REQUEST_TIMEOUT, **kwargs)


def _post(url: str, **kwargs) -> requests.Response:
    return requests.post(url, timeout=REQUEST_TIMEOUT, **kwargs)


# ---------------------------------------------------------------------------
# Vision-AI
# ---------------------------------------------------------------------------


def vision_ai_health() -> tuple[bool, str]:
    """Call Vision-AI GET /health. Returns (ok, message)."""
    try:
        r = _get(f"{VISION_AI_URL}/health")
        return r.status_code == 200, r.text.strip() if r.text else ""
    except Exception as e:
        return False, str(e)


def vision_ai_analyze(text: str) -> tuple[bool, dict[str, Any], str]:
    """
    Call Vision-AI POST /analyze with {"text": text}.
    Returns (success, response_json, error_message).
    """
    try:
        r = _post(f"{VISION_AI_URL}/analyze", json={"text": text or ""})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code != 200:
            return False, data, f"status {r.status_code}"
        return True, data, ""
    except Exception as e:
        return False, {}, str(e)


# ---------------------------------------------------------------------------
# Playwright
# ---------------------------------------------------------------------------


def playwright_health() -> tuple[bool, str]:
    """Call Playwright GET /health. Returns (ok, message)."""
    try:
        r = _get(f"{PLAYWRIGHT_URL}/health")
        return r.status_code == 200, r.text.strip() if r.text else ""
    except Exception as e:
        return False, str(e)


def playwright_navigate(url: str) -> tuple[bool, dict[str, Any], str]:
    """
    Call Playwright POST /navigate with {"url": url}.
    Returns (success, response_json, error_message).
    """
    try:
        r = _post(f"{PLAYWRIGHT_URL}/navigate", json={"url": url})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code != 200:
            return False, data, data.get("error", f"status {r.status_code}")
        return True, data, ""
    except Exception as e:
        return False, {}, str(e)


def playwright_click(text: str, exact: bool = False) -> tuple[bool, dict[str, Any], str]:
    """
    Call Playwright POST /click with {"text": text, "exact": exact}.
    Returns (success, response_json, error_message).
    """
    try:
        r = _post(f"{PLAYWRIGHT_URL}/click", json={"text": text, "exact": exact})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code != 200:
            return False, data, data.get("error", f"status {r.status_code}")
        return True, data, ""
    except Exception as e:
        return False, {}, str(e)


def playwright_fill(field: str, value: str) -> tuple[bool, dict[str, Any], str]:
    """Call Playwright POST /fill with {"field": field, "value": value}."""
    try:
        r = _post(f"{PLAYWRIGHT_URL}/fill", json={"field": field, "value": value})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code != 200:
            return False, data, data.get("error", f"status {r.status_code}")
        return True, data, ""
    except Exception as e:
        return False, {}, str(e)
