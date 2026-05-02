import { config } from '../config.js'
import { listCustomProviders } from './customProvider.js'

type ChangeProviderBody = {
  provider?: string
  model?: string
  temperature?: number
}

/** Build a minimal provider config from the server's own environment (no upstream). */
function buildLocalProviderConfig(): Record<string, unknown> {
  const cfg: Record<string, unknown> = {}

  if (config.openaiKey) {
    cfg.openai = { model: 'gpt-4.1', baseUrl: 'https://api.openai.com' }
    cfg.provider = cfg.provider ?? 'openai'
  }
  if (config.anthropicKey) {
    cfg.anthropic = { model: 'claude-sonnet-4-5', baseUrl: 'https://api.anthropic.com' }
    cfg.provider = cfg.provider ?? 'anthropic'
  }
  if (!cfg.provider) {
    // No keys configured — return an empty config so the UI shows "no providers"
    // rather than crashing with 500.
    cfg.provider = ''
  }
  return cfg
}

export async function getAvailableProviders() {
  // Try the upstream convengine-demo first
  let cfg: Record<string, unknown> = {}
  try {
    const res = await fetch(`${config.convengineBase}/builder-studio/llm/providers`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) cfg = await res.json() as Record<string, unknown>
  } catch { /* upstream not running — fall through */ }

  // Fallback: build config from local env vars so the server never returns 500
  if (!Object.keys(cfg).length) cfg = buildLocalProviderConfig()

  // Merge in-memory custom providers (keys not already known to upstream)
  for (const p of listCustomProviders()) {
    if (p.key in cfg) continue
    const baseUrl = p.chatUrl
      ? p.chatUrl.replace(/\/(v1\/chat\/completions|v1\/messages|api\/chat)\/?$/, '')
      : undefined
    cfg[p.key] = {
      model: p.activeModel || p.cachedModels?.[0]?.id || p.key,
      baseUrl,
      apiKey: p.apiKey,
      type: p.type,
      models: p.cachedModels?.length
        ? p.cachedModels.map((m) => ({ id: m.id, label: m.label || m.id }))
        : undefined,
    }
  }

  return cfg
}

// In-memory active provider selection (survives for the server's lifetime)
let activeProvider: ChangeProviderBody = {}

export async function changeProvider(body: ChangeProviderBody) {
  // Persist locally regardless of upstream availability
  activeProvider = { ...activeProvider, ...body }

  // Best-effort proxy to convengine-demo — silently ignore if not running
  try {
    const res = await fetch(`${config.convengineBase}/builder-studio/llm/provider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) return await res.json() as Record<string, unknown>
  } catch { /* upstream not running */ }

  return { ok: true, ...activeProvider }
}