/**
 * Ported from sim/apps/sim/blocks/utils.ts (simplified).
 *
 * Helpers used across block configs — provider credential sub-blocks, model
 * options, and file-input normalization. Kept in sync with sim's surface but
 * stripped of server-side model registry dependencies.
 *
 * Model options are now consumer-driven via llm-config-store. When a consumer
 * config is set (e.g. from YAML), models come from that config. Otherwise,
 * built-in defaults are used.
 */
import { getConfiguredModelOptions, getConfiguredDefaultModel, getConfiguredDefaultProvider } from '../stores/llm-config-store'
import { getAiProviderOptions, getAiProviderModelOptions } from '../stores/ai-providers-store'

/**
 * Returns the list of models available in agent/router combobox.
 * When the node has its own "AI Provider" field set (values.provider), the
 * list comes straight from that provider's own model list in AI Provider
 * Settings — not from the execution-time custom_providers mirror, which can
 * lag behind (e.g. before a key/model edit has been re-synced). Falls back
 * to the globally active provider's models, or all models, when unset.
 * Mirrors sim's getModelOptions() shape: Array<{ label, id, group? }>.
 * @param {{ provider?: string }} [values] — current node subBlockValues
 */
export function getModelOptions(values) {
  const provider = values?.provider
  if (provider) {
    const own = getAiProviderModelOptions(provider)
    if (own.length > 0) return own
  }
  return getConfiguredModelOptions(provider)
}

/**
 * Returns the default model id — the user's chosen default in AI Provider
 * Settings, if set, otherwise the consumer-config default.
 */
export function getDefaultModel() {
  return getConfiguredDefaultModel()
}

/**
 * Returns the default provider id — same precedence as getDefaultModel().
 */
export function getDefaultProvider() {
  return getConfiguredDefaultProvider()
}

/**
 * Provider credential sub-blocks appended to agent/router blocks.
 * Mirrors sim's getProviderCredentialSubBlocks() return value.
 * API Key is intentionally omitted — auth is handled via the LLM Provider
 * settings (extension: Custom LLM Providers panel; web: same panel backed by localStorage).
 */
/** Returns available AI provider options for the agent block provider dropdown. */
export function getProviderOptions() {
  return getAiProviderOptions()
}

export function getProviderCredentialSubBlocks() {
  return []
}

export const PROVIDER_CREDENTIAL_INPUTS = {}

export const RESPONSE_FORMAT_WAND_CONFIG = {
  enabled: true,
  maintainHistory: true,
  prompt: `You generate a valid JSON Schema for a strict structured-output contract.
Return ONLY a JSON object with keys: name, schema, strict. No markdown.`,
  placeholder: 'Describe the output schema you want...',
  generationType: 'json-schema',
}

/**
 * Normalizes file inputs passed to tools.config.params.
 * Mirrors sim's normalizeFileInput from @/blocks/utils.
 * @param {unknown} input
 * @param {{single?: boolean}} [opts]
 */
export function normalizeFileInput(input, opts = {}) {
  if (input == null) return undefined
  const { single = false } = opts
  const arr = Array.isArray(input) ? input : [input]
  const cleaned = arr.filter((f) => f != null)
  if (cleaned.length === 0) return undefined
  return single ? cleaned[0] : cleaned
}
