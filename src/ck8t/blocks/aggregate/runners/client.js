export default [
  {
    type: 'aggregate',
    run({ values, input }) {
      const operation = String(values.operation || 'count')
      const field = String(values.field || values.key || '')
      let arr = Array.isArray(input) ? input : []
      if (!Array.isArray(input) && typeof input === 'string') {
        try { const p = JSON.parse(input); if (Array.isArray(p)) arr = p } catch { arr = [] }
      }
      const extract = (item) => field && item && typeof item === 'object' ? item[field] : item
      const nums = arr.map(extract).map(Number).filter(n => !isNaN(n))
      switch (operation) {
        case 'sum': return { result: nums.reduce((a, b) => a + b, 0), count: arr.length }
        case 'count': return { result: arr.length, count: arr.length }
        case 'avg': return { result: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0, count: arr.length }
        case 'min': return { result: nums.length > 0 ? Math.min(...nums) : null, count: arr.length }
        case 'max': return { result: nums.length > 0 ? Math.max(...nums) : null, count: arr.length }
        case 'concat': return { result: arr.map(extract), count: arr.length }
        case 'group': {
          const groups = {}
          for (const item of arr) {
            const key = String(extract(item) ?? 'undefined')
            if (!groups[key]) groups[key] = []
            groups[key].push(item)
          }
          return { result: groups, count: arr.length }
        }
        case 'custom': {
          try {
            const fn = new Function('input', String(values.customFn || 'return input'))
            return { result: fn(arr), count: arr.length }
          } catch { return { result: null, count: arr.length } }
        }
        default: return { result: arr.length, count: arr.length }
      }
    },
  },
]
