# Extension Automation

## Screenshot – Where It Saves

| Context | Save location |
|---------|----------------|
| **Frontend Test Panel** | Screenshots are **not saved**. The result contains a base64 `dataUrl` only. |
| **Node CLI** (`node action-execution/test-extension/cli.js`) | Saves to current working directory: `screenshot [filename].png` (default: `screenshot-{timestamp}.png`). |
| **Backend API** | `POST /api/extension/screenshot` with body `{"path": "/tmp/screenshot.png"}` saves to the given path on the backend host. |

## Backend → Extension Flow

1. Backend runs a WebSocket server on port **7878**.
2. The extension’s `automation.js` connects to `ws://localhost:7878`.
3. Backend sends commands as JSON: `{ "id": N, "action": "...", "params": {...} }`.
4. Extension replies: `{ "type": "result", "id": N, "result": {...} }`.

## Backend API

- `POST /api/extension/command` – Run any action: `{ "action": "getPageStatus", "params": {} }`
- `POST /api/extension/screenshot` – Screenshot: `{ "path": "/tmp/screenshot.png" }` (optional)
- `GET /api/extension/health` – Check if the WebSocket server is running

## Demo: YouTube → Gaming → Netflix

After backend start, it waits 10 seconds, then:

1. Navigate to https://www.youtube.com  
2. Pause 10 seconds  
3. Click the "Gaming" button  
4. Pause 10 seconds  
5. Navigate to https://www.netflix.com  
6. Pause 10 seconds  

Ensure the extension is loaded and an active tab is on a normal web page before the demo runs.

## Running With Docker

```bash
# Start backend (exposes 5000 and 7878)
docker compose up backend

# Or build/run backend only
docker build -t backend ./backend
docker run -p 5000:5000 -p 7878:7878 backend
```

Port **7878** must be published so the extension (Chrome on the host) can connect.

To disable the demo:

```bash
RUN_EXTENSION_DEMO=false docker compose up backend
```
