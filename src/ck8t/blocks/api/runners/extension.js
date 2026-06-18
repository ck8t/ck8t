// Extension-side runner for the API block.
// Makes an HTTP request with retry, timeout, and template substitution.
const API_IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])

function interpolateBag(template, bag) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = bag[k]
    return v === undefined ? `{{${k}}}` : (typeof v === 'string' ? v : JSON.stringify(v))
  })
}

export async function run({ values, input }) {
  const bag = { input }
  if (input && typeof input === 'object' && !Array.isArray(input)) Object.assign(bag, input)
  const substitute = s => interpolateBag(s, bag)

  const method = String(values.method || 'GET').toUpperCase()
  let url = substitute(String(values.url || ''))

  let params = Array.isArray(values.params) ? values.params : []
  if (typeof values.params === 'string') { try { params = JSON.parse(values.params) } catch { params = [] } }
  if (params.length > 0) {
    const qs = params.filter(p => p.Key).map(p => encodeURIComponent(p.Key) + '=' + encodeURIComponent(substitute(String(p.Value ?? '')))).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }

  const rawHeaders = values.headers
  const headers = { 'Content-Type': 'application/json' }
  if (Array.isArray(rawHeaders)) {
    for (const h of rawHeaders) { if (h.Key) headers[h.Key] = substitute(String(h.Value ?? '')) }
  } else if (typeof rawHeaders === 'string') {
    try { Object.assign(headers, JSON.parse(rawHeaders)) } catch { /* ignore */ }
  } else if (rawHeaders && typeof rawHeaders === 'object') {
    Object.assign(headers, rawHeaders)
  }

  let bodyStr
  if (method !== 'GET' && method !== 'HEAD') {
    const rawBody = values.body
    if (rawBody !== undefined && rawBody !== '') bodyStr = typeof rawBody === 'string' ? substitute(rawBody) : JSON.stringify(rawBody)
  }

  const timeoutMs = Number(values.timeout) > 0 ? Number(values.timeout) : 300000
  const maxRetries = Math.max(0, Number(values.retries) || 0)
  const retryDelayMs = Number(values.retryDelayMs) > 0 ? Number(values.retryDelayMs) : 500
  const retryMaxDelayMs = Number(values.retryMaxDelayMs) > 0 ? Number(values.retryMaxDelayMs) : 30000
  const canRetry = API_IDEMPOTENT_METHODS.has(method) || values.retryNonIdempotent === true

  const attemptFetch = async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const t0 = Date.now()
    try {
      const res = await fetch(url, { method, headers, body: bodyStr, signal: controller.signal })
      const ms = Date.now() - t0
      const ct = res.headers.get('content-type') || ''
      let data
      if (ct.includes('application/json')) {
        try { data = await res.json() } catch { data = await res.text() }
      } else if (/^image\//.test(ct) || ct === 'application/octet-stream' || ct === 'application/pdf') {
        const buf = await res.arrayBuffer()
        data = `data:${ct};base64,${Buffer.from(buf).toString('base64')}`
      } else {
        data = await res.text()
      }
      const outHeaders = {}
      res.headers.forEach((v, k) => { outHeaders[k] = v })
      outHeaders['x-duration-ms'] = String(ms)
      return { data, status: res.status, headers: outHeaders, ok: res.ok }
    } finally {
      clearTimeout(timer)
    }
  }

  let lastErr = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await attemptFetch()
      if (!result.ok && result.status >= 500 && attempt < maxRetries && canRetry) {
        lastErr = new Error(`HTTP ${result.status}`)
        const delay = Math.min(retryDelayMs * 2 ** attempt, retryMaxDelayMs)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      const { ok: _ok, ...rest } = result
      return rest
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries && canRetry) {
        const delay = Math.min(retryDelayMs * 2 ** attempt, retryMaxDelayMs)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      break
    }
  }
  const message = lastErr?.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : (lastErr?.message || 'Request failed')
  return { data: null, status: 0, headers: {}, error: message }
}
