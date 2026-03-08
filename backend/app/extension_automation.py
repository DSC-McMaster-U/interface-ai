"""
Extension Automation - WebSocket server for Chrome extension automation.
The extension (automation.js) connects to ws://localhost:7878.
This module sends commands and receives results.
"""

import asyncio
import json
import os
import threading
from typing import Any

EXTENSION_WS_PORT = int(os.getenv("EXTENSION_WS_PORT", "7878"))

_connected: Any = None
_pending: dict[int, asyncio.Future] = {}
_cmd_id = 0
_loop: asyncio.AbstractEventLoop | None = None


async def _handle_client(websocket):
    global _connected, _pending
    _connected = websocket
    print("[ExtensionAutomation] Browser connected")

    try:
        async for msg in websocket:
            try:
                data = json.loads(msg)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")
            if msg_type == "connected":
                print(
                    f"[ExtensionAutomation] Tab: {data.get('title', '')} - {data.get('url', '')}"
                )
                continue

            if msg_type == "result":
                rid = data.get("id")
                result = data.get("result", {})
                if rid is not None and rid in _pending:
                    _pending[rid].set_result(result)
                    del _pending[rid]
    finally:
        _connected = None
        print("[ExtensionAutomation] Browser disconnected")


async def _send_command(action: str, params: dict | None = None) -> dict[str, Any]:
    global _cmd_id, _pending
    if _connected is None:
        return {"success": False, "error": "No browser connected"}

    _cmd_id += 1
    rid = _cmd_id
    future: asyncio.Future = asyncio.get_running_loop().create_future()
    _pending[rid] = future

    await _connected.send(json.dumps({"id": rid, "action": action, "params": params or {}}))

    try:
        result = await asyncio.wait_for(future, timeout=15.0)
        return result
    except asyncio.TimeoutError:
        if rid in _pending:
            del _pending[rid]
        return {"success": False, "error": "Timeout"}
    finally:
        pass


async def _send_event(event: dict[str, Any]) -> bool:
    if _connected is None:
        return False
    await _connected.send(json.dumps(event))
    return True


def send_event_sync(event: dict[str, Any]) -> dict[str, Any]:
    if _loop is None:
        return {"success": False, "error": "WebSocket server not running"}
    future = asyncio.run_coroutine_threadsafe(_send_event(event), _loop)
    try:
        ok = future.result(timeout=5)
        return {"success": True, "sent": bool(ok)}
    except Exception as e:
        return {"success": False, "error": str(e)}


def send_agent_log(message: str) -> dict[str, Any]:
    return send_event_sync({"type": "agent_log", "message": message})


def send_command_sync(action: str, params: dict | None = None) -> dict[str, Any]:
    """Send a command to the extension and wait for result. Blocking."""
    if _loop is None:
        return {"success": False, "error": "WebSocket server not running"}

    future = asyncio.run_coroutine_threadsafe(_send_command(action, params or {}), _loop)
    try:
        return future.result(timeout=20)
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _run_server():
    global _loop
    import websockets

    _loop = asyncio.get_running_loop()
    async with websockets.serve(_handle_client, "0.0.0.0", EXTENSION_WS_PORT):
        print(f"[ExtensionAutomation] WebSocket server on ws://0.0.0.0:{EXTENSION_WS_PORT}")
        await asyncio.Future()


def start_websocket_server():
    """Start WebSocket server in a background thread."""

    def run():
        asyncio.run(_run_server())

    t = threading.Thread(target=run, daemon=True)
    t.start()
    return t


def run_demo_sequence():
    """Demo: YouTube -> Gaming -> Netflix."""
    import time

    print("[ExtensionAutomation] Demo starting in 10 seconds (ensure extension tab is active)...")
    send_agent_log("Demo starting in 10 seconds...")
    time.sleep(10)

    steps = [
        ("goto", {"url": "https://www.youtube.com"}),
        ("clickByName", {"name": "Gaming"}),
        ("goto", {"url": "https://www.netflix.com"}),
    ]

    for i, (action, params) in enumerate(steps, 1):
        print(f"\n[ExtensionAutomation] Step {i}: {action} {params}")
        send_agent_log(f"Step {i}: {action} {params}")
        result = send_command_sync(action, params)
        print(f"[ExtensionAutomation] Result: {result}")
        send_agent_log(f"Result {i}: {result}")

        if i < len(steps):
            print("[ExtensionAutomation] Waiting 10 seconds...")
            send_agent_log("Waiting 10 seconds...")
            time.sleep(10)

    print("\n[ExtensionAutomation] Demo complete.")
    send_agent_log("Demo complete.")
