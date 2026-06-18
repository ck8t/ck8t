export async function run({ values, input }) {
  const mode = String(values.mode || 'json_parse')
  switch (mode) {
    case 'json_parse': {
      try { return typeof input === 'string' ? JSON.parse(input) : input } catch { return input }
    }
    case 'json_stringify': {
      return typeof input === 'string' ? input : JSON.stringify(input, null, 2)
    }
    case 'to_array': {
      if (Array.isArray(input)) return input
      if (input && typeof input === 'object') return Object.entries(input).map(([k, v]) => ({ key: k, value: v }))
      return [input]
    }
    case 'from_array': {
      if (!Array.isArray(input)) return input
      const result = {}
      for (const item of input) {
        if (item && typeof item === 'object' && 'key' in item) result[item.key] = item.value
      }
      return result
    }
    default: return input
  }
}
