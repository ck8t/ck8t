/**
 * Workspace persistence service.
 *
 * Storage priority:
 *  1. Postgres — when DATABASE_URL is set
 *  2. File-based — ~/.salilvnair/ck8t/workspaces/<id>.json (default, no config needed)
 *  3. In-memory  — last resort if disk write fails
 */
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { config } from '../config.js'
import type { WorkspaceSnapshot } from '../types/index.js'

const { Pool } = pg

/* ── File-based store (~/.salilvnair/ck8t/workspaces/) ── */

const DATA_DIR = process.env.CK8T_DATA_DIR ||
  path.join(os.homedir(), '.salilvnair', 'ck8t', 'workspaces')

function wsFilePath(workspaceId: string): string {
  return path.join(DATA_DIR, `${workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`)
}

function fileLoad(workspaceId: string): WorkspaceSnapshot | null {
  try {
    return JSON.parse(fs.readFileSync(wsFilePath(workspaceId), 'utf8')) as WorkspaceSnapshot
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

/* ── Postgres ── */

let pool: pg.Pool | null = null

function getPool(): pg.Pool | null {
  if (pool) return pool
  if (!config.databaseUrl) return null
  pool = new Pool({ connectionString: config.databaseUrl })
  return pool
}

const memStore = new Map<string, WorkspaceSnapshot>()

async function pgSync(workspaceId: string, snapshot: WorkspaceSnapshot): Promise<{ ok: boolean }> {
  const p = getPool()!
  await p.query(
    `INSERT INTO ck8t_workspace (workspace_id, name)
     VALUES ($1, $2)
     ON CONFLICT (workspace_id) DO UPDATE SET name = $2, updated_at = now()`,
    [workspaceId, snapshot.activeWorkspaceId || workspaceId]
  )
  await p.query(
    `CREATE TABLE IF NOT EXISTS ck8t_workspace_snapshot (
       workspace_id text PRIMARY KEY REFERENCES ck8t_workspace(workspace_id) ON DELETE CASCADE,
       data jsonb NOT NULL,
       updated_at timestamptz DEFAULT now()
     )`
  )
  await p.query(
    `INSERT INTO ck8t_workspace_snapshot (workspace_id, data)
     VALUES ($1, $2)
     ON CONFLICT (workspace_id) DO UPDATE SET data = $2, updated_at = now()`,
    [workspaceId, JSON.stringify(snapshot)]
  )
  return { ok: true }
}

async function pgLoad(workspaceId: string): Promise<WorkspaceSnapshot | null> {
  const p = getPool()!
  try {
    const r = await p.query(
      `SELECT data FROM ck8t_workspace_snapshot WHERE workspace_id = $1`,
      [workspaceId]
    )
    return r.rows.length ? r.rows[0].data as WorkspaceSnapshot : null
  } catch {
    return null
  }
}

/* ── Public API ── */

export async function syncWorkspace(workspaceId: string, snapshot: WorkspaceSnapshot): Promise<{ ok: boolean }> {
  const p = getPool()
  if (p) return pgSync(workspaceId, snapshot)
  memStore.set(workspaceId, snapshot)
  fileSync(workspaceId, snapshot)
  return { ok: true }
}

export async function loadWorkspace(workspaceId: string): Promise<WorkspaceSnapshot | null> {
  const p = getPool()
  if (p) return pgLoad(workspaceId)
  return memStore.get(workspaceId) ?? fileLoad(workspaceId)
}
