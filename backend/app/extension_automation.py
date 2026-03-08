import asyncio
import json
import os
import threading
from typing import Any

import websockets

EXTENSION_WS_PORT = int(os.getenv("EXTENSION_WS_PORT", "7878"))

_connected: Any = None
_pending: dict[int, asyncio.Future] = {}
_cmd_id = 0
_loop: asyncio.AbstractEventLoop | None = None


async def _handle_client(websocket):
    global _connected
    _connected = websocket
    print("[ExtensionAutomation] Browser connected")

    try:
        async for message in websocket:
            data = json.loads(message)

            if data.get("type") == "connected":
                print(f"[ExtensionAutomation] Tab: {data.get('title', '')} - {data.get('url', '')}")
                continue

            if data.get("type") == "result":
                rid = data.get("id")
                future = _pending.pop(rid, None)
                if future and not future.done():
                    future.set_result(data.get("result", {}))
    finally:
        _connected = None
        print("[ExtensionAutomation] Browser disconnected")


async def _send_event(event: dict[str, Any]) -> bool:
    if _connected is None:
        return False
    await _connected.send(json.dumps(event))
    return True


async def _send_command(action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    global _cmd_id

    if _connected is None:
        return {"success": False, "error": "No browser connected"}

    _cmd_id += 1
    request_id = _cmd_id
    future = asyncio.get_running_loop().create_future()
    _pending[request_id] = future

    payload = {"id": request_id, "action": action, "params": params or {}}
    await _connected.send(json.dumps(payload))

    try:
        return await asyncio.wait_for(future, timeout=15)
    except asyncio.TimeoutError:
        _pending.pop(request_id, None)
        return {"success": False, "error": "Timeout"}


def is_server_running() -> bool:
    return _loop is not None


def send_agent_log(message: str) -> dict[str, Any]:
    if _loop is None:
        return {"success": False, "error": "WebSocket server not running"}

    task = asyncio.run_coroutine_threadsafe(
        _send_event({"type": "agent_log", "message": message}),
        _loop,
    )
    sent = bool(task.result(timeout=5))
    return {"success": sent}


def send_command_sync(action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if _loop is None:
        return {"success": False, "error": "WebSocket server not running"}

    task = asyncio.run_coroutine_threadsafe(_send_command(action, params), _loop)
    try:
        return task.result(timeout=20)
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def _run_server() -> None:
    global _loop
    _loop = asyncio.get_running_loop()

    async with websockets.serve(_handle_client, "0.0.0.0", EXTENSION_WS_PORT):
        print(f"[ExtensionAutomation] WebSocket server on ws://0.0.0.0:{EXTENSION_WS_PORT}")
        await asyncio.Future()


def start_websocket_server() -> threading.Thread:
    thread = threading.Thread(target=lambda: asyncio.run(_run_server()), daemon=True)
    thread.start()
    return thread
