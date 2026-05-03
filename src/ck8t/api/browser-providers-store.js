/**
 * Browser-mode provider Zustand store with AES-GCM encrypted localStorage persistence.
 *
 * API keys are encrypted with a PBKDF2-derived AES-256-GCM key before being
 * written to localStorage, so the raw key is never visible in storage.
 * The same deterministic key derivation is used on every page load to decrypt.
 *
 * Usage (React):
 *   const { providers, saveProvider, deleteProvider } = useBrowserProvidersStore()
 *
 * Usage (non-React, e.g. API client):
 *   const s = useBrowserProvidersStore.getState()
 *   await s.hydrate()
 *   s.buildModelConfig()
 */

import { create } from 'zustand'

/* ── Path helpers ────────────────────────────────────────────────────── */

const TYPE_PATHS = {
  openai:    ['/v1/chat/completions',                 '/v1/models'],
  anthropic: ['/v1/messages',                         '/v1/models'],
  gemini:    ['/v1beta/openai/chat/completions',       '/v1beta/openai/models'],
  qwen:      ['/compatible-mode/v1/chat/completions',  '/compatible-mode/v1/models'],
  lmstudio:  ['/v1/chat/completions',                 '/v1/models'],
  ollama:    ['/api/chat',                             '/api/tags'],
  // grok / mistral / deepseek all use /v1/chat/completions — falls back to openai paths
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

/* ── WebCrypto — AES-GCM with PBKDF2 key derivation ─────────────────── */

const STORAGE_KEY = 'ck8t/browser-providers-v2'
let _cryptoKey = null

async function getCryptoKey() {
  if (_cryptoKey) return _cryptoKey
  const raw  = new TextEncoder().encode('ck8t-browser-secure-v1')
  const salt = new TextEncoder().encode('ck8t-providers')
  const base = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey'])
  _cryptoKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return _cryptoKey
}

function toBase64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))) }
function fromBase64(b64) { return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }

async function encryptJson(obj) {
  const key = await getCryptoKey()
  const iv  = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder().encode(JSON.stringify(obj))
  const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc)
  return toBase64(iv) + '.' + toBase64(ct)
}

async function decryptJson(blob) {
  try {
    const [ivB64, ctB64] = blob.split('.')
    const iv  = fromBase64(ivB64)
    const ct  = fromBase64(ctB64)
    const key = await getCryptoKey()
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return JSON.parse(new TextDecoder().decode(dec))
  } catch { return null }
}

/* ── Encrypted localStorage persistence ──────────────────────────────── */

async function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { providers: [], activeKey: null }
    const data = await decryptJson(raw)
    return data || { providers: [], activeKey: null }
  } catch { return { providers: [], activeKey: null } }
}

async function persistToStorage({ providers, activeKey }) {
  try {
    const enc = await encryptJson({ providers, activeKey })
    localStorage.setItem(STORAGE_KEY, enc)
  } catch { /* sandboxed environment */ }
}

/* ── Model fetching ───────────────────────────────────────────────────── */

/**
 * Fetch models live from the provider's modelsUrl — no static lists.
 *
 * Header strategy mirrors ck8t-server/customProvider.ts and the extension adapters:
 *   anthropic → x-api-key + anthropic-version (+ browser-access flag for direct calls)
 *   ollama    → optional Bearer; response shape: { models: [{name}] }
 *   others    → optional Bearer Authorization; response shape: { data: [{id}] }
 *
 * Anthropic also uses { data: [{id, display_name}] } — same outer shape as OpenAI.
 */
async function fetchProviderModels(provider) {
  if (!provider.modelsUrl) throw new Error('Provider has no models URL configured')

  const headers = { ...(provider.headers || {}) }

  if (provider.type === 'anthropic') {
    if (provider.apiKey) headers['x-api-key'] = provider.apiKey
    headers['anthropic-version'] = '2023-06-01'
    // Required for direct browser-to-Anthropic calls (same as graph-runner.js)
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  } else if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const res = await fetch(provider.modelsUrl, { headers })
  if (!res.ok) throw new Error(`Failed to fetch models (${res.status}): ${await res.text()}`)
  const data = await res.json()

  // Ollama: { models: [{name}] }
  if (provider.type === 'ollama' && Array.isArray(data.models)) {
    return data.models.map((m) => m.name).filter(Boolean)
  }

  // OpenAI / Anthropic / LM Studio / custom: { data: [{id, display_name?}] }
  if (Array.isArray(data.data)) {
    return data.data.map((m) => m.id).filter(Boolean)
  }

  throw new Error('Unrecognised models response shape — expected { data: [...] } or { models: [...] }')
}

/* ── Zustand store ───────────────────────────────────────────────────── */

export const useBrowserProvidersStore = create((set, get) => ({
  providers: [],
  activeKey: null,
  hydrated:  false,

  /** Load encrypted state from localStorage into memory. Idempotent. */
  async hydrate() {
    if (get().hydrated) return
    const stored = await loadFromStorage()
    set({ providers: stored.providers || [], activeKey: stored.activeKey || null, hydrated: true })
  },

  /**
   * Create or update a custom provider.
   * @param {Object} cfg  { name, type, chatUrl, modelsUrl, apiKey?, headers?, key? }
   */
  async saveProvider(cfg) {
    await get().hydrate()
    const { providers } = get()
    const key      = cfg.key || toSlug(cfg.name)
    const existing = providers.find((p) => p.key === key)

    const entry = {
      ...(existing || {}),
      key,
      name:      cfg.name,
      type:      cfg.type || 'openai',
      chatUrl:   cfg.chatUrl   || '',
      modelsUrl: cfg.modelsUrl || '',
      headers:   cfg.headers   || {},
      // Keep existing apiKey when field left blank (edit flow)
      ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
    }

    const newList = existing
      ? providers.map((p) => (p.key === key ? entry : p))
      : [...providers, entry]
    set({ providers: newList })
    await persistToStorage(get())

    // Auto-fetch models after save (mirrors ck8t-server behaviour)
    if (cfg.modelsUrl || cfg.type === 'anthropic') {
      try { await get().refreshModels(key) } catch { /* ignore */ }
    }
    return entry
  },

  /** Remove a provider and all its cached data. */
  async deleteProvider(key) {
    await get().hydrate()
    const { providers, activeKey } = get()
    const newList   = providers.filter((p) => p.key !== key)
    const newActive = activeKey === key ? (newList[0]?.key || null) : activeKey
    set({ providers: newList, activeKey: newActive })
    await persistToStorage(get())
  },

  /** Fetch latest model list from the provider's modelsUrl and cache it. */
  async refreshModels(key) {
    await get().hydrate()
    const { providers } = get()
    const provider = providers.find((p) => p.key === key)
    if (!provider) throw new Error('Provider not found')

    const models  = await fetchProviderModels(provider)
    const updated = providers.map((p) => (p.key === key ? { ...p, cachedModels: models } : p))
    set({ providers: updated })
    await persistToStorage(get())
    return models
  },

  /** Change the active provider key. */
  async setActive(key) {
    await get().hydrate()
    set({ activeKey: key })
    await persistToStorage(get())
  },

  /**
   * Build the consumer config shape for llm-config-store.setConfig().
   * Each provider entry includes apiKey + baseUrl so that
   * graph-runner.tryDirectLlmCall() can make direct browser LLM calls.
   *
   * Returns null when no providers are configured.
   */
  buildModelConfig() {
    const { providers, activeKey } = get()
    if (providers.length === 0) return null

    const activePk = activeKey || providers[0]?.key
    const config   = { provider: activePk }

    for (const p of providers) {
      const baseUrl = extractHost(p.chatUrl, p.type) || undefined
      const models  = (p.cachedModels || []).map((id) => ({ id, label: id }))
      config[p.key] = {
        model:   models[0]?.id || '',
        models,
        type:    p.type,
        apiKey:  p.apiKey   || undefined,
        baseUrl,
        chatUrl: p.chatUrl  || undefined,
      }
    }
    return config
  },
}))
