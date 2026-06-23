/**
 * Shared pure utilities for core block runners.
 * Runners import from here instead of embedding duplicates.
 */

export function jsonPath(obj, path) {
  if (!path || path === '$') return obj
  const parts = String(path).replace(/^\$\.?/, '').split('.').filter(Boolean)
  return parts.reduce((a, k) => (a == null ? a : a[k]), obj)
}

export function interpolateBag(template, bag) {
  if (!template) return ''
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) => {
    if (!(k in bag)) return m
    const v = bag[k]
    if (v == null) return ''
    return typeof v === 'string' ? v : JSON.stringify(v)
  })
}

export function evalSafe(expr, input) {
  try { return new Function('input', `return (${expr})`)(input) } catch { return undefined }
}

export function safeJson(s) {
  if (typeof s !== 'string') return s
  try { return JSON.parse(s) } catch { return null }
}

export function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  return btoa(binary)
}

export function extractMediaUri(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const m = value.match(/data:(image\/[^;,]+|application\/pdf);base64,([A-Za-z0-9+/=\n]+)/)
    if (m) return { dataUri: m[0].replace(/\s/g, ''), mimeType: m[1] }
    const md = value.match(/!\[[^\]]*\]\((data:(?:image\/[^);]+|application\/pdf);base64,[A-Za-z0-9+/=\n]+)\)/)
    if (md) return extractMediaUri(md[1])
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item?.type === 'image' && item.data)
        return { dataUri: `data:${item.mimeType ?? 'image/png'};base64,${item.data}`, mimeType: item.mimeType ?? 'image/png' }
      if (item?.type === 'text' && item.text) { const r = extractMediaUri(item.text); if (r) return r }
    }
    return null
  }
  if (typeof value === 'object') {
    if (typeof value.__ck8t_image_url === 'string')
      return { dataUri: value.__ck8t_image_url, mimeType: 'image/png', isExternalUrl: true }
    for (const k of ['image', 'image_data', 'imageData', 'base64', 'data', 'content', 'pdf', 'file']) {
      if (value[k]) { const r = extractMediaUri(value[k]); if (r) return r }
    }
  }
  return null
}

export function extractImageUrl(val) {
  if (!val) return null
  if (typeof val === 'string') return val.trim() || null
  if (typeof val !== 'object') return null
  if (Array.isArray(val.data) && val.data.length > 0 && typeof val.data[0]?.url === 'string') return val.data[0].url
  if (val.data && Array.isArray(val.data?.data) && typeof val.data.data[0]?.url === 'string') return val.data.data[0].url
  for (const k of ['url', 'image_url', 'imageUrl', 'src', 'image']) {
    if (typeof val[k] === 'string') return val[k]
  }
  return null
}
