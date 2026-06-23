import { interpolateBag, arrayBufferToBase64 } from '../../block-utils.js'

const IDEMPOTENT = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])

export default [
  {
    type: 'api',
    async run({ values, input, inputsByHandle }) {
      const method = String(values.method || 'GET').toUpperCase()

      const inputStr = input !== undefined ? (typeof input === 'string' ? input : JSON.stringify(input ?? '')) : ''
      const bag = { input: inputStr }
      try {
        const parsed = JSON.parse(inputStr)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(bag, parsed)
      } catch { /* noop */ }
      const sub = s => typeof s === 'string' ? interpolateBag(s, bag) : s

      let url = sub(String(values.url || ''))
      if (inputsByHandle?.url != null) url = String(inputsByHandle.url)

      let params = Array.isArray(values.params) ? values.params : []
      if (typeof values.params === 'string') { try { params = JSON.parse(values.params) } catch { params = [] } }
      if (params.length > 0) {
        const qs = params.filter(p => p.Key).map(p => encodeURIComponent(p.Key) + '=' + encodeURIComponent(sub(String(p.Value ?? '')))).join('&')
        url += (url.includes('?') ? '&' : '?') + qs
      }

      let headerEntries = Array.isArray(values.headers) ? values.headers : []
      if (typeof values.headers === 'string') {
        try {
          const parsed = JSON.parse(values.headers)
          headerEntries = Array.isArray(parsed) ? parsed : Object.entries(parsed).map(([Key, Value]) => ({ Key, Value }))
        } catch { headerEntries = [] }
      }
      const headers = {}
      for (const h of headerEntries) { if (h.Key) headers[h.Key] = sub(String(h.Value ?? '')) }

      const authType = String(values.authorization || 'none')
      if (authType === 'bearer' && values.authToken) {
        const token = sub(String(values.authToken))
        if (token && !headers['Authorization'] && !headers['authorization']) headers['Authorization'] = `Bearer ${token}`
      } else if (authType === 'api_key' && values.authApiKeyName && values.authApiKeyValue) {
        const keyName = sub(String(values.authApiKeyName))
        const keyValue = sub(String(values.authApiKeyValue))
        const keyIn = String(values.authApiKeyIn || 'header')
        if (keyName && keyValue) {
          if (keyIn === 'query') url += (url.includes('?') ? '&' : '?') + encodeURIComponent(keyName) + '=' + encodeURIComponent(keyValue)
          else if (!headers[keyName]) headers[keyName] = keyValue
        }
      } else if (authType === 'basic' && values.authUsername) {
        const creds = btoa(`${sub(String(values.authUsername))}:${sub(String(values.authPassword || ''))}`)
        if (!headers['Authorization'] && !headers['authorization']) headers['Authorization'] = `Basic ${creds}`
      }

      const contentType = String(values.contentType || 'application/json')
      let body
      if (method !== 'GET' && method !== 'HEAD' && contentType !== 'none') {
        if (contentType === 'multipart/form-data') {
          let rows = Array.isArray(values.bodyFormData) ? values.bodyFormData : []
          if (typeof values.bodyFormData === 'string') { try { rows = JSON.parse(values.bodyFormData) } catch { rows = [] } }
          if (rows.length > 0) {
            const fd = new FormData()
            for (const row of rows) { if (row[0]) fd.append(sub(String(row[0])), sub(String(row[1] ?? ''))) }
            body = fd
            delete headers['Content-Type']; delete headers['content-type']
          }
        } else if (contentType === 'application/x-www-form-urlencoded') {
          let rows = Array.isArray(values.bodyFormData) ? values.bodyFormData : []
          if (typeof values.bodyFormData === 'string') { try { rows = JSON.parse(values.bodyFormData) } catch { rows = [] } }
          const qp = new URLSearchParams()
          for (const row of rows) { if (row[0]) qp.append(sub(String(row[0])), sub(String(row[1] ?? ''))) }
          body = qp.toString()
          if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/x-www-form-urlencoded'
        } else if (contentType === 'text/plain') {
          const rawText = sub(String(values.bodyText || ''))
          if (rawText.trim()) { body = rawText; if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'text/plain' }
        } else {
          if (inputsByHandle?.body != null) {
            const wb = inputsByHandle.body; body = typeof wb === 'string' ? wb : JSON.stringify(wb)
            if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
          } else if (inputsByHandle?.input != null) {
            const wi = inputsByHandle.input; body = typeof wi === 'string' ? wi : JSON.stringify(wi)
            if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
          } else {
            const rawBody = sub(values.body)
            if (typeof rawBody === 'string' && rawBody.trim()) {
              body = rawBody
              if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
            }
          }
        }
      }

      const timeoutMs = Number(values.timeout) > 0 ? Number(values.timeout) : 300_000
      const maxRetries = Math.max(0, Number(values.retries) || 0)
      const retryDelayMs = Number(values.retryDelayMs) > 0 ? Number(values.retryDelayMs) : 500
      const retryMaxDelayMs = Number(values.retryMaxDelayMs) > 0 ? Number(values.retryMaxDelayMs) : 30_000
      const canRetry = IDEMPOTENT.has(method) || values.retryNonIdempotent === true

      const attemptFetch = async () => {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), timeoutMs)
        try {
          const resp = await fetch(url, { method, headers, body, signal: ctrl.signal })
          const ct = resp.headers.get('content-type') || ''
          let data
          if (ct.includes('application/json')) { data = await resp.json() }
          else if (/^image\//.test(ct) || ct === 'application/octet-stream' || ct === 'application/pdf') {
            const buf = await resp.arrayBuffer()
            data = `data:${ct};base64,${arrayBufferToBase64(buf)}`
          } else { data = await resp.text() }
          const respHeaders = {}
          resp.headers.forEach((v, k) => { respHeaders[k] = v })
          return { data, status: resp.status, headers: respHeaders, ok: resp.ok }
        } finally { clearTimeout(timer) }
      }

      let lastErr = null
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await attemptFetch()
          if (!result.ok && result.status >= 500 && attempt < maxRetries && canRetry) {
            lastErr = new Error(`HTTP ${result.status}`)
            await new Promise(r => setTimeout(r, Math.min(retryDelayMs * 2 ** attempt, retryMaxDelayMs)))
            continue
          }
          const { ok: _ok, ...rest } = result
          return rest
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error(String(err))
          if (attempt < maxRetries && canRetry) {
            await new Promise(r => setTimeout(r, Math.min(retryDelayMs * 2 ** attempt, retryMaxDelayMs)))
            continue
          }
          break
        }
      }
      const message = lastErr?.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : (lastErr?.message || 'Request failed')
      return { data: null, status: 0, headers: {}, error: message }
    },
  },
]
