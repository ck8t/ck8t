function jsonPath(obj, path) {
  if (!path || path === '$') return obj
  return path.replace(/^\./, '').split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj)
}
export function run({ values, input }) {
  let parsed = input
  if (typeof input === 'string') { try { parsed = JSON.parse(input) } catch { return input } }
  const rows = Array.isArray(values.mappingPairs) ? values.mappingPairs : []
  let mappings = []
  if (rows.length > 0) {
    mappings = rows.map(r => {
      if (!Array.isArray(r)) return null
      const k = String(r[0] ?? '').trim()
      const p = String(r[1] ?? '').trim()
      return k ? { key: k, path: p || '$' } : null
    }).filter(Boolean)
  } else if (values.mappings) {
    try { mappings = typeof values.mappings === 'string' ? JSON.parse(values.mappings) : values.mappings } catch { mappings = [] }
  }
  const result = {}
  for (const m of mappings) result[m.key] = jsonPath(parsed, m.path)
  return result
}
