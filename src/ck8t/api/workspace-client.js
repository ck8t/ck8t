/**
 * API client for Builder Studio persistence endpoints.
 *
 * Dual-persistence: the front-end keeps localStorage (Zustand persist) as
 * the primary store and mirrors every save to the server via these endpoints.
 * On startup, the app can hydrate from the server when localStorage is empty.
 *
 * Both functions short-circuit immediately when the server is known to be
 * unavailable (browser mode) — no wasted network call on every Cmd+S.
 *
 * Endpoints:
 *  - POST /api/v1/ck8t/workspace/{id}/sync   → save snapshot
 *  - GET  /api/v1/ck8t/workspace/{id}         → load snapshot
 */
import { getServerAvailable } from './server-status'

const BASE = (
  globalThis.__CK8T_BRIDGE_BASE__ ||
  import.meta.env?.VITE_CONVENGINE_BASE ||
  (import.meta.env?.DEV ? 'http://localhost:3001/api/v1' : 'http://localhost:8080/api/v1')
).replace(/\/$/, '')

/**
 * Save (sync) the full workspace snapshot to the server.
 * No-ops immediately when the server is known to be down (browser mode).
 * Fire-and-forget from the caller's perspective — errors are logged but
 * don't block the UI.
 */
export async function syncWorkspaceToServer(workspaceId, snapshot) {
  if (getServerAvailable() === false) return { ok: false, reason: 'browser-mode' }

  const url = `${BASE}/ck8t/workspace/${encodeURIComponent(workspaceId)}/sync`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    })
    if (!res.ok) {
      console.warn('[ck8t] sync failed:', res.status, await res.text())
      return { ok: false, status: res.status }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[ck8t] sync network error:', err.message)
    return { ok: false, error: err.message }
  }
}

/**
 * Load the full workspace snapshot from the server.
 * No-ops immediately when the server is known to be down (browser mode).
 * Returns the snapshot object on success, or null if unavailable.
 */
export async function loadWorkspaceFromServer(workspaceId) {
  if (getServerAvailable() === false) return null

  const url = `${BASE}/ck8t/workspace/${encodeURIComponent(workspaceId)}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn('[ck8t] load failed:', res.status)
      return null
    }
    const data = await res.json()
    return data || null
  } catch (err) {
    console.warn('[ck8t] load network error:', err.message)
    return null
  }
}
