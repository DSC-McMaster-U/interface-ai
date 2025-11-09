# InterfaceAI DevOps Guide

Quick reference for development, formatting, linting, testing, and Docker operations.

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

## Code Quality & Testing

### Setup
```bash
# Install Python dev tools
pip install -r dev-requirements.txt
```

### Commands

**Check for issues (does NOT modify files):**

**Linux/Mac:**
```bash
make check  # Check lint & format issues
make test   # Run Python tests
```

**Windows:**
```cmd
.\dev check  # Check lint & format issues
.\dev test   # Run Python tests
```

**Docker:**
```bash
make docker-check  # Check in Docker
make docker-test   # Test in Docker
```

**Fix issues locally:**

**Linux/Mac:**
```bash
make format  # Auto-fix lint & format Python code
```

**Windows:**
```cmd
.\dev format  # Auto-fix lint & format Python code
```

**Docker:**
```bash
make docker-format  # Format in Docker
```

### Ruff Commands (Direct)

```bash
# Check for issues (no changes)
ruff check .
ruff format --check .

# Auto-fix issues
ruff check . --fix
ruff format .
```

### Tools Used

**Python:**
- **ruff** - Fast linter & formatter (replaces black, isort, flake8)
- **pytest** - Testing framework

### CI/CD

On push to `main` or `develop`, GitHub Actions automatically:
1. Checks code with Ruff (identifies errors, does NOT fix)
2. Runs Python tests
3. Fails if issues found (you must fix locally)

See: `.github/workflows/ci.yml`

## Notes
- **CORS/extension**: Backend allows `http://localhost:*` and `chrome-extension://*`. Ensure the backend is reachable at `http://localhost:5000` for the extension in `frontend/`.
- **Profiles**: `vision-ai` is optional via the `vision` profile; include `--profile vision` when starting it.
- **Caching**: Avoid touching `requirements.txt` unless needed; it invalidates Docker's layer cache and slows builds.
