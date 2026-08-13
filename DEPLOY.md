# Deploying MileTriage

## What must stay online

For **real Tesla logging**, the API (+ telemetry later) and Postgres must be always-on. The web UI can share that host.

## Railway (recommended for you)

### Choose on the create-project screen

Pick **GitHub Repository** (not Docker Image, not Bucket).

Docker Image = you already built/pushed an image elsewhere.  
Bucket = object storage.  
GitHub = Railway builds from this repo using our Dockerfiles.

### Before Railway

1. Commit and push this repo to GitHub (`ryanoconnor285/mile-triage`).
2. Railway needs the latest code on `main`.

### Create the project

1. **New Project → GitHub Repository → `mile-triage`**
2. If it asks to deploy immediately, you can cancel/skip and add services manually, or let it create one service and reconfigure it.

### Add Postgres

1. In the project: **Add Service → Database → PostgreSQL**
2. Keep it running (do **not** enable sleep/serverless).
3. **Use the same region** as api and web (Railway private networking only works within one region).

### API service

1. **Add Service → GitHub Repo** (same `mile-triage` repo), name it `api`
2. Force Docker builds (Railpack will fail on this monorepo). Pick **one**:
   - **Easiest:** Variables → add `RAILWAY_DOCKERFILE_PATH` = `Dockerfile.api`
   - **Or:** Settings → Config-as-code → set config file to `/railway.api.toml`
   - **Or:** Settings → Build → Builder = Dockerfile, Dockerfile path = `Dockerfile.api`
3. Root directory must be repo root (`/` / empty), not `apps/api`
3. Variables (API service):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Use Railway’s Postgres variable reference (e.g. `${{Postgres.DATABASE_URL}}`) |
| `PORT` | Leave unset so Railway injects it, **or** set `3001` and use port `3001` when generating the public domain |
| `AUTH_MODE` | `mock` (until Tesla is ready) |
| `WEB_ORIGIN` | your public web URL, e.g. `https://web-production-xxxx.up.railway.app` (update after web is live) |
| `TOKEN_ENCRYPTION_KEY` | long random string |
| `INTERNAL_TELEMETRY_SECRET` | long random string |
| `SESSION_SECRET` | long random string |
| `DEFAULT_MILEAGE_RATE` | `0.70` |

4. Networking: generate a domain **or** leave private if web proxies via private network.
5. Disable **Serverless / App Sleeping** on this service.

### Web service

1. **Add Service → GitHub Repo** (same repo), name it `web`
2. Settings:
   - **Dockerfile path:** `Dockerfile.web`
3. Variables:

| Variable | Value |
|----------|--------|
| `PORT` | `80` (must match the port you chose when generating the public domain) |
| `API_UPSTREAM` | Private API URL, typically `http://api.railway.internal:3001` (service name must match; check Railway private networking hostname) |

4. Generate a **public domain** for `web` — when Railway asks for the port, enter **`80`** (or `${{PORT}}` if shown; nginx listens on Railway’s `PORT`).
5. Go back to API and set `WEB_ORIGIN` to that web HTTPS URL.
6. Disable sleep on web too (optional but fine).

### Verify

1. Open the web domain → **Continue with demo**
2. You should land on triage with seeded/demo flows (or empty inbox + Simulate drive)
3. `https://<web-domain>/api/health` should return `{"ok":true,...}`

### Custom domain later

Point your domain at the **web** service. Tesla public key must be reachable at:

`https://YOUR_DOMAIN/.well-known/appspecific/com.tesla.3p.public-key.pem`

(web proxies `/.well-known` to the API).

## Option B — Docker Compose (VPS / home server)

```bash
cp .env.example .env
# set secrets, WEB_ORIGIN=https://your.domain, etc.
npm run tesla:keys   # if using Tesla
docker compose -f docker-compose.prod.yml up -d --build
```

App: `http://localhost:8080` (or your reverse proxy → port 8080)

## Your next steps for live Tesla

1. Register app at [developer.tesla.com](https://developer.tesla.com/)
2. Own a domain; serve public key at `/.well-known/appspecific/com.tesla.3p.public-key.pem`
3. Add payment method + billing limit on Tesla developer portal
4. Set `AUTH_MODE=tesla` and client credentials in Railway env
5. Complete virtual key pairing
6. (Next engineering task) Wire Fleet Telemetry configure → ingest
