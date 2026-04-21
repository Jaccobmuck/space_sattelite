# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SENTRY** is a full-stack real-time satellite tracking web application with a 3D globe interface. It uses SGP4 orbital propagation to track ~100 satellites, provides pass predictions, integrates space weather data, and includes community sighting features with a freemium Stripe billing model.

## Commands

### Root (run from `/home/user/space_sattelite`)
```bash
npm run install:all      # Install deps for all workspaces
npm run dev              # Start client (port 5173) + server (port 3001) concurrently
npm run build            # Build both client and server
npm start                # Run production server
npm run lint             # ESLint client code
npm run typecheck        # TypeScript check client + server
npm run test:client      # Run client tests
npm run test:server      # Run server tests
```

### Client (`/client`)
```bash
npm test                 # Vitest (watch mode)
npm run test:coverage    # Coverage report
npm run typecheck        # tsc --noEmit
```

### Server (`/server`)
```bash
npm test                 # Vitest (watch mode)
npm run migrate          # Run pending Supabase migrations
npm run migrate:make <name>  # Create new migration
npm run migrate:status   # Check migration status
```

### Docker
```bash
docker-compose up --build           # Production
docker-compose --profile dev up     # Development with hot reload
```

## Architecture

### Monorepo Structure
```
space_sattelite/
├── client/     # React 18 + Three.js frontend
├── server/     # Express + Node.js backend
└── scripts/    # Setup utilities
```

The Vite dev server proxies `/api` requests to Express on port 3001. In production, Express serves the React build as static assets.

### Frontend (`client/src/`)

**State:** Zustand (`store/appStore.ts`) holds all global UI state — selected satellite, simulation time, pinned satellites, overlay visibility. `AuthStore` handles user/plan state. TanStack Query manages server data with 30s stale time; TLE data refreshes every 2 minutes.

**Globe:** React Three Fiber canvas in `components/Globe/`. Satellite markers update every frame using client-side SGP4 propagation (`lib/propagate.ts`). Up to 3 satellites can be pinned with color-coded ground tracks.

**Panels:** `components/panels/` — SatellitePanel, ISSPanel, MoonPanel, WeatherPanel, PassPredictionPanel. Each fetches its own data via React Query hooks in `hooks/`.

**API client:** `lib/api.ts` — Axios instance with httpOnly cookie auth and automatic token refresh on 401.

### Backend (`server/src/`)

**Routes** (`routes/`): `/api/satellites`, `/api/iss`, `/api/passes`, `/api/moon`, `/api/weather`, `/api/imagery`, `/api/auth/*`, `/api/billing/*`, `/api/account/*`, `/api/journal/*`, `/api/community/*`, `/api/profile/*`

**Services** (`services/`):
- `tleService` — Fetches from CelesTrak, 2-hour cache, JSON fallback for offline
- `propagationService` — SGP4 via satellite.js
- `passService` — Visible pass predictions using solar geometry
- `moonService` — Phase calculations via astronomia library
- `accountDeletionService` — Graceful account removal with data cleanup

**Auth middleware** (`middleware/auth.ts`): `requireAuth` validates JWT cookie and fetches profile from Supabase. `requirePro` enforces plan tier for TLE data and higher satellite limits.

**Background jobs** (`jobs/`): `tleRefresh` runs every 2 hours via node-cron; `accountDeletion` handles scheduled cleanups.

**Database:** Supabase PostgreSQL — tables: `profiles`, `journal_entries`, `community_likes`, `community_comments`. Row-level security enforces multi-tenant isolation. Profile rows are linked to Supabase Auth users.

### External Integrations

| Service | Purpose |
|---------|---------|
| CelesTrak | Satellite TLE elements |
| Open Notify | ISS position + crew |
| NOAA SWPC | Space weather / aurora forecasts |
| NASA API | Earth observation imagery (optional) |
| Supabase | Auth + PostgreSQL |
| Stripe | Subscription billing (webhooks update plan tier) |

### Key Files

- `client/src/store/appStore.ts` — Central Zustand store (~800 lines)
- `client/src/lib/propagate.ts` — Client-side SGP4 propagation
- `server/src/index.ts` — Express app setup and route registration
- `server/src/middleware/auth.ts` — JWT validation and plan enforcement
- `server/src/services/tleService.ts` — TLE caching with CelesTrak + fallback
- `server/src/lib/supabase.ts` — Supabase admin client
- `MIGRATIONS.md` — Database migration documentation

## Testing

- **Framework:** Vitest in both client and server
- **Client environment:** jsdom with Testing Library + MSW for API mocking
- **Server environment:** Node with Supabase client mocked
- **Test files:** Co-located as `*.test.ts` or in `tests/` directories
- **Coverage:** v8 provider (`npm run test:coverage`)

## Environment Variables

Copy `.env.example` in both `client/` and `server/` to set up local development. The server validates all required env vars on startup and will refuse to start if any are missing. Supabase public keys in the client are intentionally client-facing (not secrets).
