import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import satellitesRouter from './routes/satellites.js';
import issRouter from './routes/iss.js';
import passesRouter from './routes/passes.js';
import moonRouter from './routes/moon.js';
import weatherRouter from './routes/weather.js';
import imageryRouter from './routes/imagery.js';
import { startTLERefreshJob } from './jobs/tleRefresh.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/satellites', satellitesRouter);
app.use('/api/iss', issRouter);
app.use('/api/passes', passesRouter);
app.use('/api/moon', moonRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/imagery', imageryRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));
  
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🛰️  SENTRY Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  
  // Start background jobs
  startTLERefreshJob();
});

export default app;
