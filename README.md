# MileTriage

Telematics-driven mileage classification for Tesla owners. Automatic drive capture, weekly map-based triage, CSV/PDF export.

## Stack

- `apps/web` — React + Vite + MapLibre
- `apps/api` — NestJS + Prisma + PostgreSQL
- `packages/shared` — shared Zod types

## Deploy

See [DEPLOY.md](./DEPLOY.md) for Docker Compose / Railway. Demo mode can stay local; live Tesla capture needs an always-on API + Postgres.

## Quick start

```bash
cp .env.example .env

# Start Postgres (Docker)
docker compose up -d

# Install + generate + migrate + seed
npm install
npm run db:generate
npm run db:migrate
npm run db:seed

# Run API + web
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001  

Use **Continue with demo** on the landing page (`AUTH_MODE=mock`) to triage seeded drives without Tesla credentials.

On the triage page you can:
- Classify drives (with optional business purpose note)
- Multi-select batch classify
- **Simulate drive** to push a new mock trip through the telemetry ingest pipeline

## Tesla mode

**A custom domain is required.** Tesla matches the registered domain against your
app's `allowed_origins` at the root (second-level + top-level), so shared hosts
like `*.up.railway.app` cannot be used — the root would be `railway.app`.

1. Generate a key pair: `npm run tesla:keys` (keep `private-key.pem` secret)
2. Register the app at [developer.tesla.com](https://developer.tesla.com/):
   - Allowed origin: your domain
   - Redirect URI: `https://YOUR_DOMAIN/api/auth/tesla/callback`
   - Add a payment method and a billing limit
3. Set on the API (`.env` locally, Railway variables when deployed):
   - `AUTH_MODE=tesla`
   - `TESLA_CLIENT_ID` / `TESLA_CLIENT_SECRET`
   - `TESLA_REDIRECT_URI=https://YOUR_DOMAIN/api/auth/tesla/callback`
   - `TESLA_DOMAIN=YOUR_DOMAIN` (bare hostname, no `https://`)
   - `TESLA_PUBLIC_KEY_PEM` — contents of `keys/public-key.pem`, needed when
     deploying from an image that has no `keys/` directory
4. Confirm the key is live at
   `https://YOUR_DOMAIN/.well-known/appspecific/com.tesla.3p.public-key.pem`
5. Register with Fleet API (once per region): `npm run tesla:register`
6. Sign in via **Connect Tesla**, then pair the car at `https://tesla.com/_ak/YOUR_DOMAIN`
7. Open **Setup** in the app for a live checklist

Steps 1–6 give you login and vehicle sync. Drives still won't populate until
Fleet Telemetry configure is wired — see `configureTelemetryStub`.

## Telemetry ingest (dev)

```bash
curl -X POST http://localhost:3001/internal/telemetry \
  -H "content-type: application/json" \
  -H "x-telemetry-secret: $INTERNAL_TELEMETRY_SECRET" \
  -d '{"events":[{"type":"drive_start","vin":"MOCK3VIN000000001","occurredAt":"2026-08-10T12:00:00.000Z","odometer":12100,"lat":40.71,"lng":-74.01}]}'
```
