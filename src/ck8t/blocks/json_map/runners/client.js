import { jsonPath, safeJson } from '../../block-utils.js'

function resolveMappings(tableRows, rawMappings) {
  if (Array.isArray(tableRows) && tableRows.length > 0) {
    const fromTable = tableRows
      .map(row => {
        if (!Array.isArray(row)) return null
        const key = String(row[0] ?? '').trim()
        const path = String(row[1] ?? '').trim()
        if (!key) return null
        return { key, path: path || '$' }
      })
      .filter(Boolean)
    if (fromTable.length > 0) return fromTable
  }
  if (!rawMappings) return []
  if (typeof rawMappings === 'string') {
    try { return JSON.parse(rawMappings) } catch (e) { throw new Error(`JSON Map: mappings is not valid JSON — ${e.message}`) }
  }
  return rawMappings
}

export default [
  {
    type: 'json_map',
    run({ values, input }) {
      let obj = typeof input === 'string' ? safeJson(input) : input
      if (obj == null) obj = {}
      const mappings = resolveMappings(values.mappingPairs, values.mappings)
      if (!Array.isArray(mappings) || mappings.length === 0) return obj
      const result = {}
      for (const m of mappings) {
        const key = m.key || m.k
        const path = m.path || m.p || m.jsonPath
        if (!key) continue
        const val = path === '$' ? obj : jsonPath(obj, path)
        result[key] = val !== undefined ? val : null
      }
      return result
    },
  },
]
