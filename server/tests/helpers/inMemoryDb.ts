/**
 * Pure-JS in-memory database that mirrors the better-sqlite3 synchronous API.
 *
 * Implements only the operations used by SENTRY's server test suite:
 *   - pragma()              no-op
 *   - exec(sql)             CREATE TABLE (no-op) | DELETE FROM users
 *   - prepare(sql).run()    INSERT / UPDATE / DELETE
 *   - prepare(sql).get()    SELECT (single row)
 *   - prepare(sql).all()    SELECT (multiple rows — returns [])
 *
 * This avoids the need for the better-sqlite3 native binary, which cannot be
 * compiled in every CI / network-drive environment.
 */

interface Row extends Record<string, unknown> {
  id: number;
}

interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

interface Statement {
  run: (...args: unknown[]) => RunResult;
  get: (...args: unknown[]) => Row | undefined;
  all: (...args: unknown[]) => Row[];
}

export class Database {
  private rows = new Map<number, Row>();
  private nextId = 1;

  /** No-op — SQLite pragma settings are irrelevant for JS-backed tests. */
  pragma(_: string): void {}

  /** Handles CREATE TABLE (ignored) and DELETE FROM <table>. */
  exec(sql: string): void {
    // Only react to DELETE FROM without a WHERE clause (used in beforeEach cleanup).
    if (/DELETE\s+FROM\s+\w+\s*;?\s*$/i.test(sql.trim())) {
      this.rows.clear();
      this.nextId = 1;
    }
    // CREATE TABLE, pragma statements etc. are ignored.
  }

  prepare(sql: string): Statement {
    const db = this;
    const normalised = sql.trim();
    return {
      run: (...args: unknown[]) => db._run(normalised, args),
      get: (...args: unknown[]) => db._get(normalised, args),
      all: (...args: unknown[]) => db._all(normalised, args),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private execution helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private _run(sql: string, args: unknown[]): RunResult {
    const s = sql.toLowerCase();

    // ── INSERT INTO <table> (cols) VALUES (?, …) ─────────────────────────────
    const insertMatch = sql.match(/^INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const cols = insertMatch[1].split(',').map((c) => c.trim());
      const emailIdx = cols.indexOf('email');
      if (emailIdx >= 0) {
        const email = args[emailIdx] as string;
        if (this._byEmail(email)) {
          throw new Error('UNIQUE constraint failed: users.email');
        }
      }
      const id = this.nextId++;
      const defaults: Row = {
        id,
        plan: 'free',
        stripe_customer_id: null,
        failed_login_attempts: 0,
        locked_until: null,
        refresh_token_hash: null,
        created_at: new Date().toISOString(),
      };
      const row: Row = { ...defaults };
      cols.forEach((col, i) => {
        row[col] = args[i] ?? null;
      });
      this.rows.set(id, row);
      return { lastInsertRowid: id, changes: 1 };
    }

    // ── UPDATE <table> SET … WHERE id = ? ────────────────────────────────────
    const updateId = sql.match(/^UPDATE\s+\w+\s+SET\s+(.+?)\s+WHERE\s+id\s*=\s*\?/i);
    if (updateId) {
      const id = args[args.length - 1] as number;
      const row = this.rows.get(id);
      if (row) {
        const updates = this._parseSet(updateId[1], args);
        Object.assign(row, updates);
        this.rows.set(id, row);
        return { lastInsertRowid: 0, changes: 1 };
      }
      return { lastInsertRowid: 0, changes: 0 };
    }

    // ── UPDATE <table> SET … WHERE email = ? ────────────────────────────────
    const updateEmail = sql.match(/^UPDATE\s+\w+\s+SET\s+(.+?)\s+WHERE\s+email\s*=\s*\?/i);
    if (updateEmail) {
      const email = args[args.length - 1] as string;
      const row = this._byEmail(email);
      if (row) {
        const updates = this._parseSet(updateEmail[1], args);
        Object.assign(row, updates);
        this.rows.set(row.id, row);
        return { lastInsertRowid: 0, changes: 1 };
      }
      return { lastInsertRowid: 0, changes: 0 };
    }

    // ── DELETE FROM <table> WHERE id = ? ─────────────────────────────────────
    if (/^DELETE\s+FROM\s+\w+\s+WHERE\s+id\s*=\s*\?/i.test(sql)) {
      const deleted = this.rows.delete(args[0] as number);
      return { lastInsertRowid: 0, changes: deleted ? 1 : 0 };
    }

    // ── DELETE FROM <table> WHERE email = ? ──────────────────────────────────
    if (/^DELETE\s+FROM\s+\w+\s+WHERE\s+email\s*=\s*\?/i.test(sql)) {
      const row = this._byEmail(args[0] as string);
      if (row) {
        this.rows.delete(row.id);
        return { lastInsertRowid: 0, changes: 1 };
      }
      return { lastInsertRowid: 0, changes: 0 };
    }

    return { lastInsertRowid: 0, changes: 0 };
  }

  private _get(sql: string, args: unknown[]): Row | undefined {
    const s = sql.toLowerCase();

    // ── COUNT(*) ─────────────────────────────────────────────────────────────
    if (s.includes('count(*)')) {
      return { id: 0, count: this.rows.size } as unknown as Row;
    }

    // ── sqlite_master table-existence check ──────────────────────────────────
    if (s.includes('sqlite_master')) {
      return this.rows.size >= 0 ? ({ name: 'users' } as unknown as Row) : undefined;
    }

    // ── Locate the matching row ───────────────────────────────────────────────
    let row: Row | undefined;

    if (/where\s+id\s*=\s*\?/.test(s) && !/id\s*!=\s*\?/.test(s)) {
      row = this.rows.get(args[0] as number);
    } else if (/where\s+email\s*=\s*\?\s+and\s+id\s*!=\s*\?/.test(s)) {
      row = [...this.rows.values()].find(
        (r) => r.email === args[0] && r.id !== args[1]
      );
    } else if (/where\s+email\s*=\s*\?/.test(s)) {
      row = this._byEmail(args[0] as string);
    }

    if (!row) return undefined;

    // ── Column projection ─────────────────────────────────────────────────────
    if (/^select\s+\*/.test(s)) return { ...row };
    if (/^select\s+id,\s*email,\s*plan/.test(s))
      return { id: row.id, email: row.email, plan: row.plan } as Row;
    if (/^select\s+id\s+from/.test(s)) return { id: row.id } as Row;
    if (/^select\s+email\s+from/.test(s)) return { email: row.email } as Row;
    if (/^select\s+password_hash\s+from/.test(s))
      return { password_hash: row.password_hash } as unknown as Row;
    if (/^select\s+refresh_token_hash\s+from/.test(s))
      return { refresh_token_hash: row.refresh_token_hash } as unknown as Row;
    if (/^select\s+failed_login_attempts\s+from/.test(s))
      return { failed_login_attempts: row.failed_login_attempts } as unknown as Row;

    // Fallback: return all columns
    return { ...row };
  }

  private _all(_sql: string, _args: unknown[]): Row[] {
    // None of the existing tests rely on .all() returning data.
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Parse a SQL SET clause such as
   *   "col1 = ?, col2 = NULL, col3 = 0, col4 = ?"
   * into a plain object of column → value, consuming `?` from args left-to-right.
   */
  private _parseSet(setClause: string, args: unknown[]): Record<string, unknown> {
    const updates: Record<string, unknown> = {};
    let argIdx = 0;

    for (const part of setClause.split(',')) {
      const eqIdx = part.indexOf('=');
      const col = part.substring(0, eqIdx).trim();
      const val = part.substring(eqIdx + 1).trim();

      if (val === '?') {
        updates[col] = args[argIdx++];
      } else if (val.toUpperCase() === 'NULL') {
        updates[col] = null;
      } else if (/^-?\d+$/.test(val)) {
        updates[col] = Number(val);
      } else {
        updates[col] = val;
      }
    }

    return updates;
  }

  private _byEmail(email: string): Row | undefined {
    return [...this.rows.values()].find((r) => r.email === email);
  }
}

export default Database;
