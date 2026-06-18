function evalSafe(expr, input) {
  try { return new Function('input', `"use strict"; return (${expr})`)(input) } catch { return false }
}
export function run({ values, input }) {
  const rows = Array.isArray(values.conditions) ? values.conditions : []
  const n = Math.max(1, Math.min(8, Number(values.branches) || rows.length || 2))
  for (let i = 0; i < n; i++) {
    const row = rows[i]
    if (!row) continue
    const expr = row.expression ?? (Array.isArray(row) ? row[1] : undefined)
    if (!expr) continue
    if (evalSafe(String(expr), input)) return { branch: `branch_${i + 1}`, value: input }
  }
  return { branch: 'else', value: input }
}
