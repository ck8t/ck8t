/**
 * Predefined AI provider list — ported from Daakia's ai-providers.ts.
 * Each provider has a stable id, display name, base URL, and predefined models.
 */

export const AI_PROVIDERS = [
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    baseUrl: 'vscode://copilot',
    models: [
      { id: 'auto', name: 'Auto (Copilot chooses)' },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-5.4', name: 'GPT 5.4' },
      { id: 'o4-mini', name: 'o4-mini' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 nano' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
      { id: 'o3-pro', name: 'o3 pro' },
      { id: 'o3', name: 'o3' },
      { id: 'o4-mini', name: 'o4-mini' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: [
      { id: 'llama3.3', name: 'Llama 3.3' },
      { id: 'llama3.1', name: 'Llama 3.1' },
      { id: 'deepseek-r1', name: 'DeepSeek R1' },
      { id: 'qwen2.5', name: 'Qwen 2.5' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'codellama', name: 'CodeLlama' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'compound-beta', name: 'Compound Beta' },
      { id: 'llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick' },
      { id: 'llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout' },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B' },
      { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2' },
    ],
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: [
      { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B' },
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B' },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large' },
      { id: 'mistral-small-latest', name: 'Mistral Small' },
      { id: 'codestral-latest', name: 'Codestral' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-3-mini', name: 'Grok 3 Mini' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    ],
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    baseUrl: '',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4o', name: 'GPT-4o' },
    ],
  },
]

/** IDs of providers that never need an API key */
export const NO_KEY_PROVIDERS = new Set(['copilot', 'ollama'])

/** Map provider id → custom-provider adapter type */
export const PROVIDER_TYPE_MAP = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'gemini',
  ollama: 'ollama',
  groq: 'openai',
  together: 'openai',
  mistral: 'openai',
  xai: 'grok',
  deepseek: 'deepseek',
  'azure-openai': 'openai',
}

/** Map provider id → chat endpoint path relative to baseUrl */
export const PROVIDER_CHAT_PATH = {
  anthropic: '/messages',
  google: '/openai/chat/completions',
  ollama: '/api/chat',
  default: '/chat/completions',
}
