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

| Photo | Contributor | Role & Tools | Notable Contributions |
|:--:|:--|:--|:--|
| <img width="120" height="120" src="https://github.com/user-attachments/assets/f594f377-a326-49cd-9e18-c9caa5df4b59" alt="Sachin Gupta" /> | [**Sachin Gupta**](https://github.com/SachinVedGupta) <br/><i>Project Lead</i> | Python · PyTorch · GCP | Ideation |
| <img width="120" height="120" src="https://github.com/user-attachments/assets/39fb4226-fc6b-4c90-9abf-b1526e744963" alt="Adrian Najmi" /> | [**Adrian Najmi**](https://github.com/adriancoder06) <br/><i>Open Source Dev</i> | Python · JavaScript · TypeScript · Chrome Extension APIs | Action Execution |
|  | [**Hassan Ibrahim**](https://github.com/Hassan-Ibrahim-1) <br/><i>Backend</i> | Python · Flask | Database Design |
|  | [**Luna Aljammal**](https://github.com/luna-aljammal) <br/><i>Backend + DB</i> | Python · Flask · Redis · GCP | Database Integration |
| <img width="120" height="120" src="https://github.com/user-attachments/assets/ca8c625c-dcfb-46a3-869e-6618afd8ae08" alt="Andrew Wu" /> | [**Andrew Wu**](https://github.com/andrewwu13) <br/><i>Frontend</i> | Python · JavaScript · GCP | UI, Frontend Development, Auth, Database |
|  | [**Mohit Gedela**](https://github.com/MohitGedela) <br/><i>Vision AI</i> | Python · Java · JavaScript | Vision AI Development |
|  | [**Alex Melnbardis**](https://github.com/amelnbardis2004) <br/><i>AI</i> | Python · PyTorch · Playwright · LangGraph | AI Agents + Vision AI |
|  | [**David Olejniczak**](https://github.com/davidolejniczak) <br/><i>CI/CD + Cloud</i> | CGP · Docker · Github Actions | CI/CD |
|  | [**Anhad Chawla**](https://github.com/AsmpSa00) <br/><i>AI Specialist + Solution Architect</i> | Python · LangGraph · GCP · BigTable | Agentic Workflows |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

---

## For More Information...

### [Quick Start Guide](./documentation/OVERVIEW.md) - Get started in minutes

### [DevOps Cheatsheet](./documentation/DEVOPS.md) - Docker and local development

### [CI/CD Documentation](./documentation/CICD.md) - Tests, linters, and formatters

### [View the Project Roadmap](./PROJECT-ROADMAP.md)

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
