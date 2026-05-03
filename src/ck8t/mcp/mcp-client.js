/**
 * Fetch helpers for the convengine MCP REST surface (see
 * {@code com.github.salilvnair.convengine.mcp.McpController}).
 *
 * All methods throw on non-2xx, surfacing the server's
 * {@code { error: string }} body when available.
 */
import { detectServer, getServerAvailable } from '../api/server-status'

const BASE = (
  globalThis.__CK8T_BRIDGE_BASE__ ||
  import.meta.env?.VITE_CONVENGINE_BASE ||
  (import.meta.env?.DEV ? 'http://localhost:3001/api/v1' : 'http://localhost:8080/api/v1')
).replace(/\/$/, '')

function isNetworkFetchError(err) {
  const msg = String(err?.message || '')
  return (
    err?.name === 'TypeError' ||
    /Failed to fetch/i.test(msg) ||
    /NetworkError/i.test(msg) ||
    /Load failed/i.test(msg)
  )
}

function makeOfflineWarning(meta = {}) {
  const pretty = new Error(
    'MCP warning: ck8t-server is not reachable. Start ck8t-server to load MCP servers and tools.'
  )
  pretty.kind = 'mcp-server-offline'
  pretty.url = meta.url
  pretty.resolvedUrl = resolveUrl(meta.url)
  pretty.method = meta.method || 'GET'
  if (meta.payload) pretty.requestPayload = meta.payload
  if (meta.headers) pretty.requestHeaders = meta.headers
  return pretty
}

async function ensureServerForMcp(meta = {}) {
  const known = getServerAvailable()
  if (known === false) throw makeOfflineWarning(meta)

  // If status is unknown, probe once (cached by server-status.js).
  if (known === null) {
    const up = await detectServer()
    if (!up) throw makeOfflineWarning(meta)
  }
}

async function remapMcpNetworkError(err, meta = {}) {
  if (!isNetworkFetchError(err)) return err

  // Use cached probe first; if unknown, run one probe and reuse cached result.
  const known = getServerAvailable()
  const serverUp = known === null ? await detectServer() : known
  if (serverUp !== false) return err
  return makeOfflineWarning(meta)
}

async function fetchJson(url, init, meta = {}) {
  try {
    await ensureServerForMcp({ ...meta, url })
    const res = await fetch(url, init)
    return await jsonOrThrow(res, { ...meta, url })
  } catch (err) {
    throw await remapMcpNetworkError(err, { ...meta, url })
  }
}

async function jsonOrThrow(res, meta = {}) {
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { /* non-json */ }
  if (!res.ok) {
    const msg = body?.error || text || `HTTP ${res.status}`
    const rich = new Error(msg)
    rich.url = meta.url || res.url
    rich.resolvedUrl = resolveUrl(meta.url || res.url)
    rich.method = meta.method || 'GET'
    rich.status = res.status
    rich.statusText = res.statusText
    rich.responseBody = text
    rich.responseHeaders = headersToObj(res.headers)
    if (meta.payload) rich.requestPayload = meta.payload
    if (meta.headers) rich.requestHeaders = meta.headers
    throw rich
  }
  return body
}

function resolveUrl(url) {
  try { return new URL(url, window.location.origin).href } catch { return url }
}

function headersToObj(headers) {
  const obj = {}
  if (headers?.forEach) headers.forEach((v, k) => { obj[k] = v })
  return obj
}

export async function listServers() {
  const url = `${BASE}/mcp/servers`
  return fetchJson(url, undefined, { method: 'GET' })
}

export async function upsertServer(cfg) {
  const url = `${BASE}/mcp/servers`
  const headers = { 'Content-Type': 'application/json' }
  return fetchJson(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(cfg),
    },
    { method: 'POST', headers, payload: cfg }
  )
}

export async function deleteServer(id) {
  const url = `${BASE}/mcp/servers/${encodeURIComponent(id)}`
  return fetchJson(url, { method: 'DELETE' }, { method: 'DELETE' })
}

/** @returns {{serverId, tools: Array<{name, description, inputSchema}>}} */
export async function listTools(id, { refresh = false } = {}) {
  const q = refresh ? '?refresh=true' : ''
  const url = `${BASE}/mcp/servers/${encodeURIComponent(id)}/tools${q}`
  return fetchJson(url, undefined, { method: 'GET' })
}

/** Invoke an MCP tool. `args` is an arbitrary JSON-shaped value or undefined. */
export async function callTool(id, tool, args) {
  const url = `${BASE}/mcp/servers/${encodeURIComponent(id)}/tools/${encodeURIComponent(tool)}/call`
  const headers = { 'Content-Type': 'application/json' }
  const payload = { arguments: args ?? {} }
  return fetchJson(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
    { method: 'POST', headers, payload }
  )
}
