export function run({ values, input }) {
  const arr = Array.isArray(input) ? input : []
  const op = String(values.operation || 'count')
  const key = String(values.key || values.field || '')
  const vals = key ? arr.map(i => (i != null ? i[key] : i)).filter(v => v != null) : arr.filter(v => v != null)
  switch (op) {
    case 'count': return { result: arr.length }
    case 'sum': return { result: vals.reduce((s, v) => s + Number(v), 0) }
    case 'avg': return { result: vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : 0 }
    case 'min': return { result: vals.length ? Math.min(...vals.map(Number)) : null }
    case 'max': return { result: vals.length ? Math.max(...vals.map(Number)) : null }
    case 'flatten': return { result: arr.flat(Infinity) }
    case 'unique': return { result: [...new Set(vals)] }
    case 'join': return { result: vals.join(String(values.separator || ',')) }
    case 'first': return { result: arr[0] ?? null }
    case 'last': return { result: arr[arr.length - 1] ?? null }
    default: return { result: arr.length }
  }
}
