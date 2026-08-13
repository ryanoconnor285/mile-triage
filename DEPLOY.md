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
| `PORT` | Leave unset (Railway sets it, often `8080`) or set `3001` — **must match** the port in web’s `API_UPSTREAM` |
| `AUTH_MODE` | `mock` (until Tesla is ready) |
| `WEB_ORIGIN` | your public web URL, e.g. `https://web-production-xxxx.up.railway.app` (no quotes, no trailing slash) |
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
| `API_UPSTREAM` | **Required on web.** Api base URL — public: `https://YOUR-API-DOMAIN.up.railway.app` (recommended). Internal: `http://SERVICE-NAME.railway.internal:8080`. Set as a plain string, not a reference, unless private networking is confirmed working. |

**If `API_UPSTREAM` keeps reverting:** Railway may auto-set it when services are linked. Delete the variable, redeploy, then add your value again as a **raw string** (not `{api...}` reference). Do not bake this in the Dockerfile — it must live in Railway web service variables only.

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

Tesla requires a domain whose **root** (second-level + top-level) matches your
app's allowed origins, so `*.up.railway.app` will not work — buy a domain and add
it to the **web** service under Settings → Networking → Custom Domain.

1. Point your domain at the **web** service and wait for the certificate to issue
2. `npm run tesla:keys` locally (keep `private-key.pem` out of git)
3. Register the app at [developer.tesla.com](https://developer.tesla.com/) with
   allowed origin `YOUR_DOMAIN` and redirect URI
   `https://YOUR_DOMAIN/api/auth/tesla/callback`; add a payment method + billing limit
4. On the **api** service, set:
   - `AUTH_MODE=tesla`
   - `TESLA_CLIENT_ID` / `TESLA_CLIENT_SECRET`
   - `TESLA_REDIRECT_URI=https://YOUR_DOMAIN/api/auth/tesla/callback`
   - `TESLA_DOMAIN=YOUR_DOMAIN` (bare hostname)
   - `TESLA_PUBLIC_KEY_PEM` = contents of `keys/public-key.pem`
   - `WEB_ORIGIN=https://YOUR_DOMAIN`
5. Verify `https://YOUR_DOMAIN/.well-known/appspecific/com.tesla.3p.public-key.pem`
   returns the PEM
6. `npm run tesla:register` (once per region; verifies the hosted key first)
7. Sign in with **Connect Tesla**, then pair at `https://tesla.com/_ak/YOUR_DOMAIN`
8. (Next engineering task) Wire Fleet Telemetry configure → ingest, otherwise no
   drives arrive automatically
