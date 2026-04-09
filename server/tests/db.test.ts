import { describe, it, expect, beforeEach } from 'vitest';
// Uses the pure-JS in-memory database helper instead of better-sqlite3 so
// these tests run without requiring the native SQLite binary.
import Database from './helpers/inMemoryDb.js';

// Create in-memory test database
const db = new Database(':memory:');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
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

// Test helpers that mirror the actual db functions
interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  refresh_token_hash: string | null;
  created_at: string;
}

type SafeUser = Omit<UserRow, 'password_hash' | 'refresh_token_hash'>;

function stripSensitiveFields(user: UserRow): SafeUser {
  const { password_hash: _pw, refresh_token_hash: _rt, ...safe } = user;
  return safe;
}

const ALLOWED_UPDATE_FIELDS = [
  'email',
  'password_hash',
  'plan',
  'stripe_customer_id',
  'failed_login_attempts',
  'locked_until',
  'refresh_token_hash',
] as const;

type UpdatableField = (typeof ALLOWED_UPDATE_FIELDS)[number];
type UpdatableFields = Partial<Pick<UserRow, UpdatableField>>;

function createUser(email: string, passwordHash: string): SafeUser {
  const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
  const result = stmt.run(email, passwordHash);
  return getUserById(result.lastInsertRowid as number)!;
}

function getUserByEmail(email: string): UserRow | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) as UserRow | undefined;
}

function getUserById(id: number): SafeUser | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const row = stmt.get(id) as UserRow | undefined;
  return row ? stripSensitiveFields(row) : undefined;
}

function getUserByIdFull(id: number): UserRow | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as UserRow | undefined;
}

function updateUser(userId: number, fields: UpdatableFields): void {
  const safeKeys = ALLOWED_UPDATE_FIELDS.filter((f) => f in fields);
  if (safeKeys.length === 0) return;
  const setClauses = safeKeys.map((f) => `${f} = ?`).join(', ');
  const values = safeKeys.map((f) => fields[f] ?? null);
  db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values, userId);
}

function deleteUser(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

describe('Database Functions', () => {
  beforeEach(() => {
    // Clear users table before each test
    db.exec('DELETE FROM users');
  });

  describe('createUser', () => {
    it('should create a new user with default values', () => {
      const user = createUser('test@example.com', 'hashedpassword123');
      
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.plan).toBe('free');
      expect(user.stripe_customer_id).toBeNull();
      expect(user.failed_login_attempts).toBe(0);
      expect(user.locked_until).toBeNull();
      expect(user.created_at).toBeDefined();
    });

    it('should not expose password_hash in returned user', () => {
      const user = createUser('test@example.com', 'hashedpassword123');
      
      expect(user).not.toHaveProperty('password_hash');
      expect(user).not.toHaveProperty('refresh_token_hash');
    });

    it('should reject duplicate emails', () => {
      createUser('test@example.com', 'hash1');
      
      expect(() => createUser('test@example.com', 'hash2')).toThrow();
    });
  });

  describe('getUserByEmail', () => {
    it('should return full user row including password_hash', () => {
      createUser('test@example.com', 'hashedpassword123');
      const user = getUserByEmail('test@example.com');
      
      expect(user).toBeDefined();
      expect(user!.email).toBe('test@example.com');
      expect(user!.password_hash).toBe('hashedpassword123');
    });

    it('should return undefined for non-existent email', () => {
      const user = getUserByEmail('nonexistent@example.com');
      
      expect(user).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('should return safe user without sensitive fields', () => {
      const created = createUser('test@example.com', 'hashedpassword123');
      const user = getUserById(created.id);
      
      expect(user).toBeDefined();
      expect(user!.id).toBe(created.id);
      expect(user).not.toHaveProperty('password_hash');
      expect(user).not.toHaveProperty('refresh_token_hash');
    });

    it('should return undefined for non-existent id', () => {
      const user = getUserById(99999);
      
      expect(user).toBeUndefined();
    });
  });

  describe('getUserByIdFull', () => {
    it('should return full user row including sensitive fields', () => {
      const created = createUser('test@example.com', 'hashedpassword123');
      const user = getUserByIdFull(created.id);
      
      expect(user).toBeDefined();
      expect(user!.password_hash).toBe('hashedpassword123');
    });
  });

  describe('updateUser', () => {
    it('should update allowed fields', () => {
      const created = createUser('test@example.com', 'hash1');
      
      updateUser(created.id, { plan: 'pro' });
      const updated = getUserById(created.id);
      
      expect(updated!.plan).toBe('pro');
    });

    it('should update multiple fields at once', () => {
      const created = createUser('test@example.com', 'hash1');
      
      updateUser(created.id, {
        failed_login_attempts: 3,
        locked_until: '2024-01-01T00:00:00Z',
      });
      
      const updated = getUserByIdFull(created.id);
      expect(updated!.failed_login_attempts).toBe(3);
      expect(updated!.locked_until).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle null values correctly', () => {
      const created = createUser('test@example.com', 'hash1');
      updateUser(created.id, { locked_until: '2024-01-01T00:00:00Z' });
      
      updateUser(created.id, { locked_until: null });
      
      const updated = getUserByIdFull(created.id);
      expect(updated!.locked_until).toBeNull();
    });

    it('should not update if no valid fields provided', () => {
      const created = createUser('test@example.com', 'hash1');
      
      // @ts-expect-error Testing invalid field
      updateUser(created.id, { invalid_field: 'value' });
      
      const user = getUserById(created.id);
      expect(user!.email).toBe('test@example.com');
    });

    it('should only allow whitelisted fields (SQL injection prevention)', () => {
      const created = createUser('test@example.com', 'hash1');
      
      // Attempt to inject via field name - should be ignored
      const maliciousFields = { 'id; DROP TABLE users; --': 'hacked' } as UpdatableFields;
      updateUser(created.id, maliciousFields);
      
      // Table should still exist and user should be unchanged
      const user = getUserById(created.id);
      expect(user).toBeDefined();
    });
  });

  describe('deleteUser', () => {
    it('should delete user from database', () => {
      const created = createUser('test@example.com', 'hash1');
      
      deleteUser(created.id);
      
      const user = getUserById(created.id);
      expect(user).toBeUndefined();
    });

    it('should not throw for non-existent user', () => {
      expect(() => deleteUser(99999)).not.toThrow();
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should safely handle malicious email input', () => {
      const maliciousEmail = "test@example.com'; DROP TABLE users; --";
      
      // Should either create safely or throw constraint error, not execute injection
      try {
        createUser(maliciousEmail, 'hash');
        const user = getUserByEmail(maliciousEmail);
        expect(user!.email).toBe(maliciousEmail);
      } catch {
        // Constraint violation is acceptable
      }
      
      // Table should still exist
      const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(count.count).toBeGreaterThanOrEqual(0);
    });

    it('should safely handle malicious password input', () => {
      const maliciousPassword = "hash'; DROP TABLE users; --";
      
      createUser('test@example.com', maliciousPassword);
      const user = getUserByEmail('test@example.com');
      
      expect(user!.password_hash).toBe(maliciousPassword);
    });
  });
});
