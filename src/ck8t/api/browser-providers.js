/**
 * Browser-mode provider storage — replaces ck8t-server when it isn't running.
 *
 * Providers are persisted in localStorage under 'ck8t/browser-providers'.
 * The active provider selection is stored under 'ck8t/browser-active-provider'.
 *
 * buildBrowserModelConfig() produces the full consumer-config shape that
 * llm-config-store.setConfig() understands, including apiKey and baseUrl
 * so graph-runner's tryDirectLlmCall() can make direct browser LLM calls.
 */

const STORAGE_KEY = 'ck8t/browser-providers'
const ACTIVE_KEY  = 'ck8t/browser-active-provider'

/** Known path suffixes per type — used to strip paths and get the host/baseUrl. */
const TYPE_PATHS = {
  openai:    ['/v1/chat/completions',                '/v1/models'],
  anthropic: ['/v1/messages',                        '/v1/models'],
  gemini:    ['/v1beta/openai/chat/completions',      '/v1beta/openai/models'],
  qwen:      ['/compatible-mode/v1/chat/completions', '/compatible-mode/v1/models'],
  lmstudio:  ['/v1/chat/completions',                '/v1/models'],
  ollama:    ['/api/chat',                            '/api/tags'],
}

function extractHost(url, type) {
  if (!url) return ''
  for (const p of (TYPE_PATHS[type] || TYPE_PATHS.openai)) {
    if (url.endsWith(p)) return url.slice(0, -p.length)
  }
  try { return new URL(url).origin } catch { return '' }
}

function toSlug(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

/* ── localStorage helpers ─────────────────────────────────────────────── */

export function getBrowserProviders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function putProviders(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch { /* sandboxed */ }
}

export function getBrowserActiveProvider() {
  try { return localStorage.getItem(ACTIVE_KEY) || null } catch { return null }
}

export function setBrowserActiveProvider(key) {
  try { localStorage.setItem(ACTIVE_KEY, key) } catch { /* sandboxed */ }
}

/* ── CRUD ─────────────────────────────────────────────────────────────── */

/**
 * Create or update a browser provider.
 * @param {Object} cfg  { name, type, chatUrl, modelsUrl, apiKey?, headers?, key? }
 */
export async function saveBrowserProvider(cfg) {
  const list = getBrowserProviders()
  const key  = cfg.key || toSlug(cfg.name)
  const existing = list.find((p) => p.key === key)

  const entry = {
    ...(existing || {}),
    key,
    name:      cfg.name,
    type:      cfg.type || 'openai',
    chatUrl:   cfg.chatUrl   || '',
    modelsUrl: cfg.modelsUrl || '',
    headers:   cfg.headers   || {},
    // Keep existing apiKey when none supplied (edit flow with blank field)
    ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
  }

  putProviders(existing ? list.map((p) => (p.key === key ? entry : p)) : [...list, entry])

  // Auto-fetch models after save (mirrors server-side behaviour)
  if (cfg.modelsUrl || cfg.type === 'anthropic') {
    try { await refreshBrowserProviderModels(key) } catch { /* ignore */ }
  }
  return entry
}

/** Remove a provider by key. */
export function deleteBrowserProvider(key) {
  putProviders(getBrowserProviders().filter((p) => p.key !== key))
  // Clear active pointer if it was this provider
  if (getBrowserActiveProvider() === key) {
    try { localStorage.removeItem(ACTIVE_KEY) } catch { /* sandboxed */ }
  }
}

/* ── Model fetching ───────────────────────────────────────────────────── */

/**
 * Fetch the model list for a browser provider and cache it in localStorage.
 * Anthropic: returns a static list (API doesn't allow unauthenticated listing).
 * Ollama:    GET {modelsUrl} → { models: [{name}] }
 * Others:    GET {modelsUrl} → { data: [{id}] }  (OpenAI-compatible)
 */
export async function refreshBrowserProviderModels(key) {
  const list     = getBrowserProviders()
  const provider = list.find((p) => p.key === key)
  if (!provider) throw new Error('Provider not found')
  if (!provider.modelsUrl) throw new Error('Provider has no models URL configured')

  const headers = { ...(provider.headers || {}) }

  if (provider.type === 'anthropic') {
    if (provider.apiKey) headers['x-api-key'] = provider.apiKey
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  } else if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const res = await fetch(provider.modelsUrl, { headers })
  if (!res.ok) throw new Error(`Failed to fetch models (${res.status}): ${await res.text()}`)
  const data = await res.json()

  let models
  if (provider.type === 'ollama' && Array.isArray(data.models)) {
    models = data.models.map((m) => m.name).filter(Boolean)
  } else if (Array.isArray(data.data)) {
    models = data.data.map((m) => m.id).filter(Boolean)
  } else {
    throw new Error('Unrecognised models response shape — expected { data: [...] } or { models: [...] }')
  }

  putProviders(list.map((p) => (p.key === key ? { ...p, cachedModels: models } : p)))
  return models
}

/* ── Config builder ───────────────────────────────────────────────────── */

/**
 * Build the consumer config object for llm-config-store.setConfig().
 *
 * Uses the full consumer-config shape (not the flat API shape) so that
 * deriveModelsFromConfig() injects apiKey and baseUrl into each model entry.
 * graph-runner.tryDirectLlmCall() then picks those up for direct browser calls.
 *
 * Returns null when no providers are configured.
 */
export function buildBrowserModelConfig() {
  const list = getBrowserProviders()
  if (list.length === 0) return null

  const activeKey = getBrowserActiveProvider() || list[0].key
  const config = { provider: activeKey }

  for (const p of list) {
    const baseUrl = extractHost(p.chatUrl, p.type) || undefined
    const models  = (p.cachedModels || []).map((id) => ({ id, label: id }))
    config[p.key] = {
      model:  models[0]?.id || '',
      models,
      type:   p.type,
      apiKey: p.apiKey  || undefined,
      baseUrl,
    }
  }
  return config
}
