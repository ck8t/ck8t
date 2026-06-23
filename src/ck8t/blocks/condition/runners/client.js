export default [
  {
    type: 'condition',
    run({ values, input }) {
      let conditions = Array.isArray(values.conditions) ? values.conditions : []
      if (typeof values.conditions === 'string') { try { conditions = JSON.parse(values.conditions) } catch { conditions = [] } }
      function evalSafe(expr, val) { try { return new Function('input', `return (${expr})`)(val) } catch { return undefined } }
      for (const cond of conditions) {
        if (evalSafe(cond.expression, input)) return { branch: cond.id, value: input }
      }
      return { branch: 'else', value: input }
    },
  },
]
