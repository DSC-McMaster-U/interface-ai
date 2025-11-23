# InterfaceAI Dev Ops Cheatsheet

## Run a specific Docker container
- **Start one service (build if needed)**
```powershell
docker compose up --build backend
```
- **Start multiple services**
```powershell
docker compose up --build backend redis postgres
```
- **Start optional Vision-AI (profile)**
```powershell
docker compose --profile vision up --build vision-ai
```
- **Run one-off (ephemeral) task**
```powershell
docker compose run --rm playwright
```
- **Tail logs for one service**
```powershell
docker compose logs -f backend
```

## Apply changes when you edit code
- **Only Python code changed (no Dockerfile/requirements)**
  - `backend/` is volume-mounted (`- ./backend:/app`), so changes are visible immediately.
  - Restart the process to reload:
```powershell
docker compose restart backend
```
- **Dockerfile or requirements.txt changed**
  - Rebuild the service image, then restart:
```powershell
# Backend
docker compose build backend
docker compose up -d backend

# Playwright
docker compose build playwright
docker compose up -d playwright

# Vision-AI (behind profile)
docker compose --profile vision build vision-ai
docker compose --profile vision up -d vision-ai
```
- **Full stack rebuild (if unsure)**
```powershell
docker compose up --build -d
```

## Stop a specific Docker container
- **Stop without removing**
```powershell
docker compose stop backend
```
- **Stop and remove container**
```powershell
docker compose rm -f backend
```
- **Stop everything**
```powershell
docker compose down
```

## Run microservices locally without Docker (venv)
Use this for faster iteration. Windows PowerShell shown.

- **Create and activate a virtual environment**
```powershell
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

- **Playwright worker locally** (`playwright/worker.py`)
```powershell
python -m pip install -r playwright/requirements.txt
$env:BACKEND_URL = "http://localhost:5000"
python .\playwright\worker.py
```
Expected output:
- "Playwright worker starting…"
- "Backend health: ok"
- "Worker ready."

- **Vision-AI locally** (`vision-ai/service.py`)
```powershell
python -m pip install -r vision-ai/requirements.txt
$env:PORT = "6000"
python .\vision-ai\service.py
```
Health check:
```powershell
curl http://localhost:6000/health
```

- **Backend locally (optional)** (`backend/app/main.py`)
```powershell
python -m pip install -r backend/requirements.txt
$env:PORT = "5000"
python .\backend\app\main.py
```
Verify:
```powershell
curl http://localhost:5000/health
curl -X POST http://localhost:5000/api/relay -H "Content-Type: application/json" -d "{\"message\":\"world\"}"
```

## Notes
- **CORS/extension**: Backend allows `http://localhost:*` and `chrome-extension://*`. Ensure the backend is reachable at `http://localhost:5000` for the extension in `frontend/`.
- **Profiles**: `vision-ai` is optional via the `vision` profile; include `--profile vision` when starting it.
- **Caching**: Avoid touching `requirements.txt` unless needed; it invalidates Docker’s layer cache and slows builds.
