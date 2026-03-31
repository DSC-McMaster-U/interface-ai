import asyncio
import json
import threading
import time
from typing import Any

import websockets

EXTENSION_WS_PORT = 7878

_connected: Any = None
_pending: dict[int, asyncio.Future] = {}
_cmd_id = 0
_loop: asyncio.AbstractEventLoop | None = None
_log_queue: 'asyncio.Queue[dict[str, Any]] | None' = None

RECONNECT_WAIT_SECONDS = 25.0
COMMAND_TIMEOUT_SECONDS = 30.0


async def _wait_for_connection(timeout_seconds: float = RECONNECT_WAIT_SECONDS) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if _connected is not None:
            return True
        await asyncio.sleep(0.2)
    return _connected is not None


async def _handle_client(websocket):
    global _connected
    _connected = websocket
    print("[ExtensionAutomation] Browser connected")

    try:
        async for message in websocket:
            data = json.loads(message)

            if data.get("type") == "connected":
                print(
                    f"[ExtensionAutomation] Tab: {data.get('title', '')} - {data.get('url', '')}"
                )
                continue

            if data.get("type") == "result":
                rid = data.get("id")
                future = _pending.pop(rid, None)
                if future and not future.done():
                    future.set_result(data.get("result", {}))
    finally:
        _connected = None
        print("[ExtensionAutomation] Browser disconnected")
        
        # When browser disconnects (often due to navigation from a click or goto), 
        # resolve pending commands as success to avoid halting the agent loop.
        for rid, future in list(_pending.items()):
            if not future.done():
                future.set_result({"success": True, "message": "Browser disconnected (navigation triggered)"})
        _pending.clear()


async def _log_worker():
    while True:
        event = await _log_queue.get()
        if _connected is None:
            await _wait_for_connection(timeout_seconds=30.0)
        
        if _connected is not None:
            try:
                await _connected.send(json.dumps(event))
            except Exception:
                pass
        _log_queue.task_done()


async def _send_command(
    action: str, params: dict[str, Any] | None = None
) -> dict[str, Any]:
    global _cmd_id

    if _connected is None and not await _wait_for_connection():
        return {"success": False, "error": "No browser connected after reconnect wait"}

    _cmd_id += 1
    request_id = _cmd_id
    future = asyncio.get_running_loop().create_future()
    _pending[request_id] = future

    payload = {"id": request_id, "action": action, "params": params or {}}
    try:
        await _connected.send(json.dumps(payload))
    except Exception:
        if not await _wait_for_connection():
            _pending.pop(request_id, None)
            return {
                "success": False,
                "error": "No browser connected after reconnect wait",
            }
        try:
            await _connected.send(json.dumps(payload))
        except Exception as exc:
            _pending.pop(request_id, None)
            return {"success": False, "error": str(exc)}

    try:
        return await asyncio.wait_for(future, timeout=COMMAND_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        _pending.pop(request_id, None)
        return {
            "success": False,
            "error": "Extension command timeout (no browser response)",
        }


def is_server_running() -> bool:
    return _loop is not None


def send_agent_log(message: str) -> dict[str, Any]:
    if _loop is None or _log_queue is None:
        return {"success": False, "error": "WebSocket server not running"}

    def _enqueue():
        try:
            _log_queue.put_nowait({"type": "agent_log", "message": message})
        except Exception:
            pass

    _loop.call_soon_threadsafe(_enqueue)
    return {"success": True}


def send_command_sync(
    action: str, params: dict[str, Any] | None = None
) -> dict[str, Any]:
    if _loop is None:
        return {"success": False, "error": "WebSocket server not running"}

    task = asyncio.run_coroutine_threadsafe(_send_command(action, params), _loop)
    try:
        return task.result(timeout=40)
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def _run_server() -> None:
    global _loop, _log_queue
    _loop = asyncio.get_running_loop()
    _log_queue = asyncio.Queue()
    asyncio.create_task(_log_worker())

    async with websockets.serve(_handle_client, "0.0.0.0", EXTENSION_WS_PORT):
        print(
            f"[ExtensionAutomation] WebSocket server on ws://0.0.0.0:{EXTENSION_WS_PORT}"
        )
        await asyncio.Future()


def start_websocket_server() -> threading.Thread:
    thread = threading.Thread(target=lambda: asyncio.run(_run_server()), daemon=True)
    thread.start()
    return thread
