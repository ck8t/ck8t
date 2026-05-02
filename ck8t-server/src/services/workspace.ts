/**
 * Workspace persistence service.
 *
 * Strategy (proxy-first):
 *  1. DEFAULT: proxy through ConvEngine's workspace endpoints.
 *     ConvEngine (convengine-demo) owns the database and schema.
 *  2. FALLBACK: if DIRECT_PERSISTENCE=true, use Postgres directly
 *     (or in-memory when DATABASE_URL is not set).
 */
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import type { WorkspaceSnapshot } from '../types/index.js'

const { Pool } = pg
const useDirectPersistence = process.env.DIRECT_PERSISTENCE === 'true'

// ── File-based fallback store (survives server restarts, no DB needed) ──
const DATA_DIR = process.env.CK8T_DATA_DIR || path.join(process.cwd(), '.ck8t-data')

function wsFilePath(workspaceId: string): string {
  return path.join(DATA_DIR, `${workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`)
}

function fileLoad(workspaceId: string): WorkspaceSnapshot | null {
  try {
    const raw = fs.readFileSync(wsFilePath(workspaceId), 'utf8')
    return JSON.parse(raw) as WorkspaceSnapshot
  } catch {
    return null
  }
}

function fileSync(workspaceId: string, snapshot: WorkspaceSnapshot): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(wsFilePath(workspaceId), JSON.stringify(snapshot), 'utf8')
  } catch { /* disk unavailable — fall through to memStore */ }
}

// ── Proxy to ConvEngine (default) ──

async function proxySync(workspaceId: string, snapshot: WorkspaceSnapshot): Promise<{ ok: boolean }> {
  const url = `${config.convengineBase}/builder-studio/workspace/${encodeURIComponent(workspaceId)}/sync`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ConvEngine workspace sync ${res.status}: ${text}`)
  }
  return { ok: true }
}

async function proxyLoad(workspaceId: string): Promise<WorkspaceSnapshot | null> {
  const url = `${config.convengineBase}/builder-studio/workspace/${encodeURIComponent(workspaceId)}`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ConvEngine workspace load ${res.status}: ${text}`)
  }
  return await res.json() as WorkspaceSnapshot
}

// ── Direct Postgres / in-memory (opt-in) ──

let pool: pg.Pool | null = null

function getPool(): pg.Pool | null {
  if (pool) return pool
  if (!config.databaseUrl) return null
  pool = new Pool({ connectionString: config.databaseUrl })
  return pool
}

const memStore = new Map<string, WorkspaceSnapshot>()

async function directSync(workspaceId: string, snapshot: WorkspaceSnapshot): Promise<{ ok: boolean }> {
  const p = getPool()
  if (!p) {
    memStore.set(workspaceId, snapshot)
    fileSync(workspaceId, snapshot)  // also persist to disk
    return { ok: true }
  }
  await p.query(
    `INSERT INTO ce_bs_workspace (workspace_id, name, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id) DO UPDATE SET name = $2, description = $3, updated_at = now()`,
    [workspaceId, snapshot.activeWorkspaceId || workspaceId, '']
  )
  await p.query(
    `CREATE TABLE IF NOT EXISTS ce_bs_workspace_snapshot (
       workspace_id text PRIMARY KEY REFERENCES ce_bs_workspace(workspace_id) ON DELETE CASCADE,
       data jsonb NOT NULL,
       updated_at timestamptz DEFAULT now()
     )`
  , [])
  await p.query(
    `INSERT INTO ce_bs_workspace_snapshot (workspace_id, data)
     VALUES ($1, $2)
     ON CONFLICT (workspace_id) DO UPDATE SET data = $2, updated_at = now()`,
    [workspaceId, JSON.stringify(snapshot)]
  )
  return { ok: true }
}

async function directLoad(workspaceId: string): Promise<WorkspaceSnapshot | null> {
  const p = getPool()
  if (!p) {
    // Try in-memory first (fastest), then disk (survives restarts)
    return memStore.get(workspaceId) ?? fileLoad(workspaceId)
  }
  try {
    const r = await p.query(
      `SELECT data FROM ce_bs_workspace_snapshot WHERE workspace_id = $1`,
      [workspaceId]
    )
    if (r.rows.length === 0) return null
    return r.rows[0].data as WorkspaceSnapshot
  } catch {
    return null
  }
}

// ── Public API ──

export async function syncWorkspace(workspaceId: string, snapshot: WorkspaceSnapshot): Promise<{ ok: boolean }> {
  if (useDirectPersistence) return directSync(workspaceId, snapshot)
  try {
    return await proxySync(workspaceId, snapshot)
  } catch {
    // convengine-demo not running — fall back to in-memory / Postgres directly
    return directSync(workspaceId, snapshot)
  }
}

export async function loadWorkspace(workspaceId: string): Promise<WorkspaceSnapshot | null> {
  if (useDirectPersistence) return directLoad(workspaceId)
  try {
    return await proxyLoad(workspaceId)
  } catch {
    // convengine-demo not running — fall back to in-memory / Postgres directly
    return directLoad(workspaceId)
  }
}
