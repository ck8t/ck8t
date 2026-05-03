/**
 * LLM provider API client.
 *
 * Each exported function probes for ck8t-server availability first.
 *   • Server available  → calls ck8t-server REST endpoints (original behaviour).
 *   • Server absent     → routes to the browser-providers Zustand store, which
 *                         stores providers in AES-GCM-encrypted localStorage and
 *                         lets graph-runner make direct browser LLM calls.
 *
 * The probe result is cached for the session (see server-status.js), so only
 * the very first call in a session pays the 2.5 s timeout round-trip.
 */
import { detectServer } from './server-status'
import { useBrowserProvidersStore } from './browser-providers-store'

// Always call ck8t-server directly — avoids Vite-proxy path-rewrite issues and CORS for local providers
const BASE = (
  globalThis.__CK8T_BRIDGE_BASE__ ||
  import.meta.env?.VITE_CONVENGINE_BASE ||
  (import.meta.env?.DEV ? 'http://localhost:3001/api/v1' : 'http://localhost:8080/api/v1')
).replace(/\/$/, '')

/** Ensure the browser store is hydrated and return its state. */
async function browserStore() {
  const s = useBrowserProvidersStore.getState()
  await s.hydrate()
  return s
}

export async function fetchAvailableProviders() {
  const serverUp = await detectServer()
  if (!serverUp) {
    const s = await browserStore()
    return s.buildModelConfig() // null when no providers configured yet
  }
  const res = await fetch(`${BASE}/ck8t/llm/providers`)
  if (!res.ok) throw new Error(`Failed to load available providers (${res.status})`)
  return await res.json()
}

export async function changeRuntimeProvider(body) {
  const serverUp = await detectServer()
  if (!serverUp) {
    const s = await browserStore()
    if (body?.provider) await s.setActive(body.provider)
    return s.buildModelConfig()
  }
  const res = await fetch(`${BASE}/ck8t/llm/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  if (!res.ok) throw new Error(`Failed to change provider (${res.status})`)
  return await res.json()
}

/* ── Custom provider CRUD ─────────────────────────────────────────────── */

export async function fetchCustomProviders() {
  const serverUp = await detectServer()
  if (!serverUp) {
    const s = await browserStore()
    return s.providers
  }
  const res = await fetch(`${BASE}/ck8t/llm/custom-providers`)
  if (!res.ok) throw new Error(`Failed to load custom providers (${res.status})`)
  return await res.json()
}

/**
 * Create or update a custom provider.
 * @param {Object} cfg  { name, type, chatUrl, modelsUrl, apiKey?, headers? }
 */
export async function saveCustomProvider(cfg) {
  const serverUp = await detectServer()
  if (!serverUp) {
    const s = await browserStore()
    return s.saveProvider(cfg)
  }
  const res = await fetch(`${BASE}/ck8t/llm/custom-providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to save custom provider (${res.status})`)
  }
  const saved = await res.json()
  // Auto-fetch models right after saving
  if (cfg.modelsUrl) {
    try { await refreshCustomProviderModels(saved.key || cfg.key) } catch { /* ignore */ }
  }
  return saved
}

/**
 * Delete a custom provider by its key.
 */
export async function deleteCustomProvider(key) {
  const serverUp = await detectServer()
  if (!serverUp) {
    const s = await browserStore()
    await s.deleteProvider(key)
    return { key }
  }
  const res = await fetch(`${BASE}/ck8t/llm/custom-providers/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Failed to delete custom provider (${res.status})`)
  return await res.json()
}

/**
 * Refresh the model list for a custom provider.
 * In browser mode: fetches directly from the provider URL (may hit CORS for remote providers).
 * In server mode: ck8t-server fetches server-side (no CORS issues).
 */
export async function refreshCustomProviderModels(key) {
  const serverUp = await detectServer()
  if (!serverUp) {
    const s = await browserStore()
    return s.refreshModels(key)
  }
  const res = await fetch(
    `${BASE}/ck8t/llm/custom-providers/${encodeURIComponent(key)}/models`,
    { method: 'POST' },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to refresh models (${res.status})`)
  }
  return await res.json()
}
