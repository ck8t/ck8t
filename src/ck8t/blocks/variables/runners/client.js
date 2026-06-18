function interpolateBag(template, bag) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = bag[k]
    return v === undefined ? `{{${k}}}` : (typeof v === 'string' ? v : JSON.stringify(v))
  })
}
export function run({ values, input }) {
  const vars = {}
  const bag = { input }
  if (input && typeof input === 'object' && !Array.isArray(input)) Object.assign(bag, input)
  const entries = Array.isArray(values.variables) ? values.variables : []
  for (const entry of entries) {
    const key = String(entry.key ?? entry.name ?? '').trim()
    if (!key) continue
    const val = entry.value ?? entry.expression ?? ''
    vars[key] = typeof val === 'string' ? interpolateBag(val, bag) : val
  }
  return { ...bag, ...vars }
}
