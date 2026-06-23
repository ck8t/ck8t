export default [
  {
    type: 'if_else',
    run({ values, input }) {
      const expr = values.expression || values.condition || 'true'
      function evalSafe(e, val) { try { return !!new Function('input', `return (${e})`)(val) } catch { return false } }
      return { branch: evalSafe(expr, input) ? 'true' : 'false', value: input }
    },
  },
]
