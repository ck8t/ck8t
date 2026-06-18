function jsonPath(obj, path) {
  if (!path || path === '$') return obj
  return path.replace(/^\./, '').split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj)
}
export function run({ values, input }) {
  let parsed = input
  if (typeof input === 'string') { try { parsed = JSON.parse(input) } catch { return input } }
  const result = jsonPath(parsed, String(values.path || ''))
  if ((result === undefined || result === null) && values.fallback != null && values.fallback !== '') return values.fallback
  return result !== undefined ? result : null
}
