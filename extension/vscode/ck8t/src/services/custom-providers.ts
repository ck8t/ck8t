/**
 * Custom provider registry — persists user-defined LLM providers in SQLite,
 * fetches their model lists, and creates LlmClient instances for graph execution.
 */
import { findAll, upsert, remove } from '../storage/db';
import type { CustomProviderConfig, ModelInfo, CustomLlmClient } from './adapters/types';
import { fetchOpenAiModels, createOpenAiClient } from './adapters/openai';
import { fetchAnthropicModels, createAnthropicClient } from './adapters/anthropic';
import { fetchLmStudioModels, createLmStudioClient } from './adapters/lmstudio';
import { fetchOllamaModels, createOllamaClient } from './adapters/ollama';
import { storeApiKey, retrieveApiKey, deleteApiKey } from './secret-store';

export type { CustomProviderConfig, ModelInfo };

const COLLECTION = 'custom_providers';

/* ── CRUD ─────────────────────────────────────────────────────────── */

/** DB records never contain apiKey — use getCustomProviderWithKey() when the actual key is needed. */
export function getAllCustomProviders(): CustomProviderConfig[] {
  return findAll<CustomProviderConfig>(COLLECTION);
}

/** Merge the persisted (keyless) config with its OS-keychain-backed API key. */
export async function getCustomProviderWithKey(key: string): Promise<CustomProviderConfig | undefined> {
  const cfg = getAllCustomProviders().find((p) => p.key === key);
  if (!cfg) return undefined;
  const apiKey = await retrieveApiKey(key);
  return { ...cfg, apiKey };
}

/** Persists apiKey to SecretStorage (OS keychain) and the rest of the config to SQLite — never both in the same place. */
export async function saveCustomProvider(cfg: CustomProviderConfig): Promise<CustomProviderConfig> {
  const { apiKey, ...rest } = cfg;
  if (apiKey) await storeApiKey(cfg.key, apiKey);
  const saved = upsert(COLLECTION, cfg.key, rest as CustomProviderConfig);
  return { ...saved, apiKey };
}

export async function deleteCustomProvider(key: string): Promise<void> {
  remove(COLLECTION, key);
  await deleteApiKey(key);
}

/* ── Model fetching ───────────────────────────────────────────────── */

/**
 * Fetch models live from the provider's modelsUrl.
 * Updates the cached model list on the stored provider record.
 */
export async function fetchAndCacheModels(key: string): Promise<ModelInfo[]> {
  const cfg = await getCustomProviderWithKey(key);
  if (!cfg) throw new Error(`Custom provider not found: ${key}`);

  const models = await fetchModelsFromConfig(cfg);

  // Update cache in DB — strip apiKey again, it must never reach bs_store
  const { apiKey, ...rest } = cfg;
  upsert(COLLECTION, key, { ...rest, cachedModels: models } as CustomProviderConfig);

  return models;
}

async function fetchModelsFromConfig(cfg: CustomProviderConfig): Promise<ModelInfo[]> {
  switch (cfg.type) {
    case 'openai':
    case 'deepseek':
    case 'grok':
    case 'mistral':
    case 'gemini':
    case 'qwen':
      return fetchOpenAiModels(cfg);
    case 'anthropic': return fetchAnthropicModels(cfg);
    case 'lmstudio':  return fetchLmStudioModels(cfg);
    case 'ollama':    return fetchOllamaModels(cfg);
    default:
      // Treat any unknown type as OpenAI-compatible
      return fetchOpenAiModels(cfg);
  }
}

/* ── Client factory ───────────────────────────────────────────────── */

export async function createCustomProviderClient(key: string): Promise<CustomLlmClient> {
  const cfg = await getCustomProviderWithKey(key);
  if (!cfg) throw new Error(`Custom provider not found: ${key}`);

  switch (cfg.type) {
    case 'openai':
    case 'deepseek':
    case 'grok':
    case 'mistral':
    case 'gemini':
    case 'qwen':
      return createOpenAiClient(cfg);
    case 'anthropic': return createAnthropicClient(cfg);
    case 'lmstudio':  return createLmStudioClient(cfg);
    case 'ollama':    return createOllamaClient(cfg);
    default:
      // Treat any unknown type as OpenAI-compatible
      return createOpenAiClient(cfg);
  }
}

/**
 * Given a model id, find which custom provider owns it
 * (by checking activeModel or cachedModels).
 */
export function resolveCustomProviderForModel(modelId: string): CustomProviderConfig | undefined {
  const providers = getAllCustomProviders();
  // Exact activeModel match first
  const byActive = providers.find((p) => p.activeModel === modelId);
  if (byActive) return byActive;
  // Cached model list fallback
  return providers.find((p) =>
    (p.cachedModels ?? []).some((m) => m.id === modelId)
  );
}

/**
 * Build the provider section for getAvailableProviders() response.
 * Uses cachedModels (fast, no network); returns empty models if not yet fetched.
 */
export function buildCustomProviderSection(
  cfg: CustomProviderConfig,
): Record<string, unknown> {
  const cachedModels = cfg.cachedModels ?? [];
  // Deduplicate by id before sending to the webview
  const seen = new Set<string>();
  const models = cachedModels.reduce<{ id: string; label: string; group: string; family: string }[]>((acc, m) => {
    if (!m.id || seen.has(m.id)) return acc;
    seen.add(m.id);
    acc.push({ id: m.id, label: m.label, group: cfg.name, family: m.family });
    return acc;
  }, []);

  return {
    name: cfg.name,
    provider: cfg.key,
    type: cfg.type,
    model: cfg.activeModel ?? models[0]?.id ?? '',
    models,
    // chatUrl is kept server-side; not exposed to the webview
  };
}
