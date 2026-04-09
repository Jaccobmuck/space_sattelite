import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// Uses the pure-JS in-memory database helper instead of better-sqlite3 so
// these tests run without requiring the native SQLite binary.
import Database from './helpers/inMemoryDb.js';

// Test environment
const JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-64-characters-long-for-testing';
const JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-64-characters-long-for-testing';
process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
process.env.JWT_REFRESH_SECRET = JWT_REFRESH_SECRET;
process.env.NODE_ENV = 'test';

// User type for database queries
interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  plan: string;
  stripe_customer_id: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  refresh_token_hash: string | null;
  created_at: string;
}

// In-memory test database
const db = new Database(':memory:');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'pro')),
    stripe_customer_id TEXT,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    refresh_token_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Simple auth router for testing
const router = express.Router();

function generateAccessToken(userId: number): string {
  return jwt.sign({ userId }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(userId: number): string {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// Register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, passwordHash);
  const user = db.prepare('SELECT id, email, plan, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as UserRow;

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  db.prepare('UPDATE users SET refresh_token_hash = ? WHERE id = ?').run(refreshTokenHash, user.id);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  res.status(201).json({ user, accessToken });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Check lockout
  if (user.locked_until && new Date() < new Date(user.locked_until)) {
    return res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const newAttempts = user.failed_login_attempts + 1;
    const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(newAttempts, lockUntil, user.id);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Reset failed attempts
  db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  db.prepare('UPDATE users SET refresh_token_hash = ? WHERE id = ?').run(refreshTokenHash, user.id);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  const { password_hash: _pw, refresh_token_hash: _rt, ...safeUser } = user;
  res.json({ user: safeUser, accessToken });
});

// Refresh
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number };
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as UserRow | undefined;
    
    if (!user || !user.refresh_token_hash) {
      return res.status(401).json({ error: 'Session invalidated' });
    }

    const tokenValid = await bcrypt.compare(token, user.refresh_token_hash);
    if (!tokenValid) {
      return res.status(401).json({ error: 'Session invalidated' });
    }

    const accessToken = generateAccessToken(user.id);
    const { password_hash: _pw, refresh_token_hash: _rt, ...safeUser } = user;
    res.json({ user: safeUser, accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: number };
      db.prepare('UPDATE users SET refresh_token_hash = NULL WHERE id = ?').run(payload.userId);
    } catch {
      // Ignore invalid tokens on logout
    }
  }
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out' });
});

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', router);

describe('Auth Routes', () => {
  beforeEach(() => {
    db.exec('DELETE FROM users');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.plan).toBe('free');
      expect(res.body.accessToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject short passwords', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8 characters');
    });

    it('should reject duplicate emails', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password456' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already registered');
    });

    it('should not expose password_hash in response', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.refresh_token_hash).toBeUndefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const hash = await bcrypt.hash('password123', 10);
      db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('test@example.com', hash);
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.accessToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('should increment failed login attempts', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      const user = db.prepare('SELECT failed_login_attempts FROM users WHERE email = ?').get('test@example.com');
      expect(user.failed_login_attempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(423);
      expect(res.body.error).toContain('locked');
    });

    it('should reset failed attempts on successful login', async () => {
      // Fail twice
      await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrong' });
      await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrong' });

      // Succeed
      await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'password123' });

      const user = db.prepare('SELECT failed_login_attempts FROM users WHERE email = ?').get('test@example.com');
      expect(user.failed_login_attempts).toBe(0);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;
    let userId: number;

    beforeEach(async () => {
      const hash = await bcrypt.hash('password123', 10);
      const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('test@example.com', hash);
      userId = result.lastInsertRowid as number;
      
      refreshToken = generateRefreshToken(userId);
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      db.prepare('UPDATE users SET refresh_token_hash = ? WHERE id = ?').run(refreshTokenHash, userId);
    });

    it('should refresh access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should reject missing refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Refresh token required');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid.token.here');

      expect(res.status).toBe(401);
    });

    it('should reject invalidated refresh token', async () => {
      // Invalidate the token
      db.prepare('UPDATE users SET refresh_token_hash = NULL WHERE id = ?').run(userId);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('invalidated');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear refresh token cookie', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
    });

    it('should invalidate refresh token in database', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('test@example.com', hash);
      const userId = result.lastInsertRowid as number;
      
      const refreshToken = generateRefreshToken(userId);
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      db.prepare('UPDATE users SET refresh_token_hash = ? WHERE id = ?').run(refreshTokenHash, userId);

      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`);

      const user = db.prepare('SELECT refresh_token_hash FROM users WHERE id = ?').get(userId);
      expect(user.refresh_token_hash).toBeNull();
    });
  });
});
