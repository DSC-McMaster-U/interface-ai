# InterfaceAI - Quick Start Guide

Simple steps to get the project running and contribute.

---

## 1. Clone Repository

```bash
git clone <repository-url>
cd interface-ai
```

---

## 2. Get Dependencies

### Python Services (backend, playwright, vision-ai)

```bash
cd backend
pip install -r requirements.txt
cd ../playwright
pip install -r requirements.txt
cd ../vision-ai
pip install -r requirements.txt
cd ..
```

### Frontend

```bash
cd frontend
npm install
cd ..
```

---

## 3. Docker Setup

### Start All Services

```bash
docker compose up --build
```

This starts:
- Backend API at `http://localhost:5000`
- Redis at `localhost:6379`
- PostgreSQL at `localhost:5432`
- Playwright worker
- Vision-AI service (optional)

### Stop Services

```bash
docker compose down
```

### Health Check

Test the backend:
```bash
curl http://localhost:5000/health
```

---

## 4. Local Development (Without Docker)

### Backend

```bash
cd backend
pip install -r requirements.txt
python app/main.py
```

### Frontend

```bash
cd frontend
npm install
# No separate server needed - it's a Chrome extension
```

---

## 5. Load Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Toggle **"Developer mode"** (top-right)
3. Click **"Load unpacked"**
4. Select the `frontend/` directory
5. Pin the extension icon
6. Click the extension icon to open the popup

**Note**: Make sure the backend is running at `http://localhost:5000` for the extension to work.

---

## 6. Run Lint, Format, and Tests

**Before creating a PR, always run:**

```bash
# Format and lint code
./run-lint-formatter.sh

# Run all tests
./run-tests.sh
```

This ensures your code passes all checks before pushing.

**Windows users**: Use Git Bash or WSL to run these scripts, or run commands individually (see [CICD.md](./CICD.md)).

---

## 7. Create Pull Request

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run lint/format/tests:
   ```bash
   ./run-lint-formatter.sh
   ./run-tests.sh
   ```

4. Commit and push:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin feature/your-feature-name
   ```

5. Open a Pull Request on GitHub

**All checks must pass** (tests, linting, formatting) before your PR can be merged.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start Docker services | `docker compose up --build` |
| Stop Docker services | `docker compose down` |
| Format & lint code | `./run-lint-formatter.sh` |
| Run tests | `./run-tests.sh` |
| Check backend health | `curl http://localhost:5000/health` |

---

## Need More Details?

- **Docker & Local Dev**: See [DEVOPS.md](./DEVOPS.md)
- **Tests, Linters, Formatters**: See [CICD.md](./CICD.md)

