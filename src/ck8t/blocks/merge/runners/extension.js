function deepMerge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source ?? target
  const out = Object.assign({}, target)
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k]) && out[k] && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k], source[k])
    } else {
      out[k] = source[k]
    }
  }
  return out
}
export function run({ values, inputsByHandle }) {
  const mode = String(values.mode || 'merge')
  const inputs = Object.values(inputsByHandle || {}).filter(v => v != null)
  if (mode === 'deep_merge') return inputs.reduce((acc, v) => deepMerge(acc, v), {})
  return inputs.reduce((acc, v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return acc
    return Object.assign(acc, v)
  }, {})
}
