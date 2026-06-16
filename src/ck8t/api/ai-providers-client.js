/**
 * API client for the AI providers bridge route.
 * Falls back gracefully when the bridge server is not running (browser mode).
 */

const _BASE = (
  globalThis.__CK8T_BRIDGE_BASE__ ||
  import.meta.env?.VITE_CONVENGINE_BASE ||
  (import.meta.env?.DEV ? 'http://localhost:3001/api/v1' : 'http://localhost:8080/api/v1')
).replace(/\/$/, '')

async function _call(path, method = 'GET', body) {
  const base = _BASE
  if (!base) return null
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) opts.body = JSON.stringify(body)
  try {
    const res = await fetch(`${base}${path}`, opts)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Load all provider configs + key status + default from bridge */
export async function fetchAiProviders() {
  return _call('/ck8t/ai-providers')
}

/** Save a provider config override (enabled, name, baseUrl, models) */
export async function putAiProvider(id, config) {
  return _call(`/ck8t/ai-providers/${id}`, 'PUT', config)
}

/** Save API key for a provider */
export async function saveAiProviderKey(id, key, { name, baseUrl } = {}) {
  return _call(`/ck8t/ai-providers/keys/${id}`, 'POST', { key, name, baseUrl })
}

/** Delete API key for a provider */
export async function deleteAiProviderKey(id) {
  return _call(`/ck8t/ai-providers/keys/${id}`, 'DELETE')
}

/** Set default provider + model */
export async function setAiProviderDefault(providerId, modelId) {
  return _call('/ck8t/ai-providers/default', 'POST', { providerId, modelId })
}
