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
import { startTLERefreshJob } from './jobs/tleRefresh.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3001;

// Startup checks
if (NODE_ENV === 'production') {
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 64) {
    throw new Error('JWT_ACCESS_SECRET must be at least 64 characters in production');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 64) {
    throw new Error('JWT_REFRESH_SECRET must be at least 64 characters in production');
  }
}

const app = express();

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
const allowedOrigins = NODE_ENV === 'production'
  ? [process.env.CLIENT_URL || '']
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Global API limiter — generous DDoS backstop
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  skip: (req) => req.path === '/api/health',
});
app.use('/api', globalLimiter);

// Auth limiter — strict but reasonable
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Sensitive action limiter — password/email changes
const sensitiveActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account changes. Try again in an hour.' },
});

// Stripe webhook route MUST use raw body — mount before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// Body parsing & cookies
app.use(express.json());
app.use(cookieParser());

// Request timeout
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

// API Routes
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve static files in production
if (NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));
  
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Global error handler (must be last middleware)
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🛰️  SENTRY Server running on port ${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Database: SQLite connected`);
  console.log(`   Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
  
  // Start background jobs
  startTLERefreshJob();
});

export default app;
