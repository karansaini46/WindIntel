# WindIntel — Deployment Guide

This guide covers local development, Docker Compose orchestration, and cloud deployment of WindIntel across Vercel (frontend) and Render (backend).

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
1. Push this repository to GitHub/GitLab.
2. In Render, select **New > Blueprint** and link your repository.
3. Render will automatically detect `render.yaml` and configure:
   - Python 3.12 Web Service (`windintel-api`)
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Persistent Disk: Mounted at `/app/data` to preserve the SQLite cache.
   - Health Check Path: `/api/health`
4. Note your deployed Render backend URL (e.g. `https://windintel-api.onrender.com`).

### 3.2 Deploying Frontend to Vercel
1. In Vercel, click **Add New > Project** and import the repository.
2. Root Directory: `./` (or `frontend` depending on configuration).
3. The included `vercel.json` automatically configures Vite builds and proxies `/api/*` requests to your Render backend.
4. Set Environment Variable in Vercel Project Settings:
   - `VITE_API_BASE_URL`: `https://windintel-api.onrender.com`
5. Deploy.

---

## 4. Environment Variables Reference

| Variable | Default | Scope | Description |
| :--- | :--- | :--- | :--- |
| `ENV` | `development` | Backend | Runtime environment (`development`, `production`). |
| `DEBUG` | `false` | Backend | Enable verbose logging. |
| `PORT` | `8000` | Backend | Port binding for Uvicorn server. |
| `DEFAULT_DECISION_CUTOFF` | `12:00:00` | Backend | Operational day-ahead cutoff time in `Europe/London`. |
| `MARKET_TIMEZONE` | `Europe/London` | Backend | GB electricity market timezone. |
| `CACHE_DB_PATH` | `windintel.db` | Backend | Path to persistent SQLite cache file. |
| `CACHE_TTL_SECONDS` | `2592000` (30 days) | Backend | Expiration time for cached responses. |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Backend | Explicit authorized frontend origins (JSON array without wildcards). |
| `VITE_API_BASE_URL` | `""` (proxied in dev) | Frontend | Absolute URL of the backend API for cloud deployments. |
