export default [
  {
    type: 'variables',
    run({ values }) {
      let vars = Array.isArray(values.variables) ? values.variables : []
      if (typeof values.variables === 'string') { try { vars = JSON.parse(values.variables) } catch { vars = [] } }
      const result = {}
      for (const v of vars) { if (v.variableName) result[v.variableName] = v.value }
      return result
    },
  },
]
