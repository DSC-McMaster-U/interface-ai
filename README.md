<h1 align="center">🤖 InterfaceAI</h1>

## 🚀 Project Overview

**InterfaceAI** is a Chrome extension that turns natural language into action.  
Ask it to “set up an AWS instance,” “book a flight,” or “open my calculus lecture,” and it will understand your intent, navigate webpages, and execute tasks directly on your screen.

By combining intent recognition, vision-based action execution, and contextual awareness, InterfaceAI goes beyond existing tools with autonomous webpage exploration and personalized digital profiles—building the next generation of AI agents that make technology work for you.

[View the Kanban / Task Board and more Info / Links](https://github.com/orgs/DSC-McMaster-U/projects/18/views/1?pane=issue&itemId=170290104&issue=DSC-McMaster-U%7Cinterface-ai%7C86)

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
| <img width="120" height="120" src="https://github.com/user-attachments/assets/f594f377-a326-49cd-9e18-c9caa5df4b59" alt="Sachin Gupta" /> | [**Sachin Gupta**](https://github.com/SachinVedGupta) <br/><i>Project Lead</i> | LangGraph · Mem0 · GCP | Ideation |
| <img width="120" height="120" src="https://github.com/user-attachments/assets/39fb4226-fc6b-4c90-9abf-b1526e744963" alt="Adrian Najmi" /> | [**Adrian Najmi**](https://github.com/adriancoder06) <br/><i>Open Source Dev</i> | Python · JavaScript · TypeScript · Chrome Extension APIs | Action Execution |
|  | [**Hassan Ibrahim**](https://github.com/Hassan-Ibrahim-1) <br/><i>Backend</i> | Python · Flask | Database Design |
|  | [**Luna Aljammal**](https://github.com/luna-aljammal) <br/><i>Backend + DB</i> | Python · Flask · Redis · GCP | Database Integration |
| <img width="120" height="120" src="https://github.com/user-attachments/assets/ca8c625c-dcfb-46a3-869e-6618afd8ae08" alt="Andrew Wu" /> | [**Andrew Wu**](https://github.com/andrewwu13) <br/><i>Frontend</i> | Python · JavaScript · GCP | UI, Frontend Development, Auth, Database |
| <img width="120" height="120" src="https://github.com/user-attachments/assets/dcc35212-8749-46a8-b5e3-6b38148f941a" alt="Mohit Gedela" />  | [**Mohit Gedela**](https://github.com/MohitGedela) <br/><i>Vision AI</i> | Python · Java · JavaScript | Vision AI Development |
| <img width="120" height="120" alt="Alex Melnbardis" src="https://github.com/user-attachments/assets/6af3cb9e-21cc-48ab-baaa-16cd99377259" /> | [**Alex Melnbardis**](https://github.com/amelnbardis2004) <br/><i>AI</i> | Python · TypeScript · LangGraph · Chrome Extension APIs · GCP | Vision AI |
|  | [**David Olejniczak**](https://github.com/davidolejniczak) <br/><i>CI/CD + Cloud</i> | CGP · Docker · Github Actions | CI/CD |
|  | [**Anhad Chawla**](https://github.com/AsmpSa00) <br/><i>AI Specialist + Solution Architect</i> | Python · LangGraph · GCP · BigTable | Agentic Workflows |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

---

### System Diagrams

Architecture
- Each service is isolated to allow for independant scaling

<img width="574" height="697" alt="image" src="https://github.com/user-attachments/assets/f8cc24f5-f2ea-4fc6-b5a3-f1b45428616b" />



User Interface
- Frictionless, Clean, Modern (Liquid Glass inspired design)

<img width="1209" height="402" alt="image" src="https://github.com/user-attachments/assets/138fca6d-db56-4c9a-8012-509075c09646" />



Langgraph Loop simulating Human Browser Behavior
- Agent can reason based on goal and use/call its tools (goto, click, fill_input, back, etc) to interact with the website
- Session state to track when its looping and force it to do a different approach/technique

<img width="379" height="704" alt="image" src="https://github.com/user-attachments/assets/ac90827e-a803-458e-8f53-0ee55ef6b42a" />



Database
- Google Sign-in / Auth
- User level memory to store preferences and information (prefers google over yahoo search, phone number, email, last name, etc)
- General Agent memory (learnings from previous successful/failed sessions and efficiency tips like "instead of going to youtube and typing in search bar" just do a direct "goto(https://www.youtube.com/results?search_query=xyz)"
  
<img width="525" height="582" alt="image" src="https://github.com/user-attachments/assets/b4f544db-a89c-4fff-9c6d-06901de58cb5" />



Vision AI
- Multi-modal model for detecting text and icons (like "gear" icon = settings page) in a screenshot
- Can also explain what is going on in the screen and what the main blocker is
- Used whenever the model gets stuck or for recognizing icons or for elements not part of the DOM/HTML

<img width="352" height="272" alt="image" src="https://github.com/user-attachments/assets/d5883c2c-5187-4a02-b7ae-cff79f41edaf" />


Action Execution
- Done via a chrome extension content script so it can be done right in your current tab
- Better compared to alternatives like playwright which open in a Chromium app (not Chrome) and within a new window/page
- Provides the functionality to navigate pages, click elements, type into fields, select form options, upload files, scroll, and inspect on-screen content (HTML / DOM)
- When the agent in the backend calls a tool like "click", via the websocket it is routed here and thus the approriate function is called to do the action on the screen

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
- **vision-ai:** Minimal Flask service (`vision-ai/service.py`)

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
├── vision-ai/
│   ├── Dockerfile
│   └── service.py
└── scripts/
```

---

## 🧰 Notes

- Backend CORS allows `http://localhost:*` and `chrome-extension://*` for simple dev flow.
- Update `frontend/manifest.json` `host_permissions` if backend URL changes.
