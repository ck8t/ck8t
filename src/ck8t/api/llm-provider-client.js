// Always call ck8t-server directly — avoids Vite-proxy path-rewrite issues and CORS for local providers
const BASE = (
  globalThis.__CK8T_BRIDGE_BASE__ ||
  import.meta.env?.VITE_CONVENGINE_BASE ||
  (import.meta.env?.DEV ? 'http://localhost:3001/api/v1' : 'http://localhost:8080/api/v1')
).replace(/\/$/, '')

export async function fetchAvailableProviders() {
  const res = await fetch(`${BASE}/ck8t/llm/providers`)
  if (!res.ok) throw new Error(`Failed to load available providers (${res.status})`)
  return await res.json()
}

export async function changeRuntimeProvider(body) {
  const res = await fetch(`${BASE}/ck8t/llm/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  if (!res.ok) throw new Error(`Failed to change provider (${res.status})`)
  return await res.json()
}

/* ── Custom provider CRUD — always via ck8t-server ───────────────── */

export async function fetchCustomProviders() {
  const res = await fetch(`${BASE}/ck8t/llm/custom-providers`)
  if (!res.ok) throw new Error(`Failed to load custom providers (${res.status})`)
  return await res.json()
}

/**
 * Create or update a custom provider.
 * @param {Object} cfg  { name, type, chatUrl, modelsUrl, apiKey?, headers? }
 */
export async function saveCustomProvider(cfg) {
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
  const res = await fetch(`${BASE}/ck8t/llm/custom-providers/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Failed to delete custom provider (${res.status})`)
  return await res.json()
}

/**
 * Refresh the model list for a custom provider.
 * ck8t-server fetches from the provider's modelsUrl server-side (no CORS issues).
 */
export async function refreshCustomProviderModels(key) {
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