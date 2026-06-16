/**
 * Zustand store for AI provider configuration.
 * Seeds from static AI_PROVIDERS list; overrides loaded from bridge.
 * API key storage uses VS Code SecretStorage via postMessage (Daakia pattern).
 */
import { create } from 'zustand'
import { AI_PROVIDERS } from '../ai/ai-providers'
import {
  fetchAiProviders,
  putAiProvider,
  setAiProviderDefault,
} from '../api/ai-providers-client'

function postMsg(msg) {
  const api = typeof window !== 'undefined' ? window.__CK8T_VSCODE_API__ : null
  if (api) api.postMessage(msg)
}

function mergeWithStatic(configs, keyProviderIds, defaultProviderId, defaultModelId) {
  const configMap = {}
  for (const c of configs) configMap[c.id] = c
  const keySet = new Set(keyProviderIds || [])

  return AI_PROVIDERS.map((p) => {
    const override = configMap[p.id] || {}
    return {
      id:      p.id,
      name:    override.name    ?? p.name,
      baseUrl: override.baseUrl ?? p.baseUrl,
      enabled: override.enabled ?? true,
      models:  (override.models ?? p.models).map((m) => ({
        id:      m.id,
        name:    m.name,
        enabled: m.enabled ?? true,
      })),
      hasKey: keySet.has(p.id),
    }
  })
}

export const useAiProvidersStore = create((set, get) => ({
  providers: AI_PROVIDERS.map((p) => ({
    id:      p.id,
    name:    p.name,
    baseUrl: p.baseUrl,
    enabled: true,
    models:  p.models.map((m) => ({ id: m.id, name: m.name, enabled: true })),
    hasKey:  false,
  })),
  defaultProviderId: null,
  defaultModelId:    null,
  loaded:            false,

  /** Load overrides from bridge + merge with static defaults */
  load: async () => {
    const data = await fetchAiProviders()
    if (!data) { set({ loaded: true }); return }
    const merged = mergeWithStatic(
      data.configs ?? [],
      data.keyProviderIds ?? [],
      data.defaultProviderId,
      data.defaultModelId,
    )
    set({
      providers:         merged,
      defaultProviderId: data.defaultProviderId ?? null,
      defaultModelId:    data.defaultModelId    ?? null,
      loaded:            true,
    })
  },

  /** Receive key status from extension (SecretStorage) via postMessage */
  setKeyStatus: (status) => {
    set((s) => ({
      providers: s.providers.map((p) => ({
        ...p,
        hasKey: p.id in status ? !!status[p.id] : p.hasKey,
      })),
    }))
  },

  /** Request key status refresh from extension via postMessage */
  loadKeys: () => {
    postMsg({ type: 'aiKeys:load' })
  },

  hasKey: (id) => {
    return get().providers.find((p) => p.id === id)?.hasKey ?? false
  },

  toggleProvider: (id) => {
    set((s) => {
      const providers = s.providers.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      )
      const p = providers.find((p) => p.id === id)
      putAiProvider(id, { enabled: p.enabled })
      return { providers }
    })
  },

  updateProvider: (id, updates) => {
    set((s) => {
      const providers = s.providers.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      )
      putAiProvider(id, updates)
      return { providers }
    })
  },

  addProvider: (provider) => {
    set((s) => {
      const exists = s.providers.some((p) => p.id === provider.id)
      if (exists) {
        return {
          providers: s.providers.map((p) =>
            p.id === provider.id ? { ...p, ...provider } : p
          ),
        }
      }
      putAiProvider(provider.id, provider)
      return { providers: [...s.providers, { hasKey: false, ...provider }] }
    })
  },

  removeProvider: (id) => {
    set((s) => ({
      providers: s.providers.filter((p) => p.id !== id),
    }))
    putAiProvider(id, { removed: true })
  },

  toggleModel: (providerId, modelId) => {
    set((s) => {
      const providers = s.providers.map((p) => {
        if (p.id !== providerId) return p
        const models = p.models.map((m) =>
          m.id === modelId ? { ...m, enabled: !m.enabled } : m
        )
        putAiProvider(providerId, { models })
        return { ...p, models }
      })
      return { providers }
    })
  },

  updateModel: (providerId, modelId, updates) => {
    set((s) => {
      const providers = s.providers.map((p) => {
        if (p.id !== providerId) return p
        const models = p.models.map((m) =>
          m.id === modelId ? { ...m, ...updates } : m
        )
        putAiProvider(providerId, { models })
        return { ...p, models }
      })
      return { providers }
    })
  },

  addModel: (providerId, model) => {
    set((s) => {
      const providers = s.providers.map((p) => {
        if (p.id !== providerId) return p
        const models = [...p.models, { enabled: true, ...model }]
        putAiProvider(providerId, { models })
        return { ...p, models }
      })
      return { providers }
    })
  },

  removeModel: (providerId, modelId) => {
    set((s) => {
      const providers = s.providers.map((p) => {
        if (p.id !== providerId) return p
        const models = p.models.filter((m) => m.id !== modelId)
        putAiProvider(providerId, { models })
        return { ...p, models }
      })
      return { providers }
    })
  },

  setDefaultProvider: (providerId, modelId) => {
    set({ defaultProviderId: providerId, defaultModelId: modelId })
    setAiProviderDefault(providerId, modelId)
  },

  saveKey: (id, key) => {
    const p = get().providers.find((prov) => prov.id === id)
    // Send to extension for SecretStorage + SQLite routing sync
    postMsg({ type: 'aiKeys:save', providerId: id, token: key, name: p?.name, baseUrl: p?.baseUrl })
    // Optimistic UI update
    set((s) => ({
      providers: s.providers.map((p) =>
        p.id === id ? { ...p, hasKey: true } : p
      ),
    }))
  },

  deleteKey: (id) => {
    postMsg({ type: 'aiKeys:delete', providerId: id })
    // Optimistic UI update
    set((s) => ({
      providers: s.providers.map((p) =>
        p.id === id ? { ...p, hasKey: false } : p
      ),
    }))
  },

  seedDefaults: () => {
    const providers = AI_PROVIDERS.map((p) => ({
      id:      p.id,
      name:    p.name,
      baseUrl: p.baseUrl,
      enabled: true,
      models:  p.models.map((m) => ({ id: m.id, name: m.name, enabled: true })),
      hasKey:  false,
    }))
    set({ providers, defaultProviderId: null, defaultModelId: null })
    // Persist reset to bridge
    for (const p of providers) {
      putAiProvider(p.id, { enabled: true, name: p.name, baseUrl: p.baseUrl, models: p.models })
    }
  },
}))

/** Returns provider options for agent block provider dropdown */
export function getAiProviderOptions() {
  const providers = useAiProvidersStore.getState().providers
  return [
    { id: '', label: 'Use default provider' },
    ...providers
      .filter((p) => p.enabled)
      .map((p) => ({ id: p.id, label: p.name })),
  ]
}

/**
 * Returns the enabled models for a single provider, in combobox shape.
 * This reads straight from the same store the AI Providers settings panel
 * displays — it does NOT depend on the custom_providers/cachedModels mirror
 * the extension syncs for execution, so the dropdown always matches what the
 * user actually configured even if that sync hasn't run yet.
 */
export function getAiProviderModelOptions(providerId) {
  if (!providerId) return []
  const provider = useAiProvidersStore.getState().providers.find((p) => p.id === providerId)
  if (!provider) return []
  return provider.models
    .filter((m) => m.enabled !== false)
    .map((m) => ({ id: m.id, label: m.name || m.id, provider: providerId, group: provider.name }))
}
