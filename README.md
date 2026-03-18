# 🛰️ SENTRY — Real-Time Satellite Tracker

A production-grade, full-stack real-time satellite tracking web application with a stunning 3D globe interface. Built with React 18, Three.js, and Node.js/Express.

![SENTRY Screenshot](docs/screenshot.png)

## Features

### 3D Globe Visualization
- **Interactive Earth** — High-resolution NASA Blue Marble (day) and Black Marble (night/city lights) textures
- **Atmosphere Glow** — Custom GLSL shader for realistic atmospheric scattering effect
- **Cloud Layer** — Animated semi-transparent cloud overlay
- **Star Field** — Procedurally generated background starfield
- **Moon Rendering** — 3D moon with accurate phase visualization

### Satellite Tracking
- **Real-Time Positions** — ~100 notable satellites with SGP4 orbital propagation via `satellite.js`
- **Satellite Categories** — Weather, Communications (Starlink), Navigation (GPS), ISS, Science, and Debris
- **Orbit Visualization** — Orbital plane rings, ground tracks (past/future), and coverage footprints
- **Satellite Pinning** — Pin up to 3 satellites for simultaneous tracking with color-coded trails
- **Search & Filter** — Filter by constellation type, search by name
- **Satellite Imagery** — Integration for weather satellite imagery

### ISS Tracking
- **Live Position** — Real-time ISS location, altitude, and velocity
- **Crew Information** — Current crew members with agency, role, and days in space
- **Pass Predictions** — Upcoming visible passes for user's location

### Moon Phase Data
- **Current Phase** — Phase name, illumination percentage, and moon age
- **Lunar Events** — Next full moon and new moon dates
- **Rise/Set Times** — Moonrise and moonset times for user's location

### Space Weather
- **Solar Activity** — X-ray flux levels and solar flare classification
- **Geomagnetic Activity** — Kp index with historical chart (Recharts)
- **Aurora Visibility** — Aurora forecast based on geomagnetic conditions
- **Alerts** — Active space weather watches, warnings, and alerts

### Time Controls
- **Time Simulation** — Pause, real-time (1x), and accelerated modes (10x, 60x, 600x)
- **Time Reset** — Return to current real time

### User Experience
- **Geolocation** — Automatic user location detection for pass predictions
- **User Location Marker** — Visual marker on globe for user's position
- **Responsive Panels** — Collapsible sidebar and floating data panels
- **Dark Space Theme** — Custom TailwindCSS theme with glow effects and Orbitron/JetBrains Mono fonts

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| React | ^18.2.0 | UI framework |
| TypeScript | ^5.3.3 | Type safety |
| Vite | ^5.0.11 | Build tool & dev server |
| Three.js | ^0.160.0 | 3D rendering |
| @react-three/fiber | ^8.15.0 | React renderer for Three.js |
| @react-three/drei | ^9.99.0 | Three.js helpers |
| TailwindCSS | ^3.4.1 | Utility-first CSS |
| Framer Motion | ^10.18.0 | Animations |
| Zustand | ^4.4.7 | State management |
| @tanstack/react-query | ^5.17.0 | Data fetching & caching |
| Recharts | ^2.10.0 | Charts (Kp index history) |
| satellite.js | ^5.0.0 | Client-side SGP4 propagation |
| suncalc | ^1.9.0 | Sun/moon position calculations |
| GSAP | ^3.12.4 | Advanced animations |

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | >=20.0.0 | Runtime |
| Express | ^4.18.2 | Web framework |
| TypeScript | ^5.3.3 | Type safety |
| tsx | ^4.7.0 | TypeScript execution (dev) |
| satellite.js | ^5.0.0 | SGP4 orbital propagation |
| astronomia | ^4.1.1 | Astronomical calculations |
| node-cron | ^3.0.3 | Background job scheduling |
| axios | ^1.6.5 | HTTP client |
| helmet | ^7.1.0 | Security headers |
| cors | ^2.8.5 | CORS middleware |
| dotenv | ^16.3.1 | Environment variables |

### External Data Sources
- **CelesTrak** — TLE orbital data (refreshed every 2 hours)
- **Open Notify** — ISS position and crew information
- **NOAA SWPC** — Space weather data (solar activity, Kp index, aurora)

## Prerequisites

- **Node.js** 20.0.0 or higher
- **npm** 9.0.0 or higher

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd sentry-satellite-tracker

# Install all dependencies (root, client, and server)
npm run install:all

# Download Earth textures (required for 3D globe)
npm run setup:textures

# Create environment files
cp client/.env.example client/.env
cp server/.env.example server/.env

# Start development servers
npm run dev
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both client (port 5173) and server (port 3001) in development mode |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run dev:server` | Start only the Express server with hot reload (tsx watch) |
| `npm run build` | Build both client and server for production |
| `npm start` | Start the production server |
| `npm run setup:textures` | Download NASA Earth textures |
| `npm run install:all` | Install dependencies for root, client, and server |
| `npm run lint` | Run ESLint on client code |
| `npm run typecheck` | Run TypeScript type checking on client and server |

## Earth Textures

The texture download script (`scripts/download-textures.js`) automatically fetches NASA textures with progress indication. Textures are saved to `client/public/textures/`.

| Texture | Source | Description |
|---------|--------|-------------|
| `earth_day.jpg` | [NASA Blue Marble](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg) | Daytime Earth surface (5400x2700) |
| `earth_night.jpg` | [NASA Black Marble](https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg) | Nighttime city lights |
| `earth_clouds.png` | [NASA Cloud Layer](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg) | Cloud overlay (2048px) |

If automatic download fails, manually download and place in `client/public/textures/`.

## Development

```bash
# Start both client and server in development mode
npm run dev

# Client runs on http://localhost:5173 (with API proxy to :3001)
# Server runs on http://localhost:3001
```

The Vite dev server proxies `/api` requests to the Express backend (configured in `client/vite.config.ts`).

## Production Build

```bash
# Build both client and server
npm run build

# Start production server (serves client from server/public)
npm start
```

In production, the Express server serves the built React app as static files from `server/public/`.

## Docker

### Production Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access at http://localhost:3001
```

### Docker Configuration

**Multi-stage Dockerfile:**
1. **Builder stage** (`node:20-alpine`) — Installs dependencies, builds client and server
2. **Production stage** (`node:20-alpine`) — Copies built artifacts, runs with production dependencies only

**Docker Compose Services:**

| Service | Description | Ports |
|---------|-------------|-------|
| `app` | Production deployment | 3001 |
| `dev` | Development with hot reload (profile: `dev`) | 5173, 3001 |

```bash
# Run development service with volume mounts
docker-compose --profile dev up
```

**Health Check:** `GET /api/health` (30s interval, 10s timeout, 3 retries)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with status, timestamp, and uptime |
| `/api/satellites` | GET | All tracked satellites with current positions |
| `/api/satellites/:noradId` | GET | Single satellite details + orbit data |
| `/api/iss` | GET | ISS position, crew, and passes (optional: `?lat=&lng=`) |
| `/api/passes` | GET | Pass predictions for location (`?lat=&lng=` required) |
| `/api/moon` | GET | Moon phase and times (optional: `?lat=&lng=`) |
| `/api/weather/space` | GET | Space weather data (solar activity, Kp index, aurora) |
| `/api/imagery/:noradId` | GET | Satellite imagery (optional: `?name=`) |
| `/api/imagery/:noradId/check` | GET | Check if satellite has imagery support |

### Response Examples

**Health Check:**
```json
{
  "status": "ok",
  "timestamp": "2024-03-17T12:00:00.000Z",
  "uptime": 3600.5
}
```

**Satellite:**
```json
{
  "noradId": 25544,
  "name": "ISS (ZARYA)",
  "category": "iss",
  "lat": 45.123,
  "lng": -122.456,
  "alt": 420.5,
  "velocity": 7.66,
  "period": 92.8,
  "inclination": 51.64,
  "owner": "NASA/Roscosmos",
  "tle1": "1 25544U ...",
  "tle2": "2 25544 ..."
}
```

## Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment (`development` or `production`) |
| `CELESTRAK_BASE_URL` | `https://celestrak.org` | TLE data source |
| `OPEN_NOTIFY_URL` | `http://api.open-notify.org` | ISS data source |
| `SWPC_BASE_URL` | `https://services.swpc.noaa.gov` | Space weather data source |

### Client (`client/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3001` | Backend API URL |

## Project Structure

```
sentry-satellite-tracker/
├── client/                          # React frontend
│   ├── public/
│   │   └── textures/                # NASA Earth textures
│   │       ├── earth_day.jpg        # Blue Marble (day)
│   │       ├── earth_night.jpg      # Black Marble (city lights)
│   │       └── earth_clouds.png     # Cloud overlay
│   ├── src/
│   │   ├── components/
│   │   │   ├── Globe/               # 3D globe components
│   │   │   │   ├── Globe.tsx        # Main canvas container
│   │   │   │   ├── Earth.tsx        # Earth sphere with textures
│   │   │   │   ├── Atmosphere.tsx   # Atmospheric glow effect
│   │   │   │   ├── Stars.tsx        # Background starfield
│   │   │   │   ├── Moon.tsx         # 3D moon rendering
│   │   │   │   ├── SatelliteMarkers.tsx      # Satellite point markers
│   │   │   │   ├── OrbitTrail.tsx            # Orbital path lines
│   │   │   │   ├── OrbitalPlaneRing.tsx      # Orbital plane visualization
│   │   │   │   ├── GroundTrack.tsx           # Ground track projection
│   │   │   │   ├── CoverageFootprint.tsx     # Satellite coverage area
│   │   │   │   ├── PinnedSatelliteTracks.tsx # Multi-satellite tracking
│   │   │   │   ├── UserLocationMarker.tsx    # User position marker
│   │   │   │   └── shaders/
│   │   │   │       └── earthShader.ts        # Custom GLSL shaders
│   │   │   ├── panels/              # Data display panels
│   │   │   │   ├── SatellitePanel.tsx        # Satellite details
│   │   │   │   ├── ISSPanel.tsx              # ISS tracking
│   │   │   │   ├── MoonPanel.tsx             # Moon phase info
│   │   │   │   ├── WeatherPanel.tsx          # Space weather
│   │   │   │   └── PassPredictionPanel.tsx   # Pass predictions
│   │   │   └── ui/                  # UI components
│   │   │       ├── Navbar.tsx       # Top navigation bar
│   │   │       ├── Sidebar.tsx      # Satellite list sidebar
│   │   │       ├── TimeControls.tsx # Time simulation controls
│   │   │       ├── PinnedSatellitesStrip.tsx # Pinned satellites bar
│   │   │       └── LoadingScreen.tsx         # Loading indicator
│   │   ├── hooks/                   # React Query hooks
│   │   │   ├── useSatellites.ts     # Satellite data fetching
│   │   │   ├── useISS.ts            # ISS data fetching
│   │   │   ├── useMoonPhase.ts      # Moon phase data
│   │   │   ├── useSpaceWeather.ts   # Space weather data
│   │   │   ├── usePasses.ts         # Pass predictions
│   │   │   └── useImagery.ts        # Satellite imagery
│   │   ├── store/
│   │   │   └── appStore.ts          # Zustand global state
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interfaces
│   │   ├── lib/
│   │   │   └── propagate.ts         # Client-side SGP4 propagation
│   │   ├── utils/
│   │   │   └── orbital.ts           # Orbital calculation utilities
│   │   ├── App.tsx                  # Main app component
│   │   ├── main.tsx                 # React entry point
│   │   └── index.css                # Global styles + Tailwind
│   ├── index.html                   # HTML template
│   ├── vite.config.ts               # Vite configuration
│   ├── tailwind.config.js           # Tailwind theme config
│   ├── tsconfig.json                # TypeScript config
│   └── package.json                 # Frontend dependencies
├── server/                          # Express backend
│   ├── src/
│   │   ├── routes/                  # API route handlers
│   │   │   ├── satellites.ts        # /api/satellites
│   │   │   ├── iss.ts               # /api/iss
│   │   │   ├── passes.ts            # /api/passes
│   │   │   ├── moon.ts              # /api/moon
│   │   │   ├── weather.ts           # /api/weather
│   │   │   └── imagery.ts           # /api/imagery
│   │   ├── services/                # Business logic
│   │   │   ├── tleService.ts        # TLE fetching & caching (~100 satellites)
│   │   │   ├── propagationService.ts # SGP4 orbital propagation
│   │   │   ├── passService.ts       # Pass prediction calculations
│   │   │   ├── moonService.ts       # Moon phase calculations
│   │   │   └── imageryService.ts    # Satellite imagery integration
│   │   ├── jobs/
│   │   │   └── tleRefresh.ts        # Cron job (every 2 hours)
│   │   └── index.ts                 # Express app entry point
│   ├── tsconfig.json                # TypeScript config
│   └── package.json                 # Backend dependencies
├── scripts/
│   └── download-textures.js         # NASA texture downloader
├── Dockerfile                       # Multi-stage Docker build
├── docker-compose.yml               # Docker Compose config
├── .dockerignore                    # Docker ignore patterns
├── .gitignore                       # Git ignore patterns
└── package.json                     # Root package (workspace scripts)
```

## State Management

The app uses **Zustand** for global state (`client/src/store/appStore.ts`):

| State | Type | Description |
|-------|------|-------------|
| `selectedSatellite` | `Satellite \| null` | Currently selected satellite |
| `activePanel` | `PanelType` | Active panel (`satellite`, `iss`, `moon`, `weather`, `passes`, `null`) |
| `userLocation` | `UserLocation \| null` | User's geolocation |
| `satellites` | `Satellite[]` | All tracked satellites |
| `pinnedSatellites` | `PinnedSatellite[]` | Up to 3 pinned satellites with colors |
| `simulatedTime` | `Date` | Current simulated time |
| `timeMultiplier` | `TimeSpeed` | Time speed (0, 1, 10, 60, 600) |
| `constellationFilter` | `ConstellationFilter` | Filter (`all`, `stations`, `starlink`, `gps`, `weather`, `amateur`, `debris`) |
| `groundTrack` | `GroundTrack \| null` | Selected satellite's ground track |
| `sidebarCollapsed` | `boolean` | Sidebar visibility |
| `isISSMode` | `boolean` | ISS tracking mode |

## TypeScript Types

Key interfaces defined in `client/src/types/index.ts`:

- **`Satellite`** — Satellite data (NORAD ID, name, category, position, TLE)
- **`SatelliteCategory`** — `'weather' | 'comm' | 'nav' | 'iss' | 'science' | 'debris'`
- **`ISSData`** — ISS position, crew members, and passes
- **`CrewMember`** — Crew name, agency, role, days in space
- **`Pass`** — Pass prediction (rise/set times, elevation, azimuth, quality)
- **`MoonData`** — Moon phase, illumination, rise/set times
- **`SpaceWeather`** — Solar activity, geomagnetic activity, aurora, alerts
- **`GroundTrack`** — Past and future ground track points
- **`PinnedSatellite`** — Pinned satellite with color and ground track

## Background Jobs

The server runs background jobs via `node-cron`:

| Job | Schedule | Description |
|-----|----------|-------------|
| TLE Refresh | Every 2 hours (`0 */2 * * *`) | Fetches fresh TLE data from CelesTrak |
| Cache Age Log | Every 30 minutes (`*/30 * * * *`) | Logs TLE cache age for monitoring |

Initial TLE fetch occurs on server startup. Fallback TLE data is embedded for offline operation.

## Data Sources

| Source | URL | Data |
|--------|-----|------|
| CelesTrak | https://celestrak.org | TLE orbital elements |
| Open Notify | http://api.open-notify.org | ISS position, crew |
| NOAA SWPC | https://services.swpc.noaa.gov | Space weather, Kp index |

## Custom Tailwind Theme

The app uses a custom space-themed Tailwind configuration (`client/tailwind.config.js`):

**Colors:**
- `bg-primary`: `#020817` (deep space blue)
- `bg-secondary`: `#0a1628` (panel background)
- `bg-panel`: `rgba(10, 22, 40, 0.85)` (translucent panels)
- `accent-blue`: `#38bdf8`, `accent-cyan`: `#22d3ee`, `accent-green`: `#4ade80`
- `accent-orange`: `#fb923c`, `accent-red`: `#f87171`, `accent-purple`: `#a855f7`

**Fonts:**
- `font-orbitron`: Orbitron (headings)
- `font-mono`: JetBrains Mono (data)

**Effects:**
- `shadow-glow-*`: Glow shadows for UI elements
- `animate-glow-pulse`: Pulsing glow animation

## License

MIT
