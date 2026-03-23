import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import satellitesRouter from './routes/satellites.js';
import issRouter from './routes/iss.js';
import passesRouter from './routes/passes.js';
import moonRouter from './routes/moon.js';
import weatherRouter from './routes/weather.js';
import imageryRouter from './routes/imagery.js';
import authRouter from './routes/auth.js';
import billingRouter from './routes/billing.js';
import accountRouter from './routes/account.js';
import journalRouter from './routes/journal.js';
import communityRouter from './routes/community.js';
import profileRouter from './routes/profile.js';
import { startTLERefreshJob } from './jobs/tleRefresh.js';
import { logger } from './lib/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3001;

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'CLIENT_URL',
];

if (NODE_ENV === 'production') {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const app = express();

app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://api.nasa.gov', 'https://services.swpc.noaa.gov', 'https://celestrak.org'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = NODE_ENV === 'production'
  ? [process.env.CLIENT_URL!]
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  skip: (req) => req.path === '/api/health',
});
app.use('/api', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account changes. Try again in an hour.' },
});

app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(cookieParser());

const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10);
app.use((_req: Request, res: Response, next: NextFunction) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  }, REQUEST_TIMEOUT_MS);
  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
  next();
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/account', sensitiveActionLimiter, accountRouter);
app.use('/api/billing', billingRouter);
app.use('/api/satellites', satellitesRouter);
app.use('/api/iss', issRouter);
app.use('/api/passes', passesRouter);
app.use('/api/moon', moonRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/imagery', imageryRouter);
app.use('/api/journal', journalRouter);
app.use('/api/community', communityRouter);
app.use('/api/profile', profileRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

if (NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled request error', {
    status: err.status,
    message: err.message,
    stack: err.stack,
  });
  res.status(err.status || 500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, () => {
  logger.info('SENTRY server started', {
    port: PORT,
    environment: NODE_ENV,
    healthCheck: `http://localhost:${PORT}/api/health`,
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
  });

  startTLERefreshJob();
});

export default app;
