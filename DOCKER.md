# SENTRY — Docker Reference

## Image architecture

The Dockerfile uses a two-stage build:

| Stage | Base image | Purpose |
|-------|-----------|---------|
| `builder` | `node:20-alpine` | Install all deps, compile TypeScript, build Vite client |
| `production` | `node:20-alpine` | Copy only production artefacts; run as non-root `sentry` user |

The production image runs as the `sentry` user (UID created at build time).
No secrets are baked into the image; supply them via `--env-file` or your
orchestrator's secret store.

---

## Prerequisites

- Docker ≥ 24
- Docker Compose ≥ 2.20 (optional, for local dev)
- A populated `.env` file (copy from `server/.env.example`)

---

## Build

```bash
# Build the production image
docker build -t sentry:latest .

# Build and tag for a specific registry
docker build -t ghcr.io/your-org/sentry:$(git rev-parse --short HEAD) .
```

---

## Run (production)

```bash
docker run \
  --rm \
  -p 3001:3001 \
  --env-file .env \
  sentry:latest
```

> **HTTPS** is handled at the reverse-proxy layer (nginx / Caddy / AWS ALB).
> The container speaks plain HTTP on port 3001; TLS termination and
> `Strict-Transport-Security` headers are the responsibility of the proxy.

---

## Docker Compose — production

```bash
# Copy and edit environment config
cp server/.env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_* …

docker compose up -d
```

The `app` service:
- builds from `./Dockerfile`
- exposes port `3001`
- reads env vars from `.env`
- has a health-check against `GET /api/health`
- persists data under a named volume `sentry-data`

---

## Docker Compose — local development

```bash
docker compose --profile dev up
```

The `dev` service:
- uses the `builder` stage (all dev deps included)
- mounts `./client/src` and `./server/src` for live reloading
- exposes port `5173` (Vite) and `3001` (Express)
- runs `npm run dev` (concurrently starts both processes)

---

## Health check

```bash
curl http://localhost:3001/api/health
# {"status":"ok","timestamp":"...","uptime":42}
```

Docker and Compose both poll this endpoint:
- interval: 30 s
- timeout: 10 s
- retries: 3
- start period: 40 s (allows the Node process to initialise)

---

## Environment variables

See `server/.env.example` for the full list.  Required in production:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS for backend ops) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Price ID for the Pro plan |
| `CLIENT_URL` | Allowed CORS origin (e.g. `https://app.example.com`) |

---

## Security notes

- The production container runs as **non-root** user `sentry` (principle of least privilege).
- No secrets are embedded in the image; always use `--env-file` or a secrets manager.
- HTTPS enforcement is the responsibility of the upstream reverse proxy; see README for recommended nginx/Caddy configuration.
- The image is based on `node:20-alpine` (minimal attack surface, no shell by default in production).
