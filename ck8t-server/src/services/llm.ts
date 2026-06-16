/**
 * LLM service — calls providers directly, no external dependency.
 *
 * Priority order:
 *  1. User-registered custom provider (LM Studio, Ollama, any OpenAI-compatible endpoint)
 *  2. Direct Anthropic (ANTHROPIC_API_KEY)
 *  3. Direct OpenAI (OPENAI_API_KEY)
 */
import { config } from '../config.js'
import { listCustomProviders } from './customProvider.js'
import type { AgentRequest, AgentResponse } from '../types/index.js'

export async function callAgent(req: AgentRequest): Promise<AgentResponse> {
  const model = req.agent.model || ''
  const providerKey = req.agent.provider || ''

  // ── 1. Custom provider ────────────────────────────────────────────────────
  const customProviders = listCustomProviders()
  const customProvider =
    customProviders.find((p) => p.key === providerKey) ||
    customProviders.find((p) =>
      p.activeModel === model ||
      (p.cachedModels ?? []).some((m) => m.id === model)
    )
  if (customProvider?.chatUrl) return callCustomProvider(req, customProvider)

  // ── 2. Direct Anthropic ───────────────────────────────────────────────────
  if (config.anthropicKey && model.startsWith('claude-')) return callAnthropic(req, model)

  // ── 3. Direct OpenAI ─────────────────────────────────────────────────────
  if (config.openaiKey) return callOpenAI(req, model)

  throw new Error(
    'No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY, ' +
    'or register a custom provider in Settings → LLM Provider Configuration.'
  )
}

/* ── Custom provider (OpenAI-compatible or Anthropic) ─────────────────────── */

async function callCustomProvider(
  req: AgentRequest,
  p: { chatUrl?: string; apiKey?: string; type?: string; headers?: Record<string, string> },
): Promise<AgentResponse> {
  const t0 = Date.now()
  const model = req.agent.model || ''
  const chatUrl = p.chatUrl!

  if (p.type === 'anthropic') {
    const body: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: req.agent.userPrompt || req.input }],
    }
    if (req.agent.systemPrompt) body.system = req.agent.systemPrompt
    if (req.agent.temperature != null) body.temperature = req.agent.temperature
    const hdrs: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...p.headers,
    }
    if (p.apiKey) hdrs['x-api-key'] = p.apiKey
    const res = await fetch(chatUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`Custom provider (anthropic) ${res.status}: ${await res.text()}`)
    const data = await res.json() as { content: Array<{ text: string }> }
    return { output: data.content?.map((c) => c.text).join('') ?? '', model, ms: Date.now() - t0 }
  }

  // OpenAI-compatible
  const messages: Array<{ role: string; content: string }> = []
  if (req.agent.systemPrompt) messages.push({ role: 'system', content: req.agent.systemPrompt })
  messages.push({ role: 'user', content: req.agent.userPrompt || req.input })

  const body: Record<string, unknown> = { model, messages }
  if (req.agent.temperature != null) body.temperature = req.agent.temperature
  if (req.agent.responseFormat && req.agent.strictOutput) {
    try {
      const schema = typeof req.agent.responseFormat === 'string'
        ? JSON.parse(req.agent.responseFormat) : req.agent.responseFormat
      body.response_format = { type: 'json_schema', json_schema: { name: 'response', strict: true, schema } }
    } catch { /* ignore bad schema */ }
  }

  const hdrs: Record<string, string> = { 'Content-Type': 'application/json', ...p.headers }
  if (p.apiKey) hdrs['Authorization'] = `Bearer ${p.apiKey}`

  const res = await fetch(chatUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Custom provider ${res.status}: ${await res.text()}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return { output: data.choices?.[0]?.message?.content ?? '', model, ms: Date.now() - t0 }
}

/* ── Direct OpenAI ──────────────────────────────────────────────────────── */

async function callOpenAI(req: AgentRequest, model: string): Promise<AgentResponse> {
  const t0 = Date.now()
  const messages: Array<{ role: string; content: string }> = []
  if (req.agent.systemPrompt) messages.push({ role: 'system', content: req.agent.systemPrompt })
  messages.push({ role: 'user', content: req.agent.userPrompt || req.input })

  const body: Record<string, unknown> = { model: model || 'gpt-4o', messages }
  if (req.agent.temperature != null) body.temperature = req.agent.temperature
  if (req.agent.responseFormat && req.agent.strictOutput) {
    try {
      const schema = typeof req.agent.responseFormat === 'string'
        ? JSON.parse(req.agent.responseFormat) : req.agent.responseFormat
      body.response_format = { type: 'json_schema', json_schema: { name: 'response', strict: true, schema } }
    } catch { /* ignore */ }
  } else if (req.agent.responseFormat) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.openaiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return { output: data.choices?.[0]?.message?.content ?? '', model, ms: Date.now() - t0 }
}

/* ── Direct Anthropic ───────────────────────────────────────────────────── */

async function callAnthropic(req: AgentRequest, model: string): Promise<AgentResponse> {
  const t0 = Date.now()
  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: req.agent.userPrompt || req.input }],
  }
  if (req.agent.systemPrompt) body.system = req.agent.systemPrompt
  if (req.agent.temperature != null) body.temperature = req.agent.temperature

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json() as { content: Array<{ text: string }> }
  return { output: data.content?.map((c) => c.text).join('') ?? '', model, ms: Date.now() - t0 }
}
