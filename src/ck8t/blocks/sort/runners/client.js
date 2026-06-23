export default [
  {
    type: 'sort',
    run({ values, input }) {
      const sortKey = String(values.sortKey || values.key || values.field || '')
      const order = String(values.order || 'asc')
      let arr = Array.isArray(input) ? [...input] : []
      if (!Array.isArray(input) && typeof input === 'string') {
        try { const p = JSON.parse(input); if (Array.isArray(p)) arr = [...p] } catch { arr = [] }
      }
      arr.sort((a, b) => {
        let va = a, vb = b
        if (sortKey && typeof a === 'object' && a !== null) va = a[sortKey]
        if (sortKey && typeof b === 'object' && b !== null) vb = b[sortKey]
        if (va === vb) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const cmp = String(va) < String(vb) ? -1 : 1
        return order === 'desc' ? -cmp : cmp
      })
      return { sorted: arr, count: arr.length }
    },
  },
]
