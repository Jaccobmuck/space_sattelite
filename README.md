# 🛰️ SENTRY — Real-Time Satellite Tracker

A production-grade, full-stack real-time satellite tracking web application with a stunning 3D globe interface. Built with React, Three.js, and Node.js.

![SENTRY Screenshot](docs/screenshot.png)

## Features

- **3D Globe Visualization** — Interactive Earth with NASA textures, atmosphere glow, and star field
- **Real-Time Satellite Tracking** — ~100 notable satellites with accurate SGP4 orbital propagation
- **ISS Tracking** — Live position, crew information, and pass predictions
- **Moon Phase Data** — Current phase, illumination, and upcoming lunar events
- **Space Weather** — Solar activity, Kp index, and aurora visibility
- **Pass Predictions** — Upcoming visible satellite passes for your location

## Tech Stack

### Frontend
- React 18 + TypeScript + Vite
- Three.js via @react-three/fiber + @react-three/drei
- TailwindCSS with custom space theme
- Framer Motion for animations
- Zustand for state management
- TanStack Query for data fetching

### Backend
- Node.js + Express + TypeScript
- satellite.js for SGP4 orbital propagation
- node-cron for background TLE refresh
- Real data from CelesTrak, Open Notify, and NOAA SWPC

## Prerequisites

- Node.js 20+
- npm 9+

## Setup

```bash
# Clone the repository
git clone <repository-url>
cd sentry-satellite-tracker

# Install dependencies
npm install

# Download Earth textures (required for 3D globe)
npm run setup:textures

# Create environment files
cp client/.env.example client/.env
cp server/.env.example server/.env
```

## Earth Textures

The texture download script will automatically fetch NASA textures. If it fails, manually download:

- **earth_day.jpg**: [NASA Blue Marble](https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg)
- **earth_night.jpg**: [NASA Black Marble](https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg)
- **earth_clouds.png**: [NASA Cloud Layer](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg)

Place downloaded textures in `client/public/textures/`.

## Development

```bash
# Start both client and server in development mode
npm run dev

# Client runs on http://localhost:5173
# Server runs on http://localhost:3001
```

## Production Build

```bash
# Build both client and server
npm run build

# Start production server
npm start
```

## Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access at http://localhost:3001
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/satellites` | All tracked satellites with current positions |
| `GET /api/satellites/:noradId` | Single satellite details + orbit data |
| `GET /api/iss?lat=&lng=` | ISS position, crew, and passes |
| `GET /api/passes?lat=&lng=` | Pass predictions for location |
| `GET /api/moon?lat=&lng=` | Moon phase and times |
| `GET /api/weather/space` | Space weather data |

## Environment Variables

### Server (`server/.env`)
```env
PORT=3001
NODE_ENV=development
CELESTRAK_BASE_URL=https://celestrak.org
OPEN_NOTIFY_URL=http://api.open-notify.org
SWPC_BASE_URL=https://services.swpc.noaa.gov
```

### Client (`client/.env`)
```env
VITE_API_BASE_URL=http://localhost:3001
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Globe/      # 3D globe components
│   │   │   ├── panels/     # Data panels
│   │   │   └── ui/         # UI components
│   │   ├── hooks/          # React Query hooks
│   │   ├── store/          # Zustand store
│   │   └── types/          # TypeScript types
│   └── public/textures/    # Earth textures
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API routes
│       ├── services/       # Business logic
│       └── jobs/           # Background jobs
├── scripts/                # Setup scripts
├── Dockerfile
└── docker-compose.yml
```

## Data Sources

- **TLE Data**: [CelesTrak](https://celestrak.org) (refreshed every 2 hours)
- **ISS Position**: [Open Notify](http://api.open-notify.org)
- **Space Weather**: [NOAA SWPC](https://services.swpc.noaa.gov)

## License

MIT
