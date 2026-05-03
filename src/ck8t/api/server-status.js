/**
 * Server availability detection for CK8T.
 *
 * Tries a lightweight GET against the provider list endpoint.
 * Result is cached for the session so every component can call
 * `detectServer()` without firing multiple requests.
 *
 * Usage:
 *   import { detectServer, getServerAvailable } from './server-status'
 *
 *   // In an effect / async context:
 *   const available = await detectServer()
 *
 *   // Synchronously after first detection:
 *   const available = getServerAvailable()   // null = not yet known
 */

// Probe ck8t-server (3001), not Spring Boot (8080) — ck8t-server is the gateway.
const BASE = (
  globalThis.__CK8T_BRIDGE_BASE__ ||
  import.meta.env?.VITE_CONVENGINE_BASE ||
  'http://localhost:3001/api/v1'
).replace(/\/$/, '')

let _status = null     // null | true | false
let _promise = null    // in-flight probe

/**
 * Probe the server once and cache the result.
 * Subsequent calls resolve immediately from cache.
 */
export async function detectServer() {
  if (_status !== null) return _status
  if (_promise) return _promise

  _promise = (async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2500)
      const res = await fetch(`${BASE}/ck8t/llm/providers`, { signal: controller.signal })
      clearTimeout(timeout)
      _status = res.ok
    } catch {
      _status = false
    }
    return _status
  })()

  return _promise
}

/** Synchronous read — null means detection hasn't completed yet. */
export function getServerAvailable() { return _status }

/** Force a fresh probe on next call (useful for manual "retry" buttons). */
export function resetServerStatus() { _status = null; _promise = null }
