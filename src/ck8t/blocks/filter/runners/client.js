export default [
  {
    type: 'filter',
    run({ values, input }) {
      const mode = String(values.mode || 'keep')
      let arr = Array.isArray(input) ? input : []
      if (!Array.isArray(input) && typeof input === 'string') {
        try { const p = JSON.parse(input); if (Array.isArray(p)) arr = p } catch { arr = [] }
      }
      const condSrc = String(values.conditions || 'return true')
      let filterFn
      try { filterFn = new Function('item', 'index', condSrc) } catch { return { kept: arr, rejected: [], count: arr.length } }
      const kept = [], rejected = []
      for (let i = 0; i < arr.length; i++) {
        const result = filterFn(arr[i], i)
        if ((mode === 'keep' && result) || (mode === 'remove' && !result)) kept.push(arr[i])
        else rejected.push(arr[i])
      }
      return { kept, rejected, count: kept.length }
    },
  },
]
