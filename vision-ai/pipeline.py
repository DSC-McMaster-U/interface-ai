import json
import os
import re
import sys
import time
from typing import Any, List, Tuple

from dotenv import load_dotenv
from google import genai
from PIL import Image

root_env_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".env",
)
load_dotenv(dotenv_path=root_env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY not found in .env file.")
    sys.exit(1)

_gemini_client: Any = None
VISION_MODEL = os.getenv("VISION_MODEL", "gemini-2.5-flash")


def init_services() -> None:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)


def _normalize_query(query: str) -> str:
    raw = (query or "").strip()
    lower = raw.lower()
    alias_map = {
        "q": "search input box",
        "query": "search input box",
        "search_query": "search input box",
        "searchterm": "search input box",
        "username": "username input field",
        "email": "email input field",
        "pwd": "password input field",
        "passwd": "password input field",
    }
    return alias_map.get(lower, raw or "target UI element")


def _candidate_queries(query: str) -> List[str]:
    normalized = _normalize_query(query)
    candidates: List[str] = [normalized]
    lower = normalized.lower()

    if "search" in lower:
        candidates.extend(
            [
                "main search input box",
                "editable search field",
                "large text search bar",
            ]
        )
    elif "input" in lower or "field" in lower:
        candidates.extend(["editable text input field", "text box"])

    unique: List[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        key = candidate.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(candidate.strip())
    return unique


def _resolve_candidate_queries(
    query: str,
    candidate_queries: List[str] | None,
    max_candidates: int,
) -> List[str]:
    chosen: List[str] = []
    if candidate_queries:
        for candidate in candidate_queries:
            normalized = str(candidate or "").strip()
            if normalized:
                chosen.append(normalized)

    if not chosen:
        chosen = _candidate_queries(query)

    unique: List[str] = []
    seen: set[str] = set()
    for candidate in chosen:
        key = candidate.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)
        if len(unique) >= max_candidates:
            break

    if not unique:
        unique = ["target UI element"]
    return unique


def _strip_json_fences(text: str) -> str:
    cleaned = (text or "").strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _parse_payload(text: str) -> Any:
    cleaned = _strip_json_fences(text)
    if not cleaned:
        raise ValueError("empty model response")

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(1))


def _extract_norm_box(payload: Any) -> list[float] | None:
    if isinstance(payload, list):
        if len(payload) >= 4 and all(isinstance(v, (int, float)) for v in payload[:4]):
            return [
                float(payload[0]),
                float(payload[1]),
                float(payload[2]),
                float(payload[3]),
            ]
        if payload:
            return _extract_norm_box(payload[0])

    if isinstance(payload, dict):
        if all(k in payload for k in ("ymin", "xmin", "ymax", "xmax")):
            return [
                float(payload["ymin"]),
                float(payload["xmin"]),
                float(payload["ymax"]),
                float(payload["xmax"]),
            ]

        for key in (
            "box",
            "bbox",
            "bounding_box",
            "boundingBox",
            "result",
            "candidate",
        ):
            if key in payload:
                extracted = _extract_norm_box(payload[key])
                if extracted:
                    return extracted

    return None


def _to_pixel_box(norm_box: list[float], width: int, height: int) -> tuple[int, int, int, int] | None:
    ymin, xmin, ymax, xmax = norm_box

    # Some models return 0..1; normalize to 0..1000 first.
    if max(abs(v) for v in (ymin, xmin, ymax, xmax)) <= 1.0:
        ymin *= 1000.0
        xmin *= 1000.0
        ymax *= 1000.0
        xmax *= 1000.0

    ymin = max(0.0, min(ymin, 1000.0))
    xmin = max(0.0, min(xmin, 1000.0))
    ymax = max(0.0, min(ymax, 1000.0))
    xmax = max(0.0, min(xmax, 1000.0))

    y1 = int((ymin / 1000.0) * height)
    x1 = int((xmin / 1000.0) * width)
    y2 = int((ymax / 1000.0) * height)
    x2 = int((xmax / 1000.0) * width)

    x1, x2 = min(x1, x2), max(x1, x2)
    y1, y2 = min(y1, y2), max(y1, y2)
    if x2 <= x1 or y2 <= y1:
        return None

    return x1, y1, x2, y2


def _build_prompt(query: str, width: int, height: int) -> str:
    return (
        f"Locate the exact UI element matching this target: '{query}'.\n"
        f"Image size is {width}x{height}.\n\n"
        "Rules:\n"
        "- If the target is a technical field name like 'q' or 'query', map it to the page's visible main search bar.\n"
        "- Prioritize interactive elements (input fields, buttons, links) over decorative text.\n"
        "- Return one best bounding box only if confidence is high; otherwise return found=false.\n"
        "- Do not explain anything.\n\n"
        "Respond with strict JSON only in this schema:\n"
        '{"found": true|false, "box": [ymin, xmin, ymax, xmax]}\n'
        "Coordinates must be normalized integers from 0 to 1000."
    )


def find_element_unified(
    image_path: str,
    query: str,
    *,
    candidate_queries: List[str] | None = None,
    max_candidates: int = 2,
    max_total_seconds: float = 10.0,
) -> Tuple[List[Tuple[int, int, int, int]], float, dict[str, Any]]:
    start_time = time.time()
    init_services()

    image = Image.open(image_path).convert("RGB")
    width, height = image.size

    last_error = ""
    attempted_queries: List[str] = []
    resolved_candidates = _resolve_candidate_queries(
        query,
        candidate_queries,
        max(1, min(int(max_candidates), 5)),
    )
    total_budget_seconds = max(2.0, float(max_total_seconds))

    for candidate_query in resolved_candidates:
        if (time.time() - start_time) >= total_budget_seconds:
            last_error = (
                f"time budget exceeded ({total_budget_seconds:.1f}s)"
            )
            break

        attempted_queries.append(candidate_query)
        prompt = _build_prompt(candidate_query, width, height)

        try:
            response = _gemini_client.models.generate_content(
                model=VISION_MODEL,
                contents=[image, prompt],
            )

            payload = _parse_payload(getattr(response, "text", ""))
            norm_box = _extract_norm_box(payload)
            if not norm_box:
                continue

            pixel_box = _to_pixel_box(norm_box, width, height)
            if not pixel_box:
                continue

            return [pixel_box], time.time() - start_time, {
                "attempted_queries": attempted_queries,
                "matched_query": candidate_query,
                "model": VISION_MODEL,
            }
        except Exception as exc:
            last_error = str(exc)
            continue

    if last_error:
        print(f"Vision lookup failed: {last_error}")
    return [], time.time() - start_time, {
        "attempted_queries": attempted_queries,
        "error": last_error,
        "model": VISION_MODEL,
    }
