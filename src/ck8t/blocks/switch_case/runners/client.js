export default [
  {
    type: 'switch',
    run({ values, input }) {
      function evalSafe(e, val) { try { return new Function('input', `return (${e})`)(val) } catch { return undefined } }
      const keyVal = values.keyExpr ? evalSafe(values.keyExpr, input) : input
      const key = String(keyVal)
      const cases = Array.isArray(values.cases) ? values.cases : []
      const n = Math.max(1, Math.min(12, Number(values.caseCount) || cases.length || 3))
      for (let i = 0; i < Math.min(n, cases.length); i++) {
        const c = cases[i]
        const match = c.value ?? c.match ?? c[0]
        if (match != null && String(match) === key) return { branch: `case_${i + 1}`, value: input }
      }
      return { branch: 'default', value: input }
    },
  },
]
