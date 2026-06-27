/**
 * AI Providers bridge route — predefined provider configs + API key management.
 *
 * Storage:
 *   ai_provider_configs   — SQLite: per-provider overrides (enabled, models, name, baseUrl)
 *   ai_provider_keys      — SQLite: presence marker only ({ id }) — the actual key never
 *                            touches the DB, it lives in VS Code SecretStorage (OS keychain)
 *   ai_provider_default   — SQLite: single record: { providerId, modelId }
 *
 * When an API key is saved, the provider is also mirrored into custom_providers
 * so that callAgent() can route to it via the existing adapter pipeline.
 */
import { Router, Request, Response } from 'express';
import { upsert, findById, remove, findAll } from '../../storage/db';
import { saveCustomProvider, deleteCustomProvider } from '../../services/custom-providers';
import { storeApiKey, retrieveApiKey, deleteApiKey } from '../../services/secret-store';
import { setActiveCustomProvider, setActiveFamily } from '../../services/llm';

const CONFIG_COL   = 'ai_provider_configs';
const KEYS_COL     = 'ai_provider_keys';
const DEFAULT_COL  = 'ai_provider_default';
const DEFAULT_ID   = 'default';

// Map from new AI provider id → custom-provider adapter type
const PROVIDER_TYPE_MAP: Record<string, string> = {
  openai:        'openai',
  anthropic:     'anthropic',
  google:        'gemini',
  ollama:        'ollama',
  groq:          'openai',
  together:      'openai',
  mistral:       'openai',
  xai:           'grok',
  deepseek:      'deepseek',
  'azure-openai':'openai',
};

// Chat endpoint path relative to baseUrl
const CHAT_PATH: Record<string, string> = {
  anthropic: '/messages',
  google:    '/openai/chat/completions',
  ollama:    '/api/chat',
};

// Models endpoint path relative to baseUrl
const MODELS_PATH: Record<string, string> = {
  anthropic: '/models',
  google:    '/openai/models',
  ollama:    '/api/tags',
};

function getChatUrl(baseUrl: string, providerId: string): string {
  if (!baseUrl) return '';
  const path = CHAT_PATH[providerId] ?? '/chat/completions';
  return baseUrl.replace(/\/$/, '') + path;
}

function getModelsUrl(baseUrl: string, providerId: string): string {
  if (!baseUrl) return '';
  const path = MODELS_PATH[providerId] ?? '/models';
  return baseUrl.replace(/\/$/, '') + path;
}

interface AiProviderModel { id: string; name?: string; enabled?: boolean }

/**
 * Mirror an AI Provider Settings entry into custom_providers so callAgent()
 * can route to it. `models` must be the user-curated list from
 * ai_provider_configs (NOT a live API fetch) — those are the exact ids the
 * Agent block's Model field shows and sends, so cachedModels has to match
 * them or every model lookup downstream silently fails to resolve.
 */
export async function syncToCustomProviders(
  providerId: string,
  name: string,
  baseUrl: string,
  apiKey: string | null,
  models?: AiProviderModel[],
) {
  if (providerId === 'copilot') return; // Copilot never goes through custom providers
  const type = PROVIDER_TYPE_MAP[providerId] || 'openai';
  const chatUrl = getChatUrl(baseUrl, providerId);
  const modelsUrl = getModelsUrl(baseUrl, providerId);
  if (!chatUrl) return; // no baseUrl configured yet
  const cachedModels = (models ?? [])
    .filter((m) => m.enabled !== false && m.id)
    .map((m) => ({ id: m.id, label: m.name || m.id, group: name, family: m.id }));
  await saveCustomProvider({
    key: providerId,
    name,
    type,
    chatUrl,
    modelsUrl,
    apiKey: apiKey ?? undefined,
    ...(cachedModels.length > 0 ? { cachedModels } : {}),
  });
}

/**
 * Re-sync every provider that already has a key stored into custom_providers,
 * using its current ai_provider_configs.models list. Needed once on activation
 * to backfill records created before cachedModels syncing existed — without
 * this, providers configured before this fix keep an empty/stale model list
 * until the user happens to re-save the key or edit a model.
 */
export async function resyncAllCustomProviders(): Promise<void> {
  const keyRecords = findAll<{ id: string }>(KEYS_COL);
  for (const { id } of keyRecords) {
    if (id === 'copilot') continue;
    const apiKey = await retrieveApiKey(id);
    if (!apiKey) continue;
    const cfg = findById<{ name?: string; baseUrl?: string; models?: AiProviderModel[] }>(CONFIG_COL, id);
    if (!cfg?.baseUrl) continue;
    await syncToCustomProviders(id, cfg.name || id, cfg.baseUrl, apiKey, cfg.models);
  }
}

export function aiProvidersRouter() {
  const router = Router();

  /** GET /ck8t/ai-providers — return configs + key status + default */
  router.get('/ck8t/ai-providers', (_req: Request, res: Response) => {
    try {
      const configs = findAll<{ id: string; enabled: boolean; name: string; baseUrl: string; models: unknown[] }>(CONFIG_COL);
      const keys = findAll<{ id: string }>(KEYS_COL).map(k => k.id);
      const def = findById<{ providerId: string; modelId: string }>(DEFAULT_COL, DEFAULT_ID);
      res.json({
        configs,
        keyProviderIds: keys,
        defaultProviderId: def?.providerId ?? null,
        defaultModelId: def?.modelId ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** PUT /ck8t/ai-providers/:id — save provider config override */
  router.put('/ck8t/ai-providers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as { enabled?: boolean; name?: string; baseUrl?: string; models?: AiProviderModel[] };
      const existing = findById<Record<string, unknown>>(CONFIG_COL, id) ?? {};
      const merged = { ...existing, id, ...body };
      upsert(CONFIG_COL, id, merged);

      // Re-sync to custom_providers whenever baseUrl or the model list changes
      // (a key already present is required — without one there's nothing to call).
      const apiKey = await retrieveApiKey(id);
      if (apiKey && (body.baseUrl || body.models)) {
        const name = (body.name ?? (existing.name as string)) || id;
        const resolvedBaseUrl = body.baseUrl ?? (existing.baseUrl as string) ?? '';
        const resolvedModels = body.models ?? (existing.models as AiProviderModel[]);
        await syncToCustomProviders(id, name, resolvedBaseUrl, apiKey, resolvedModels);
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** POST /ck8t/ai-providers/keys/:id — save API key (OS keychain, not the DB) */
  router.post('/ck8t/ai-providers/keys/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { key, name, baseUrl } = req.body as { key: string; name?: string; baseUrl?: string };
      if (!key?.trim()) return res.status(400).json({ error: 'key is required' });
      await storeApiKey(id, key.trim());
      upsert(KEYS_COL, id, { id }); // presence marker only — no key material

      // Mirror to custom_providers so callAgent can route via existing pipeline
      const cfg = findById<{ name?: string; baseUrl?: string; models?: AiProviderModel[] }>(CONFIG_COL, id);
      const resolvedName = name ?? cfg?.name ?? id;
      const resolvedBaseUrl = baseUrl ?? cfg?.baseUrl ?? '';
      await syncToCustomProviders(id, resolvedName, resolvedBaseUrl, key.trim(), cfg?.models);

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** DELETE /ck8t/ai-providers/keys/:id — remove API key */
  router.delete('/ck8t/ai-providers/keys/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deleteApiKey(id);
      remove(KEYS_COL, id);
      // Remove from custom_providers unless it's ollama (no key needed)
      const noKeyProviders = new Set(['ollama']);
      if (!noKeyProviders.has(id)) {
        try { await deleteCustomProvider(id); } catch { /* ok */ }
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** POST /ck8t/ai-providers/default — set default provider + model */
  router.post('/ck8t/ai-providers/default', (req: Request, res: Response) => {
    try {
      const { providerId, modelId } = req.body as { providerId: string; modelId: string };
      if (!providerId) return res.status(400).json({ error: 'providerId is required' });
      upsert(DEFAULT_COL, DEFAULT_ID, { providerId, modelId: modelId ?? '' });

      // Route to copilot or custom provider depending on provider id,
      // and persist to llm_prefs so loadActiveFamilyFromDb() restores it on restart
      if (providerId === 'copilot') {
        setActiveFamily(modelId ?? '');
        setActiveCustomProvider(null);
        upsert('llm_prefs', 'activeFamily', { family: modelId ?? '' });
        upsert('llm_prefs', 'activeCustomProvider', { key: '' });
      } else {
        setActiveCustomProvider(providerId);
        upsert('llm_prefs', 'activeCustomProvider', { key: providerId });
      }

      res.json({ ok: true, providerId, modelId });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** GET /ck8t/ai-providers/default — get current default */
  router.get('/ck8t/ai-providers/default', (_req: Request, res: Response) => {
    try {
      const def = findById<{ providerId: string; modelId: string }>(DEFAULT_COL, DEFAULT_ID);
      res.json({ providerId: def?.providerId ?? null, modelId: def?.modelId ?? null });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
