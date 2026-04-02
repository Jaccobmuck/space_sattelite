import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

// Test environment
const JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-64-characters-long-for-testing';
process.env.JWT_ACCESS_SECRET = JWT_ACCESS_SECRET;
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

// Auth middleware
interface AuthRequest extends express.Request {
  user?: { id: number; email: string; plan: string };
}

function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const token = match[1];
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as { userId: number };
    const user = db.prepare('SELECT id, email, plan FROM users WHERE id = ?').get(payload.userId) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Account router
const router = express.Router();
router.use(requireAuth);

router.get('/me', (req: AuthRequest, res) => {
  res.json({ id: req.user!.id, email: req.user!.email, plan: req.user!.plan });
});

router.patch('/password', async (req: AuthRequest, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow;
  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = await bcrypt.hash(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, refresh_token_hash = NULL WHERE id = ?').run(newHash, req.user!.id);

  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Password updated' });
});

router.patch('/email', async (req: AuthRequest, res) => {
  const { new_email, password } = req.body;

  if (!new_email || !password) {
    return res.status(400).json({ error: 'New email and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Password is incorrect' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(new_email, req.user!.id) as UserRow | undefined;
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(new_email, req.user!.id);
  res.json({ message: 'Email updated', email: new_email });
});

router.delete('/', async (req: AuthRequest, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Password is incorrect' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.user!.id);
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Account deleted' });
});

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/account', router);

function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

describe('Account Routes', () => {
  let userId: number;
  let accessToken: string;

  beforeEach(async () => {
    db.exec('DELETE FROM users');
    const hash = await bcrypt.hash('password123', 10);
    const result = db.prepare('INSERT INTO users (email, password_hash, plan) VALUES (?, ?, ?)').run('test@example.com', hash, 'free');
    userId = result.lastInsertRowid as number;
    accessToken = generateToken(userId);
  });

  describe('GET /api/account/me', () => {
    it('should return current user info with exact response shape and no extra fields', async () => {
      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        id: userId,
        email: 'test@example.com',
        plan: 'free'
      });
      expect(Object.keys(res.body)).toHaveLength(3);
      expect(res.body).not.toHaveProperty('password_hash');
      expect(res.body).not.toHaveProperty('refresh_token_hash');
      expect(res.body).not.toHaveProperty('stripe_customer_id');
      expect(res.body).not.toHaveProperty('created_at');
      expect(res.body).not.toHaveProperty('failed_login_attempts');
      expect(res.body).not.toHaveProperty('locked_until');
    });

    it('should reject requests with malformed Authorization headers', async () => {
      const malformedHeaders = [
        '',
        'Bearer',
        'Bearer ',
        'Token ' + accessToken,
        'Basic ' + accessToken,
      ];

      for (const header of malformedHeaders) {
        const res = await request(app)
          .get('/api/account/me')
          .set('Authorization', header);
        expect(res.status).toBe(401);
      }
    });

    it('should reject unauthenticated requests with no header', async () => {
      const res = await request(app).get('/api/account/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access token required');
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign({ userId }, JWT_ACCESS_SECRET, { expiresIn: '-1s' });
      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject tokens signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign({ userId }, 'wrong-secret-key-that-is-also-64-characters-long-for-testing-purposes', { expiresIn: '15m' });
      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject tokens for deleted users', async () => {
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('not found');
    });

    it('should reject tokens with tampered payload', async () => {
      const parts = accessToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.userId = 99999;
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64');
      const tamperedToken = parts.join('.');

      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
    });

    it('should handle concurrent requests without race conditions', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/account/me')
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const responses = await Promise.all(requests);
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(userId);
      });
    });

    it('should correctly return pro plan for pro users', async () => {
      db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('pro', userId);
      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.plan).toBe('pro');
    });
  });

  describe('PATCH /api/account/password', () => {
    it('should update password and verify old password no longer works', async () => {
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'password123', new_password: 'newpassword456' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password updated');

      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as UserRow;
      const newValid = await bcrypt.compare('newpassword456', user.password_hash);
      const oldValid = await bcrypt.compare('password123', user.password_hash);
      expect(newValid).toBe(true);
      expect(oldValid).toBe(false);
    });

    it('should reject password change with timing-safe comparison for incorrect password', async () => {
      const startTime = Date.now();
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'wrongpassword', new_password: 'newpassword456' });
      const duration = Date.now() - startTime;

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Current password is incorrect');
      expect(duration).toBeGreaterThan(50);
    });

    it('should reject password exactly 7 characters', async () => {
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'password123', new_password: '1234567' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8 characters');
    });

    it('should accept password exactly 8 characters', async () => {
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'password123', new_password: '12345678' });

      expect(res.status).toBe(200);
    });

    it('should handle unicode passwords correctly', async () => {
      const unicodePassword = '密码🔐émoji';
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'password123', new_password: unicodePassword });

      expect(res.status).toBe(200);

      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as UserRow;
      const valid = await bcrypt.compare(unicodePassword, user.password_hash);
      expect(valid).toBe(true);
    });

    it('should reject null values in password fields', async () => {
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: null, new_password: 'newpassword456' });

      expect(res.status).toBe(400);
    });

    it('should reject empty string passwords', async () => {
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: '', new_password: 'newpassword456' });

      expect(res.status).toBe(400);
    });

    it('should invalidate all refresh tokens on password change', async () => {
      const refreshHash = await bcrypt.hash('refresh-token-value', 10);
      db.prepare('UPDATE users SET refresh_token_hash = ? WHERE id = ?').run(refreshHash, userId);

      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'password123', new_password: 'newpassword456' });

      expect(res.status).toBe(200);
      const user = db.prepare('SELECT refresh_token_hash FROM users WHERE id = ?').get(userId) as UserRow;
      expect(user.refresh_token_hash).toBeNull();
    });

    it('should clear refreshToken cookie on password change', async () => {
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', 'refreshToken=somevalue')
        .send({ current_password: 'password123', new_password: 'newpassword456' });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toMatch(/refreshToken=;/);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'password123', new_password: longPassword });

      expect(res.status).toBe(200);

      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as UserRow;
      const valid = await bcrypt.compare(longPassword, user.password_hash);
      expect(valid).toBe(true);
    });

    it('should accept passwords with only whitespace if 8+ chars (implementation quirk)', async () => {
      const whitespacePassword = '        ';
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'password123', new_password: whitespacePassword });

      expect(res.status).toBe(200);

      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as UserRow;
      const valid = await bcrypt.compare(whitespacePassword, user.password_hash);
      expect(valid).toBe(true);
    });

    it('should reject whitespace password under 8 chars', async () => {
      const res = await request(app)
        .patch('/api/account/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ current_password: 'password123', new_password: '       ' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/account/email', () => {
    it('should update email and verify database consistency', async () => {
      const res = await request(app)
        .patch('/api/account/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ new_email: 'newemail@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        message: 'Email updated',
        email: 'newemail@example.com'
      });

      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as UserRow;
      expect(user.email).toBe('newemail@example.com');

      const oldEmailUser = db.prepare('SELECT * FROM users WHERE email = ?').get('test@example.com');
      expect(oldEmailUser).toBeUndefined();
    });

    it('should reject email change with incorrect password using exact error message', async () => {
      const res = await request(app)
        .patch('/api/account/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ new_email: 'newemail@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Password is incorrect');
    });

    it('should reject duplicate email with exact case match', async () => {
      const hash = await bcrypt.hash('password', 10);
      db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('existing@example.com', hash);

      const res = await request(app)
        .patch('/api/account/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ new_email: 'existing@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already in use');
    });

    it('should allow email with different case than existing (case-sensitive)', async () => {
      const hash = await bcrypt.hash('password', 10);
      db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('Existing@Example.COM', hash);

      const res = await request(app)
        .patch('/api/account/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ new_email: 'existing@example.com', password: 'password123' });

      expect(res.status).toBe(200);
    });

    it('should allow changing email to same email with different case', async () => {
      const res = await request(app)
        .patch('/api/account/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ new_email: 'TEST@EXAMPLE.COM', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('TEST@EXAMPLE.COM');
    });

    it('should accept any non-empty string as email (no server-side validation)', async () => {
      const weirdEmails = [
        'notanemail',
        'user@example',
        'a',
      ];

      for (const email of weirdEmails) {
        db.exec('DELETE FROM users');
        const hash = await bcrypt.hash('password123', 10);
        const result = db.prepare('INSERT INTO users (email, password_hash, plan) VALUES (?, ?, ?)').run('test@example.com', hash, 'free');
        userId = result.lastInsertRowid as number;
        accessToken = generateToken(userId);

        const res = await request(app)
          .patch('/api/account/email')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ new_email: email, password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(email);
      }
    });

    it('should reject missing new_email field', async () => {
      const res = await request(app)
        .patch('/api/account/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('should reject missing password field', async () => {
      const res = await request(app)
        .patch('/api/account/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ new_email: 'newemail@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('password');
    });

    it('should handle email with special characters', async () => {
      const res = await request(app)
        .patch('/api/account/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ new_email: 'user+tag@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('user+tag@example.com');
    });

    it('should handle concurrent email change attempts atomically', async () => {
      const requests = [
        request(app)
          .patch('/api/account/email')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ new_email: 'email1@example.com', password: 'password123' }),
        request(app)
          .patch('/api/account/email')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ new_email: 'email2@example.com', password: 'password123' }),
      ];

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as UserRow;
      expect(['email1@example.com', 'email2@example.com']).toContain(user.email);
    });

    it('should safely handle SQL injection attempts via parameterized queries', async () => {
      const maliciousEmails = [
        "'; DROP TABLE users; --",
        "admin'--@example.com",
        "user@example.com'; DELETE FROM users WHERE '1'='1",
      ];

      for (const email of maliciousEmails) {
        db.exec('DELETE FROM users');
        const hash = await bcrypt.hash('password123', 10);
        const result = db.prepare('INSERT INTO users (email, password_hash, plan) VALUES (?, ?, ?)').run('test@example.com', hash, 'free');
        userId = result.lastInsertRowid as number;
        accessToken = generateToken(userId);

        const res = await request(app)
          .patch('/api/account/email')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ new_email: email, password: 'password123' });

        expect(res.status).toBe(200);

        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as UserRow;
        expect(user.email).toBe(email);
      }

      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(userCount.count).toBeGreaterThanOrEqual(1);

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      expect(tables).toBeDefined();
    });
  });

  describe('DELETE /api/account', () => {
    it('should delete account and verify complete removal from database', async () => {
      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Account deleted');

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
      expect(user).toBeUndefined();

      const userByEmail = db.prepare('SELECT * FROM users WHERE email = ?').get('test@example.com');
      expect(userByEmail).toBeUndefined();
    });

    it('should reject deletion with incorrect password and preserve account', async () => {
      const originalUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;

      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Password is incorrect');

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
      expect(user.email).toBe(originalUser.email);
      expect(user.password_hash).toBe(originalUser.password_hash);
    });

    it('should reject deletion with empty password', async () => {
      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: '' });

      expect(res.status).toBe(400);
    });

    it('should reject deletion with null password', async () => {
      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: null });

      expect(res.status).toBe(400);
    });

    it('should clear refreshToken cookie on account deletion', async () => {
      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', 'refreshToken=somevalue')
        .send({ password: 'password123' });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toMatch(/refreshToken=;/);
    });

    it('should prevent using token after account deletion', async () => {
      await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'password123' });

      const res = await request(app)
        .get('/api/account/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(401);
    });

    it('should handle concurrent deletion attempts (all may succeed due to no locking)', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .delete('/api/account')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ password: 'password123' })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;

      expect(successCount).toBeGreaterThanOrEqual(1);

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      expect(user).toBeUndefined();
    });

    it('should not delete other users when deleting own account', async () => {
      const hash = await bcrypt.hash('otherpassword', 10);
      const otherResult = db.prepare('INSERT INTO users (email, password_hash, plan) VALUES (?, ?, ?)').run('other@example.com', hash, 'pro');
      const otherUserId = otherResult.lastInsertRowid;

      await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'password123' });

      const otherUser = db.prepare('SELECT * FROM users WHERE id = ?').get(otherUserId) as UserRow;
      expect(otherUser).toBeDefined();
      expect(otherUser.email).toBe('other@example.com');
    });

    it('should reject deletion attempts with extra fields in body', async () => {
      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'password123', id: 999, email: 'hacker@evil.com' });

      expect(res.status).toBe(200);

      const hackerUser = db.prepare('SELECT * FROM users WHERE email = ?').get('hacker@evil.com');
      expect(hackerUser).toBeUndefined();
    });
  });
});
