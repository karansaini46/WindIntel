# WindIntel — Deployment Guide

This guide covers local development, Docker Compose orchestration, and cloud deployment of WindIntel across **Render** (backend API) and **Vercel** (frontend dashboard).

---

## 0. Live Production Deployments

* **Frontend Dashboard (Vercel):** [https://windintel.vercel.app](https://windintel.vercel.app)
* **Backend API (Render):** [https://windintel.onrender.com](https://windintel.onrender.com)
* **Interactive OpenAPI Docs:** [https://windintel.onrender.com/docs](https://windintel.onrender.com/docs)
* **API Health Check:** [https://windintel.onrender.com/api/health](https://windintel.onrender.com/api/health)

---

## 1. Local Development Setup

### 1.1 Prerequisites
- Python 3.12+
- Node.js 20+ and npm 10+
- Docker and Docker Compose (optional for containerized run)

### 1.2 Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start backend on port 8080 (or your preferred port)
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```
Verify backend health:
```bash
curl http://127.0.0.1:8080/api/health
```

### 1.3 Frontend Setup
```bash
cd frontend
npm install

# Start Vite development server
npm run dev
```
Open `http://127.0.0.1:5173` in your browser. Vite automatically proxies `/api` calls to `http://127.0.0.1:8080`.

---

## 2. Docker Compose Deployment

WindIntel includes a fully orchestrated Docker Compose setup:
```bash
# Build and run containers
docker compose up --build -d

# View service logs
docker compose logs -f

# Check container health status
docker compose ps
```
- **Frontend Dashboard:** Available at `http://localhost:3000`
- **Backend API:** Available at `http://localhost:8080`
- **Interactive OpenAPI Docs:** Available at `http://localhost:8080/docs`
- **Persistent Data:** SQLite database stored in the `windintel_data` Docker volume.

To stop and remove containers:
```bash
docker compose down
```

---

## 3. Production Cloud Deployment

### 3.1 Deploying Backend to Render

Render hosts the FastAPI backend. You can deploy either using the Blueprint file ([`render.yaml`](../render.yaml)) or by manually linking the repository.

#### Manual Web Service Configuration (Docker Runtime):
When creating or configuring the Web Service in Render Dashboard under **Settings > Build & Deploy**:
- **Runtime:** `Docker`
- **Root Directory:** `backend` *(critical in monorepo to avoid root Dockerfile missing error)*
- **Dockerfile Path:** `Dockerfile` *(relative to root directory `backend`)*
- **Docker Build Context Directory:** `.` *(builds inside `backend/`)*
- **Docker Command:** *(Leave completely blank; Dockerfile provides the Uvicorn CMD)*
- **Health Check Path:** `/api/health`

#### Native Python Runtime (Alternative):
- **Runtime:** `Python 3`
- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

#### Environment Variables to Set on Render:
```env
ENV=production
DEBUG=false
CACHE_DB_PATH=/app/data/windintel.db
CORS_ORIGINS=["https://windintel.vercel.app","http://localhost:5173"]
```

> [!NOTE]
> The backend automatically validates `CORS_ORIGINS` whether provided as a JSON array or comma-separated list, and includes regex matching `^https:\/\/.*\.vercel\.app$` so all Vercel production and preview domains are allowed out of the box.

---

### 3.2 Deploying Frontend to Vercel

1. In Vercel, click **Add New > Project** and import the `karansaini46/WindIntel` repository.
2. Root Directory: `./` (Vercel automatically detects [`vercel.json`](../vercel.json)).
3. Configure the Production Environment Variable in Vercel Settings:
   - `VITE_API_BASE_URL`: `https://windintel.onrender.com`
4. Deploy.

#### Deploy via Vercel CLI:
```bash
npm install -g vercel
vercel login
vercel link
vercel env add VITE_API_BASE_URL production   # enter: https://windintel.onrender.com
vercel --prod
```

---

## 4. Environment Variables Reference

| Variable | Default | Scope | Description |
| :--- | :--- | :--- | :--- |
| `ENV` | `development` | Backend | Runtime environment (`development`, `production`). |
| `DEBUG` | `false` | Backend | Enable verbose logging. |
| `PORT` | Dynamic (`$PORT` on Render, `8000` local) | Backend | Port binding for Uvicorn server. |
| `DEFAULT_DECISION_CUTOFF` | `12:00:00` | Backend | Operational day-ahead cutoff time in `Europe/London`. |
| `MARKET_TIMEZONE` | `Europe/London` | Backend | GB electricity market timezone. |
| `CACHE_DB_PATH` | `windintel.db` | Backend | Path to persistent SQLite cache file (`/app/data/windintel.db` in container). |
| `CACHE_TTL_SECONDS` | `2592000` (30 days) | Backend | Expiration time for immutable historical responses. |
| `CORS_ORIGINS` | Includes `https://windintel.vercel.app`, localhost | Backend | Explicit authorized origins (JSON array or comma-separated). Regex permits `*.vercel.app`. |
| `VITE_API_BASE_URL` | `""` (proxied in dev) | Frontend | Absolute URL of the backend API (`https://windintel.onrender.com`). |

---

## 5. Troubleshooting & Gotchas

1. **`failed to read dockerfile: open Dockerfile: no such file or directory` on Render:**
   In Render Settings, ensure **Root Directory** is set to `backend`. Since this repository is a monorepo, leaving Root Directory blank forces Docker to look for `Dockerfile` at the repository root where none exists.
2. **`Failed to fetch / Disallowed CORS origin` on Frontend:**
   The backend enforces strict CORS for security. If deploying to a custom domain, add your frontend origin to `CORS_ORIGINS` on Render. All `*.vercel.app` domains are permitted by default via regular expression.
3. **Render Free Instance Sleep:**
   Render free tier instances spin down after 15 minutes of inactivity. Initial requests may take 30–50 seconds to cold-start.

