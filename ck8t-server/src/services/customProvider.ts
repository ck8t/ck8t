/** In-memory store for custom LLM providers (no convengine-demo dependency). */

export interface CustomProvider {
  key: string
  name: string
  type?: string
  chatUrl?: string
  modelsUrl?: string
  apiKey?: string
  headers?: Record<string, string>
  activeModel?: string
  cachedModels?: Array<{ id: string; label: string }>
}

const store = new Map<string, CustomProvider>()

export function listCustomProviders(): CustomProvider[] {
  return Array.from(store.values())
}

export function saveCustomProvider(cfg: Partial<CustomProvider> & { name: string }): CustomProvider {
  const key = (cfg.key || cfg.name.trim().toLowerCase().replace(/\s+/g, '_')) as string
  const existing = store.get(key) || {}
  const entry: CustomProvider = { ...existing, ...cfg, key }
  store.set(key, entry)
  return entry
}

export function deleteCustomProvider(key: string): boolean {
  return store.delete(key)
}

function parseModelsResponse(data: Record<string, unknown>): Array<{ id: string; label: string }> {
  const models = data.models as Array<Record<string, string>> | undefined
  const dataArr = data.data as Array<Record<string, string>> | undefined
  if (models?.length) return models.map((m) => ({ id: m.name || m.id, label: m.name || m.id }))
  if (dataArr?.length) return dataArr.map((m) => ({ id: m.id, label: m.id }))
  return []
}

export async function refreshCustomProviderModels(
  key: string,
): Promise<Array<{ id: string; label: string }>> {
  const p = store.get(key)
  if (!p || !p.modelsUrl) throw new Error(`Provider '${key}' not found or has no modelsUrl`)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (p.type === 'anthropic') {
    if (p.apiKey) headers['x-api-key'] = p.apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (p.apiKey) {
    headers['Authorization'] = `Bearer ${p.apiKey}`
  }
  // Merge any user-supplied extra headers
  if (p.headers) Object.assign(headers, p.headers)

  const res = await fetch(p.modelsUrl, { headers, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Models fetch failed (${res.status}): ${await res.text()}`)

  const models = parseModelsResponse(await res.json() as Record<string, unknown>)

  // Persist the cached list and set activeModel if not already chosen
  store.set(key, {
    ...p,
    cachedModels: models,
    activeModel: p.activeModel || models[0]?.id,
  })

  return models
}
