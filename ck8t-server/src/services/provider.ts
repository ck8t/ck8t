import { config } from '../config.js'
import { listCustomProviders, refreshCustomProviderModels } from './customProvider.js'

type ChangeProviderBody = {
  provider?: string
  model?: string
  temperature?: number
}

type ModelOption = { id: string; label: string }

function parseModelIds(payload: unknown): ModelOption[] {
  const data = payload as { data?: Array<{ id?: string; name?: string }>; models?: Array<{ id?: string; name?: string }> }
  if (Array.isArray(data.models)) {
    return data.models.map((m) => m?.name || m?.id).filter((id): id is string => Boolean(id)).map((id) => ({ id, label: id }))
  }
  if (Array.isArray(data.data)) {
    return data.data.map((m) => m?.id || m?.name).filter((id): id is string => Boolean(id)).map((id) => ({ id, label: id }))
  }
  return []
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelOption[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`OpenAI models API failed (${res.status})`)
  return parseModelIds(await res.json())
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelOption[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Anthropic models API failed (${res.status})`)
  return parseModelIds(await res.json())
}

export async function getAvailableProviders(): Promise<Record<string, unknown>> {
  const cfg: Record<string, unknown> = {}

  if (config.openaiKey) {
    try {
      const models = await fetchOpenAIModels(config.openaiKey)
      if (models.length) {
        cfg.openai = { model: models[0].id, models, baseUrl: 'https://api.openai.com', type: 'openai' }
        cfg.provider = cfg.provider ?? 'openai'
      }
    } catch { /* key invalid or offline */ }
  }

  if (config.anthropicKey) {
    try {
      const models = await fetchAnthropicModels(config.anthropicKey)
      if (models.length) {
        cfg.anthropic = { model: models[0].id, models, baseUrl: 'https://api.anthropic.com', type: 'anthropic' }
        cfg.provider = cfg.provider ?? 'anthropic'
      }
    } catch { /* key invalid or offline */ }
  }

  for (const p of listCustomProviders()) {
    if (p.key in cfg) continue
    let liveModels: ModelOption[] = []
    try {
      const refreshed = await refreshCustomProviderModels(p.key)
      liveModels = refreshed.map((m) => ({ id: m.id, label: m.label || m.id }))
    } catch { liveModels = [] }

    let baseUrl: string | undefined
    if (p.chatUrl) {
      try { baseUrl = new URL(p.chatUrl).origin }
      catch { baseUrl = p.chatUrl.replace(/\/(v1\/chat\/completions|v1beta\/openai\/chat\/completions|compatible-mode\/v1\/chat\/completions|v1\/messages|api\/chat)\/?$/, '') }
    }

    const activeModel = p.activeModel && liveModels.some((m) => m.id === p.activeModel)
      ? p.activeModel : liveModels[0]?.id || ''

    cfg[p.key] = { model: activeModel, baseUrl, apiKey: p.apiKey, type: p.type, models: liveModels }
    if (!cfg.provider && activeModel) cfg.provider = p.key
  }

  if (!cfg.provider) cfg.provider = ''
  return cfg
}

let activeProvider: ChangeProviderBody = {}

export function changeProvider(body: ChangeProviderBody): Record<string, unknown> {
  activeProvider = { ...activeProvider, ...body }
  return { ok: true, ...activeProvider }
}
