/**
 * SQLite-backed KV store using sql.js (WASM).
 * Zero native compilation — works in any Node.js/Electron version without rebuilds.
 *
 * Public API: readCollection, writeCollection, upsert, remove, findById, findAll
 * Table: bs_store (collection TEXT, id TEXT, data TEXT, PRIMARY KEY (collection, id))
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type SqlJsDatabase = import('sql.js').Database;

let _db: SqlJsDatabase | null = null;
let _dbPath = '';
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

// ── Initialization ─────────────────────────────────────────────────────────

export async function initDb(_storagePath: string, extensionPath: string): Promise<void> {
  const dbDir = path.join(os.homedir(), '.salilvnair', 'ck8t', 'db');
  fs.mkdirSync(dbDir, { recursive: true });
  _dbPath = path.join(dbDir, 'ck8t.db');

  try {
    const wasmPath = path.join(extensionPath, 'out', 'sql-wasm.wasm');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const initSqlJs = require('sql.js') as typeof import('sql.js').default;

    const SQL = await initSqlJs({ locateFile: () => wasmPath });

    if (fs.existsSync(_dbPath)) {
      const buffer = fs.readFileSync(_dbPath);
      _db = new SQL.Database(buffer);
    } else {
      _db = new SQL.Database();
    }

    _db.run('PRAGMA journal_mode = WAL');
    _db.run('PRAGMA busy_timeout = 5000');
    _db.run('PRAGMA synchronous = NORMAL');

    _db.run(`
      CREATE TABLE IF NOT EXISTS bs_store (
        collection TEXT NOT NULL,
        id         TEXT NOT NULL,
        data       TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      )
    `);

    _saveToDisk();
  } catch (err: unknown) {
    console.error('[ck8t] SQLite init failed:', err instanceof Error ? err.message : String(err));
    _db = null;
  }
}

export function closeDb(): void {
  if (_db) {
    _saveToDisk();
    _db.close();
    _db = null;
  }
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
}

// ── Persistence ───────────────────────────────────────────────────────────

function _scheduleSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => _saveToDisk(), 200);
}

function _saveToDisk(): void {
  if (!_db || !_dbPath) return;
  try {
    const data = _db.export();
    fs.writeFileSync(_dbPath, Buffer.from(data));
  } catch (e) {
    console.error('[ck8t] Failed to save DB:', e);
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export function readCollection<T>(name: string): Record<string, T> {
  if (!_db) return {};
  const stmt = _db.prepare('SELECT id, data FROM bs_store WHERE collection = ?');
  stmt.bind([name]);
  const out: Record<string, T> = {};
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; data: string };
    try { out[row.id] = JSON.parse(row.data) as T; } catch { /* skip corrupt */ }
  }
  stmt.free();
  return out;
}

export function writeCollection<T>(name: string, data: Record<string, T>): void {
  if (!_db) return;
  _db.run('DELETE FROM bs_store WHERE collection = ?', [name]);
  for (const [id, record] of Object.entries(data)) {
    _db.run(
      'INSERT OR REPLACE INTO bs_store (collection, id, data) VALUES (?, ?, ?)',
      [name, id, JSON.stringify(record)]
    );
  }
  _scheduleSave();
}

export function upsert<T>(name: string, id: string, record: T): T {
  if (!_db) return record;
  _db.run(
    'INSERT OR REPLACE INTO bs_store (collection, id, data) VALUES (?, ?, ?)',
    [name, id, JSON.stringify(record)]
  );
  _scheduleSave();
  return record;
}

export function remove(name: string, id: string): void {
  if (!_db) return;
  _db.run('DELETE FROM bs_store WHERE collection = ? AND id = ?', [name, id]);
  _scheduleSave();
}

export function findById<T>(name: string, id: string): T | undefined {
  if (!_db) return undefined;
  const stmt = _db.prepare('SELECT data FROM bs_store WHERE collection = ? AND id = ?');
  stmt.bind([name, id]);
  let result: T | undefined;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { data: string };
    try { result = JSON.parse(row.data) as T; } catch { /* skip */ }
  }
  stmt.free();
  return result;
}

export function findAll<T>(name: string): T[] {
  if (!_db) return [];
  const stmt = _db.prepare('SELECT data FROM bs_store WHERE collection = ?');
  stmt.bind([name]);
  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { data: string };
    try { results.push(JSON.parse(row.data) as T); } catch { /* skip */ }
  }
  stmt.free();
  return results;
}

// ── DB Explorer ──────────────────────────────────────────────────────────────

export interface DbTableInfo {
  name: string;
  rowCount: number;
}

export function getDbTables(): DbTableInfo[] {
  if (!_db) return [];
  const stmt = _db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  const tables: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name: string };
    tables.push(row.name);
  }
  stmt.free();
  return tables.map((name) => {
    const cStmt = _db!.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`);
    let rowCount = 0;
    if (cStmt.step()) rowCount = (cStmt.getAsObject() as { cnt: number }).cnt;
    cStmt.free();
    return { name, rowCount };
  });
}

export function getDbTableRows(tableName: string, limit = 100, offset = 0): Record<string, unknown>[] {
  if (!_db) return [];
  // Whitelist: only allow querying known tables to prevent injection
  const allowed = _db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`);
  allowed.bind([tableName]);
  const exists = allowed.step();
  allowed.free();
  if (!exists) return [];

  const stmt = _db.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`);
  stmt.bind([limit, offset]);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

/** Returns distinct collections in bs_store as virtual table entries */
export function getDbCollections(): DbTableInfo[] {
  if (!_db) return [];
  try {
    const stmt = _db.prepare(
      `SELECT collection as name, COUNT(*) as rowCount FROM bs_store GROUP BY collection ORDER BY collection`
    );
    const results: DbTableInfo[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { name: string; rowCount: number };
      results.push({ name: row.name, rowCount: row.rowCount });
    }
    stmt.free();
    return results;
  } catch {
    return [];
  }
}

/** Returns rows from a bs_store collection (virtual table) */
export function getCollectionRows(collection: string, limit = 100, offset = 0): Record<string, unknown>[] {
  if (!_db) return [];
  const stmt = _db.prepare(
    `SELECT id, json(data) as data FROM bs_store WHERE collection = ? LIMIT ? OFFSET ?`
  );
  stmt.bind([collection, limit, offset]);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string; data: string };
    try {
      const parsed = JSON.parse(row.data);
      rows.push({ id: row.id, ...parsed });
    } catch {
      rows.push({ id: row.id, data: row.data });
    }
  }
  stmt.free();
  return rows;
}

export function getDbPath(): string { return _dbPath; }
