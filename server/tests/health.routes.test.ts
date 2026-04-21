/**
 * Tests for the Express health-check route and centralised error-handler.
 *
 * These tests spin up a minimal Express app that mirrors the middleware
 * stack in src/index.ts without requiring real Supabase / Stripe credentials.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import helmet from 'helmet';

// ─── build a minimal test app ────────────────────────────────────────────────

function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  // Health check — mirrors src/index.ts
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Route that deliberately throws to test the error handler
  app.get('/api/test-error', (_req: Request, _res: Response, next: NextFunction) => {
    const err = new Error('Something went wrong') as Error & { status?: number };
    err.status = 422;
    next(err);
  });

  // Route that throws without a status code
  app.get('/api/test-500', (_req: Request, _res: Response) => {
    throw new Error('Unhandled internal error');
  });

  // Centralised error handler — mirrors src/index.ts
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  return app;
}

const app = buildApp();

// ─── GET /api/health ─────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('includes a valid ISO timestamp', async () => {
    const res = await request(app).get('/api/health');
    expect(new Date(res.body.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('includes numeric uptime', async () => {
    const res = await request(app).get('/api/health');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('responds with JSON content-type', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ─── Security headers (Helmet) ───────────────────────────────────────────────

describe('Security headers', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('sets Referrer-Policy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['referrer-policy']).toBeDefined();
  });
});

// ─── Centralised error handler ───────────────────────────────────────────────

describe('Error handler middleware', () => {
  it('returns structured JSON error with correct status code', async () => {
    const res = await request(app).get('/api/test-error');
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });

  it('defaults to 500 when no status is set on the error', async () => {
    const res = await request(app).get('/api/test-500');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it('returns a non-empty error message in non-production mode', async () => {
    // NODE_ENV is 'test', so the real error message should be visible
    const res = await request(app).get('/api/test-error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});

// ─── 404 for unknown routes ───────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('returns 404 for an unregistered path', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
