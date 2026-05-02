/**
 * LLM service — calls the LLM for agent nodes.
 *
 * Strategy (proxy-first):
 *  1. DEFAULT: proxy through ConvEngine's /builder-studio/agent endpoint.
 *     This lets the organisation use its own LLM gateway / custom models
 *     configured in ConvEngine (convengine-demo).
 *  2. FALLBACK: if DIRECT_LLM=true AND the matching API key is set,
 *     call OpenAI / Anthropic directly (useful for local dev without ConvEngine).
 */
import { config } from '../config.js'
import { listCustomProviders } from './customProvider.js'
import type { AgentRequest, AgentResponse } from '../types/index.js'

const useDirectLlm = process.env.DIRECT_LLM === 'true'

export async function callAgent(req: AgentRequest): Promise<AgentResponse> {
  const model = req.agent.model || ''
  const providerKey = req.agent.provider || ''

  // ── 1. Custom provider (LM Studio, Ollama, any user-registered provider) ─
  // Check by provider key first, then fall back to model-id match.
  const customProviders = listCustomProviders()
  const customProvider =
    customProviders.find((p) => p.key === providerKey) ||
    customProviders.find((p) =>
      p.activeModel === model ||
      (p.cachedModels ?? []).some((m) => m.id === model)
    )
  if (customProvider?.chatUrl) {
    return callCustomProvider(req, customProvider)
  }

  // ── 2. Direct mode (opt-in via DIRECT_LLM=true + env API keys) ───────────
  if (useDirectLlm) {
    if (config.openaiKey && (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3'))) {
      return callOpenAI(req, model)
    }
    if (config.anthropicKey && model.startsWith('claude-')) {
      return callAnthropic(req, model)
    }
  }

  // ── 3. Proxy through ConvEngine (default — requires convengine-demo running) ─
  return proxyToConvEngine(req)
}

/* ── Custom provider (server-side — no CORS) ──────────────────────────────── */

async function callCustomProvider(
  req: AgentRequest,
  p: { chatUrl?: string; apiKey?: string; type?: string; headers?: Record<string, string> },
): Promise<AgentResponse> {
  const t0 = Date.now()
  const model = req.agent.model || ''
  const chatUrl = p.chatUrl!

  const messages: Array<{ role: string; content: string }> = []
  if (req.agent.systemPrompt) messages.push({ role: 'system', content: req.agent.systemPrompt })
  messages.push({ role: 'user', content: req.agent.userPrompt || req.input })

  // Anthropic format
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

  // OpenAI-compatible (default — covers OpenAI, LM Studio, Ollama /v1, Groq, etc.)
  const body: Record<string, unknown> = { model, messages }
  if (req.agent.temperature != null) body.temperature = req.agent.temperature

  // Only send response_format for strict json_schema — many local providers
  // (LM Studio, Ollama) reject the non-standard `json_object` type.
  if (req.agent.responseFormat && req.agent.strictOutput) {
    try {
      const schema = typeof req.agent.responseFormat === 'string'
        ? JSON.parse(req.agent.responseFormat) : req.agent.responseFormat
      body.response_format = { type: 'json_schema', json_schema: { name: 'response', strict: true, schema } }
    } catch { /* ignore bad schema */ }
  }
  // `json_object` intentionally omitted for custom providers — not universally supported

  const hdrs: Record<string, string> = { 'Content-Type': 'application/json', ...p.headers }
  if (p.apiKey) hdrs['Authorization'] = `Bearer ${p.apiKey}`

  const res = await fetch(chatUrl, { method: 'POST', headers: hdrs, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Custom provider ${res.status}: ${await res.text()}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return { output: data.choices?.[0]?.message?.content ?? '', model, ms: Date.now() - t0 }
}

/* ── Direct OpenAI ────────────────────────────────────────────────────── */

async function callOpenAI(req: AgentRequest, model: string): Promise<AgentResponse> {
  const t0 = Date.now()
  const messages: Array<{ role: string; content: string }> = []
  if (req.agent.systemPrompt) messages.push({ role: 'system', content: req.agent.systemPrompt })
  messages.push({ role: 'user', content: req.agent.userPrompt || req.input })

  const body: Record<string, unknown> = { model, messages }
  if (req.agent.temperature != null) body.temperature = req.agent.temperature

  if (req.agent.responseFormat && req.agent.strictOutput) {
    try {
      const schema = typeof req.agent.responseFormat === 'string'
        ? JSON.parse(req.agent.responseFormat)
        : req.agent.responseFormat
      body.response_format = { type: 'json_schema', json_schema: { name: 'response', strict: true, schema } }
    } catch { /* ignore parse errors, send without format */ }
  } else if (req.agent.responseFormat) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.openaiKey}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI ${res.status}: ${text}`)
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const output = data.choices?.[0]?.message?.content ?? ''
  return { output, model, ms: Date.now() - t0 }
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
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic ${res.status}: ${text}`)
  }
  const data = await res.json() as { content: Array<{ text: string }> }
  const output = data.content?.map((c) => c.text).join('') ?? ''
  return { output, model, ms: Date.now() - t0 }
}

/* ── Proxy to ConvEngine ──────────────────────────────────────────────────── */

async function proxyToConvEngine(req: AgentRequest): Promise<AgentResponse> {
  const url = `${config.convengineBase}/builder-studio/agent`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new Error(
      'No LLM provider could handle this request. ' +
      'Add a custom provider in Settings → LLM Provider Configuration, or ensure convengine-demo is running.'
    )
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ConvEngine agent proxy ${res.status}: ${text}`)
  }
  return await res.json() as AgentResponse
}
