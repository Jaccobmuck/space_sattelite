import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '..', '..', 'sentry.db');

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
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

// Migrate existing tables that may lack new columns
const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
const columnNames = new Set(tableInfo.map((c) => c.name));

if (!columnNames.has('failed_login_attempts')) {
  db.exec("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0");
}
if (!columnNames.has('locked_until')) {
  db.exec("ALTER TABLE users ADD COLUMN locked_until TEXT");
}
if (!columnNames.has('refresh_token_hash')) {
  db.exec("ALTER TABLE users ADD COLUMN refresh_token_hash TEXT");
}

export interface UserRow {
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

export type SafeUser = Omit<UserRow, 'password_hash' | 'refresh_token_hash'>;

function stripSensitiveFields(user: UserRow): SafeUser {
  const { password_hash: _pw, refresh_token_hash: _rt, ...safe } = user;
  return safe;
}

// Safe dynamic UPDATE — only whitelisted columns allowed
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

export function updateUser(userId: number, fields: UpdatableFields): void {
  const safeKeys = ALLOWED_UPDATE_FIELDS.filter((f) => f in fields);
  if (safeKeys.length === 0) return;
  const setClauses = safeKeys.map((f) => `${f} = ?`).join(', ');
  const values = safeKeys.map((f) => fields[f] ?? null);
  db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values, userId);
}

export function createUser(email: string, passwordHash: string): SafeUser {
  const stmt = db.prepare(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)'
  );
  const result = stmt.run(email, passwordHash);
  return getUserById(result.lastInsertRowid as number)!;
}

export function getUserByEmail(email: string): UserRow | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) as UserRow | undefined;
}

export function getUserById(id: number): SafeUser | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const row = stmt.get(id) as UserRow | undefined;
  return row ? stripSensitiveFields(row) : undefined;
}

export function getUserByIdFull(id: number): UserRow | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as UserRow | undefined;
}

export function updateUserPlan(userId: number, plan: 'free' | 'pro'): void {
  updateUser(userId, { plan });
}

export function updateUserStripeCustomerId(userId: number, stripeCustomerId: string): void {
  updateUser(userId, { stripe_customer_id: stripeCustomerId });
}

export function getUserByStripeCustomerId(stripeCustomerId: string): SafeUser | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?');
  const row = stmt.get(stripeCustomerId) as UserRow | undefined;
  return row ? stripSensitiveFields(row) : undefined;
}

export function deleteUser(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

export default db;
