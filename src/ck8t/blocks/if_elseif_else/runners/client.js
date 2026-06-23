export default [
  {
    type: 'if_elseif_else',
    run({ values, input }) {
      const rows = Array.isArray(values.conditions) ? values.conditions : []
      const n = Math.max(1, Math.min(8, Number(values.branches) || rows.length || 2))
      function evalSafe(e, val) { try { return new Function('input', `return (${e})`)(val) } catch { return undefined } }
      for (let i = 0; i < n; i++) {
        const row = rows[i]
        if (!row) continue
        const expr = row.expression ?? row[1]
        if (!expr) continue
        if (evalSafe(expr, input)) return { branch: `branch_${i + 1}`, value: input }
      }
      return { branch: 'else', value: input }
    },
  },
]
