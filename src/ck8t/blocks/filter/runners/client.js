function evalSafe(expr, input) {
  try { return new Function('input', `"use strict"; return (${expr})`)(input) } catch { return false }
}
export function run({ values, input }) {
  const arr = Array.isArray(input) ? input : (typeof input === 'string' ? (() => { try { return JSON.parse(input) } catch { return [] } })() : [])
  const expr = String(values.condition || values.expression || 'true')
  const kept = [], rejected = []
  for (const item of arr) {
    (evalSafe(expr, item) ? kept : rejected).push(item)
  }
  return { kept, rejected }
}
