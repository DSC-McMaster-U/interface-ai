<h1 align="center">🤖 InterfaceAI</h1>

## 🚀 Project Overview

**InterfaceAI** is a Chrome extension that turns natural language into action.  
Ask it to “set up an AWS instance,” “book a flight,” or “open my calculus lecture,” and it will understand your intent, navigate webpages, and execute tasks directly on your screen.  

By combining intent recognition, vision-based action execution, and contextual awareness, InterfaceAI goes beyond existing tools with autonomous webpage exploration and personalized digital profiles—building the next generation of AI agents that make technology work for you.

---

### 🔑 Key Features (Planned for MVP)
- 💬 Natural language task execution (e.g., “Set up AWS instance”)
- 👀 Vision-based screen understanding and action execution
- 🌐 Autonomous webpage exploration
- 🧠 Contextual awareness for multi-step tasks
- 🪪 Personalized digital user profiles
- 🔒 Secure and privacy-first agent design

---

### 🛠️ Technologies
- **Frontend:** React + Chrome Extension APIs
- **Backend / Infra:** Flask, SQL
- **ML / AI:** Google Gemini API, OCR / Vision Models
- **Hosting / Deployment:** GCP (Cloud Run to easily deploy our docker containers, BigTable, BigQuery)

---

## Contributor 👨‍💻

| Contributor                                                                 | Role & Tools                                                                                          | Notable Contributions                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| [**Sachin Gupta**](https://github.com/SachinVedGupta) <br/><i>Project Lead</i> | Python · PyTorch · GCP | Ideation |
| [**Hassan Ibrahim**](https://github.com/Hassan-Ibrahim-1) <br/><i>Backend + DB</i> | Python · Flask | | |

---

## For More Information...
### [View the Project Roadmap](./PROJECT-ROADMAP.md)
### [View the DevOps Cheatsheet](./DEVOPS.md)

---

## 🧪 Local Development (Docker)

### Services
- **frontend:** Chrome Extension (`frontend`)
- **backend:** Flask API at `http://localhost:5000` (`backend/app/main.py`)
- **playwright:** Minimal Python worker (`playwright/worker.py`)
- **vision-ai:** Minimal Flask service (`vision-ai/service.py`)
- **redis:** Cache/queue at `localhost:6379`
- **postgres:** DB at `localhost:5432` with init script `scripts/init_db.sql`

### Run
```bash
docker compose up --build
```

Health checks:
- Backend: `GET http://localhost:5000/health`
- Relay: `POST http://localhost:5000/api/relay` with `{ "message": "hello" }`

To stop:
```bash
docker compose down
```

---

## 🧩 Chrome Extension Frontend

This repo includes a Chrome extension UI in `frontend/`:
- `frontend/manifest.json`
- `frontend/popup.html`
- `frontend/popup.js`

The popup sends a POST to `http://localhost:5000/api/relay` and displays the response. CORS and `host_permissions` are configured to allow this in development.

### Load the Extension
1. Open Chrome and go to `chrome://extensions`.
2. Toggle on "Developer mode" (top-right).
3. Click "Load unpacked" and select the `frontend/` directory.
4. Click the extension icon (puzzle piece) → pin "InterfaceAI MVP".
5. Open the popup, type a message, and click "Send to backend".

If you see CORS issues, ensure Docker services are running and the backend is reachable at `http://localhost:5000`.

---

## 📁 Repository Layout

```
interface-ai/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       └── main.py
├── frontend/
│   ├── manifest.json
│   ├── popup.html
│   └── popup.js
├── playwright/
│   ├── Dockerfile
│   └── worker.py
├── vision-ai/
│   ├── Dockerfile
│   └── service.py
└── scripts/
    └── init_db.sql
```

---

## 🧰 Notes
- Backend CORS allows `http://localhost:*` and `chrome-extension://*` for simple dev flow.
- Update `frontend/manifest.json` `host_permissions` if backend URL changes.
- Postgres credentials are development defaults; change for production.
