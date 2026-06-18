function evalSafe(expr, input) {
  try { return new Function('input', `"use strict"; return (${expr})`)(input) } catch { return false }
}
export function run({ values, input }) {
  const keyVal = values.keyExpr ? evalSafe(String(values.keyExpr), input) : input
  const key = String(keyVal)
  const cases = Array.isArray(values.cases) ? values.cases : []
  const n = Math.max(1, Math.min(12, Number(values.caseCount) || cases.length || 3))
  for (let i = 0; i < Math.min(n, cases.length); i++) {
    const c = cases[i]
    const match = c.value ?? c.match ?? (Array.isArray(cases[i]) ? cases[i][0] : undefined)
    if (match != null && String(match) === key) return { branch: `case_${i + 1}`, value: input }
  }
  return { branch: 'default', value: input }
}
