// Evaluates a boolean expression and routes to the true or false branch.
function evalSafe(expr, input) {
  try { return new Function('input', `"use strict"; return (${expr})`)(input) } catch { return false }
}
export function run({ values, input }) {
  const expr = String(values.expression || values.condition || 'true')
  return { branch: evalSafe(expr, input) ? 'true' : 'false', value: input }
}
