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

1. Generate a key pair: `npm run tesla:keys`
2. Host `keys/public-key.pem` at  
   `https://YOUR_DOMAIN/.well-known/appspecific/com.tesla.3p.public-key.pem`  
   (local API also serves this path once the file exists)
3. Register the app at [developer.tesla.com](https://developer.tesla.com/)
4. Set in `.env`:
   - `AUTH_MODE=tesla`
   - `TESLA_CLIENT_ID` / `TESLA_CLIENT_SECRET` / `TESLA_REDIRECT_URI`
   - `TESLA_DOMAIN=your.domain`
5. Open **Setup** in the app for a live checklist

Fleet Telemetry configure (vehicle → your always-on receiver) is still a follow-up step after OAuth + virtual key pairing.

## Telemetry ingest (dev)

```bash
curl -X POST http://localhost:3001/internal/telemetry \
  -H "content-type: application/json" \
  -H "x-telemetry-secret: $INTERNAL_TELEMETRY_SECRET" \
  -d '{"events":[{"type":"drive_start","vin":"MOCK3VIN000000001","occurredAt":"2026-08-10T12:00:00.000Z","odometer":12100,"lat":40.71,"lng":-74.01}]}'
```
